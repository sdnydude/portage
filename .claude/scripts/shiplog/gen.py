"""Ship-log generator: DHG Registry ship_sessions → website/docs/ship-log pages.

Additive by design (decision 2026-07-17, revived not retired; P4 2026-08-23):
git is the source of truth for pages, the registry is the source of truth for
sessions. Every page carries `registry_id:`; hand-written pages are never
regenerated or deleted (a legacy one gets a `registry_id:` line stamped in);
`--check` fails on any drift — a session with no page, a matched page
without `registry_id`, or an orphaned generated page (CI blocks drift).
"""
from __future__ import annotations

import json
import re
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

FETCH_TIMEOUT_S = 10


def _http_get(url: str, timeout: int) -> bytes:
    with urllib.request.urlopen(url, timeout=timeout) as r:  # LAN registry
        return r.read()


def fetch_all(base_url: str, project: str, limit: int = 100) -> list[dict]:
    """Every ship session for `project`, oldest first, ties broken by id.

    The registry defaults to created_at DESC and pages via offset; the old
    single `limit=100` call silently dropped the oldest 34 of 134 sessions.
    """
    sessions: list[dict] = []
    offset = 0
    total = None
    while total is None or len(sessions) < total:
        raw = _http_get(
            f"{base_url}/api/ship-sessions?project_name={project}&limit={limit}&offset={offset}",
            timeout=FETCH_TIMEOUT_S,
        )
        data = json.loads(raw)
        page = data.get("ship_sessions", [])
        if "total" not in data:
            raise ValueError("registry response has no 'total' — refusing to guess how many sessions exist")
        total = int(data["total"])
        if not page:
            break
        sessions.extend(page)
        offset += limit
    if len(sessions) != total:
        raise ValueError(f"registry returned {len(sessions)} of {total} sessions — incomplete fetch, nothing written")
    sessions.sort(key=lambda s: (s.get("created_at", ""), s.get("id", "")))
    return sessions


def escape_mdx(text: str) -> str:
    """Escape MDX/markdown-significant characters in registry prose.

    Bare `{expr}` is parsed as a JSX expression and `<11B`-style text as a
    tag; either one fails the whole Docusaurus build (5 silent failures on
    2026-07-02, 9 days dark 2026-08-13). Markdown links/images (`[`, `!`) are
    escaped too: registry text is data on a public site and must never
    become a live anchor (javascript:) or an external image load. Only
    well-formed backtick code spans are left intact; an odd number of
    backticks means there is no code span at all.
    """
    if text.count("`") % 2 == 1:
        segments = [text]
    else:
        segments = re.split(r"(`[^`]*`)", text)
    out: list[str] = []
    for seg in segments:
        if len(seg) >= 2 and seg.startswith("`") and seg.endswith("`") and text.count("`") % 2 == 0:
            out.append(seg)
        else:
            out.append(re.sub(r"([{}<>\[\]!])", r"\\\1", seg))
    return "".join(out)


def dedupe(sessions: list[dict]) -> list[dict]:
    """Collapse double captures (same PR + feature) to the earliest row.

    The /ship Phase 7 post and the Stop-hook guarantee can both land a row
    for one session; the registry has no unique key on (pr_url, feature).
    Sessions without a pr_url are never collapsed — two investigations with
    the same title are two sessions. Input must be oldest-first.
    """
    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    for s in sessions:
        pr = s.get("pr_url") or None
        if pr is None:
            out.append(s)  # no PR = no proof of sameness; never collapse
            continue
        key = (pr, (s.get("feature") or "").strip().lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


_PR_RE = re.compile(r"^https://github\.com/[\w.-]+/[\w.-]+/pull/(\d+)(?:[/#?].*)?$")


def pr_label(pr_url: str | None) -> str:
    """Markdown link for a well-formed GitHub pull URL; legacy/malformed → plain text."""
    m = _PR_RE.match(pr_url or "")
    return f"[#{m.group(1)}]({pr_url})" if m else "no PR recorded"


@dataclass
class Page:
    path: Path
    number: int
    title: str
    registry_id: str | None
    pr_url: str | None
    generated: bool
    frontmatter: str  # raw text between the --- fences
    body: str         # everything after the closing fence, byte-identical


_NUM_RE = re.compile(r"^(\d{3,})-.*\.md$")


def _fm_value(fm: str, key: str) -> str | None:
    m = re.search(rf"^{key}:\s*(.*)$", fm, re.M)
    if not m:
        return None
    v = m.group(1).strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        v = v[1:-1]
    return v or None


def _split(text: str) -> tuple[str, str] | None:
    text = text.replace("\r\n", "\n")  # a CRLF hand-written page is still a page
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end < 0:
        return None
    return text[4:end + 1], text[end + 4:]


def scan_existing(directory: Path) -> list[Page]:
    """Every NNN-*.md page on disk, sorted by number. index.md is not a page."""
    pages: list[Page] = []
    for path in sorted(Path(directory).glob("*.md")):
        m = _NUM_RE.match(path.name)
        if not m:
            continue
        parts = _split(path.read_text(encoding="utf-8"))
        if parts is None:
            continue
        fm, body = parts
        pr = _fm_value(fm, "pr_url")
        if pr is None:
            # Hand-written pages carry `**PR:** [#n](url)` or `| **PR** | [#n](url) |`.
            # Only a PR-labelled line counts — an incidental link elsewhere in
            # the body must not become this page's identity.
            link = re.search(r"\*\*PR:?\*\*[^\n]*?(https://github\.com/[\w.-]+/[\w.-]+/pull/\d+)", body)
            pr = link.group(1) if link else None
        pages.append(Page(
            path=path, number=int(m.group(1)), title=_fm_value(fm, "title") or "",
            registry_id=_fm_value(fm, "registry_id"), pr_url=pr,
            generated=(_fm_value(fm, "generated") == "true"), frontmatter=fm, body=body,
        ))
    pages.sort(key=lambda p: p.number)
    return pages


class AmbiguousMatch(Exception):
    """Two sessions (or two pages) could claim the same identity — a human decides."""


def slugify(text: str) -> str:
    """Deterministic ASCII slug: NFKD-fold, lowercase, [a-z0-9] runs joined by '-', ≤60 chars."""
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", folded.lower()).strip("-")[:60]


def match(sessions: list[dict], pages: list[Page]) -> tuple[dict[str, Page], list[dict]]:
    """Pair each session with an existing page, or report it unmatched.

    Identity, strongest first: registry_id in frontmatter; the session's
    pr_url on the page; exact (case-insensitive) title; a slug match only
    when exactly one session and one page share it. Anything ambiguous raises
    rather than guessing — a wrong stamp is how 039–042 got duplicated.
    """
    matched: dict[str, Page] = {}
    claimed: set[Path] = set()
    unmatched: list[dict] = []

    def claim(sid: str, page: Page) -> None:
        if page.path in claimed:
            raise AmbiguousMatch(f"page {page.path.name} claimed by two sessions ({sid} and another)")
        claimed.add(page.path)
        matched[sid] = page

    by_rid: dict[str, Page] = {}
    for p in pages:
        if p.registry_id:
            if p.registry_id in by_rid:
                raise AmbiguousMatch(f"registry_id {p.registry_id} on two pages: {by_rid[p.registry_id].path.name}, {p.path.name}")
            by_rid[p.registry_id] = p
    by_pr: dict[str, list[Page]] = {}
    for p in pages:
        if p.pr_url:
            by_pr.setdefault(p.pr_url, []).append(p)
    by_title: dict[str, list[Page]] = {}
    by_slug: dict[str, list[Page]] = {}
    for p in pages:
        if p.registry_id:
            continue
        by_title.setdefault(p.title.strip().lower(), []).append(p)
        by_slug.setdefault(slugify(p.title), []).append(p)

    slug_sessions: dict[str, list[dict]] = {}
    for s in sessions:
        slug_sessions.setdefault(slugify(s.get("feature") or ""), []).append(s)

    for s in sessions:
        sid = s["id"]
        if sid in by_rid:
            claim(sid, by_rid[sid]); continue
        pr = s.get("pr_url")
        cands = [p for p in by_pr.get(pr, []) if not p.registry_id] if pr else []
        if len(cands) == 1:
            claim(sid, cands[0]); continue
        title = (s.get("feature") or "").strip().lower()
        if len(cands) > 1:
            # One PR, several sessions/pages (e.g. build + review): the exact
            # title decides within that set; otherwise still refuse to guess.
            narrowed = [p for p in cands if p.title.strip().lower() == title]
            if len(narrowed) == 1:
                claim(sid, narrowed[0]); continue
            raise AmbiguousMatch(f"pr_url {pr} on {len(cands)} pages: {[p.path.name for p in cands]}")
        cands = by_title.get(title, [])
        if len(cands) == 1:
            claim(sid, cands[0]); continue
        if len(cands) > 1:
            raise AmbiguousMatch(f"title {title!r} on {len(cands)} pages: {[p.path.name for p in cands]}")
        slug = slugify(s.get("feature") or "")
        cands = by_slug.get(slug, [])
        if slug and len(cands) == 1 and len(slug_sessions.get(slug, [])) == 1:
            claim(sid, cands[0]); continue
        if len(cands) > 1 or (cands and len(slug_sessions.get(slug, [])) > 1):
            raise AmbiguousMatch(f"slug {slug!r}: pages {[p.path.name for p in cands]} vs {len(slug_sessions.get(slug, []))} sessions")
        unmatched.append(s)
    return matched, unmatched


def stamp_registry_id(page: Page, registry_id: str) -> None:
    """Append `registry_id:` to an existing page's frontmatter. Body untouched."""
    fm = page.frontmatter
    if not fm.endswith("\n"):
        fm += "\n"
    fm += f"registry_id: {registry_id}\n"
    page.path.write_text("---\n" + fm + "---" + page.body, encoding="utf-8")
    page.frontmatter = fm
    page.registry_id = registry_id


@dataclass
class Report:
    created: list[str]
    stamped: list[str]
    deleted: list[str]
    unmatched: list[dict]  # sessions with no page (check mode reports these)


def yaml_quote(text: str) -> str:
    """A YAML double-quoted scalar: backslashes and quotes escaped, nothing else."""
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _cell(value: object) -> str:
    """A markdown table cell: MDX-escaped and pipe-safe."""
    return escape_mdx(str(value or "—")).replace("|", "\\|")


def _fmt_date(iso: str | None) -> str:
    return (iso or "")[:10] or "—"


def render_page(s: dict, number: int) -> str:
    """A generated page. Frontmatter carries identity; body is the registry row."""
    raw_title = s.get("feature") or "Untitled session"
    title = escape_mdx(raw_title)          # body (MDX)
    sid = s["id"]
    short = sid[:8]
    tdd = s.get("tdd")
    lines = [
        "---",
        f"title: {yaml_quote(raw_title)}",          # frontmatter (YAML, never MDX-escaped)
        f"sidebar_label: {yaml_quote(raw_title[:50])}",
        f"sidebar_position: {number}",
        f"slug: ship-{short}",
        f"registry_id: {sid}",
        "generated: true",
        "---",
        "",
        f"# {title}",
        "",
        "| Field | Value |",
        "|-------|-------|",
        f"| **Status** | {_cell(s.get('status'))} |",
        f"| **Complexity** | {_cell(s.get('complexity'))} |",
        f"| **TDD** | {'Yes' if tdd is True else 'No' if tdd is False else '—'} |",
        f"| **PR** | {pr_label(s.get('pr_url'))} |",
        f"| **Completed** | {_fmt_date(s.get('completed_at') or s.get('created_at'))} |",
        f"| **Model** | {_cell(s.get('model_name'))} |",
        "",
    ]
    if s.get("approach"):
        lines += ["## Approach", "", escape_mdx(str(s["approach"])), ""]
    for key, heading in (("commits", "Commits"), ("deferred", "Deferred Items"), ("surprises", "Surprises"), ("decisions", "Decisions")):
        items = s.get(key) or []
        if items:
            lines += [f"## {heading}", ""] + [f"- {escape_mdx(str(i))}" for i in items] + [""]
    review = s.get("review") or {}
    if review:
        agents = ", ".join(escape_mdx(str(a)) for a in (review.get("agents") or [])) or "—"
        lines += ["## Review", "", f"- Agents: {agents}",
                  f"- Critical found: {review.get('critical_found', '—')} · Important found: {review.get('important_found', '—')}", ""]
    ver = s.get("verification") or {}
    if ver:
        lines += ["## Verification", ""] + [f"- **{escape_mdx(str(k))}:** {escape_mdx(str(v))}" for k, v in ver.items()] + [""]
    tags = s.get("tags") or []
    if tags:
        lines += ["**Tags:** " + ", ".join(f"`{t}`" for t in tags), ""]
    return "\n".join(lines)


def apply(sessions: list[dict], directory: Path, write: bool = True, prune: bool = False) -> Report:
    """Reconcile registry sessions with the pages on disk.

    - matched pages are never regenerated; a legacy one missing `registry_id:`
      gets that single frontmatter line stamped in (body byte-identical)
    - unmatched sessions get a new page numbered after the highest on disk
    - generated pages whose session no longer exists are reported as orphans
      and unlinked only with `prune=True`; hand-written pages are never deleted
    `write=False` reports what would change (in check mode the lists mean
    "would be created / stamped / deleted") and touches nothing.
    """
    directory = Path(directory)
    sessions = dedupe(sessions)
    pages = scan_existing(directory)
    matched, unmatched = match(sessions, pages)
    report = Report(created=[], stamped=[], deleted=[], unmatched=unmatched)

    for sid, page in matched.items():
        if page.registry_id is None:
            report.stamped.append(page.path.name)
            if write:
                stamp_registry_id(page, sid)

    live_ids = {s["id"] for s in sessions}
    for p in pages:
        if p.generated and p.registry_id and p.registry_id not in live_ids:
            report.deleted.append(p.path.name)
            if write and prune:
                p.path.unlink()

    number = max((p.number for p in pages), default=0)
    for s in unmatched:  # already oldest-first
        number += 1
        name = f"{number:03d}-{slugify(s.get('feature') or 'session') or 'session'}.md"
        report.created.append(name)
        if write:
            (directory / name).write_text(render_page(s, number), encoding="utf-8")
    return report


def _doc_ref(page: Page) -> str:
    """Docusaurus link target: explicit slug:, else explicit id:, else the filename."""
    return _fm_value(page.frontmatter, "slug") or _fm_value(page.frontmatter, "id") or page.path.stem


def write_index(directory: Path, project_label: str = "Portage") -> None:
    """index.md rebuilt from the pages on disk — it can never disagree with them."""
    pages = scan_existing(Path(directory))
    pages.sort(key=lambda p: (p.number, p.path.name))
    lines = [
        "---", "title: Ship Log", "sidebar_label: Ship Log", "sidebar_position: 0", "---", "",
        f"# {project_label} Ship Log", "",
        f"Every `/ship` run, generated from the DHG Registry `ship_sessions` table plus hand-written entries. Total: {len(pages)} sessions.", "",
        "| # | Feature | PR |", "|---|---------|----|",
    ]
    for p in pages:
        cell = escape_mdx(p.title).replace("|", "\\|")  # a pipe would split the table row
        lines.append(f"| {p.number:03d} | [{cell}]({_doc_ref(p)}) | {pr_label(p.pr_url)} |")
    lines.append("")
    (Path(directory) / "index.md").write_text("\n".join(lines), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    ap = argparse.ArgumentParser(description="Ship-log generator (additive; git is the source of truth).")
    ap.add_argument("--project", default="portage")
    ap.add_argument("--out", default="website/docs/ship-log")
    ap.add_argument("--registry", default="http://10.0.0.251:8011")
    ap.add_argument("--check", action="store_true",
                    help="Write nothing; exit 1 on drift: a session with no page, a matched page lacking registry_id, or an orphaned generated page (CI gate).")
    ap.add_argument("--prune", action="store_true",
                    help="Also delete generated pages whose registry session is gone (off by default — orphans are only reported).")
    args = ap.parse_args(argv)

    out_dir = Path(args.out)
    try:
        sessions = fetch_all(args.registry, args.project)
    except (urllib.error.URLError, OSError, ValueError) as e:
        # Deliberate hard fail (decision P4): a docs deploy must not claim the
        # ship-log is in sync when the registry could not be read.
        print(f"REGISTRY UNREACHABLE: {args.registry} — {e}\nship-log drift check could not run; fix the registry (same host) and re-run the deploy.")
        return 3
    try:
        report = apply(sessions, out_dir, write=not args.check, prune=args.prune)
    except AmbiguousMatch as e:
        print(f"AMBIGUOUS: {e}\nResolve by adding registry_id: to the right page, then re-run.")
        return 2

    if args.check:
        drift = report.created or report.stamped or report.deleted
        for s in report.unmatched:
            print(f"MISSING PAGE: {s['id']}  {s.get('created_at', '')[:10]}  {s.get('feature')}")
        for n in report.stamped:
            print(f"UNSTAMPED PAGE: {n} (run the generator to add registry_id)")
        for n in report.deleted:
            print(f"ORPHAN GENERATED PAGE: {n}")
        print("ship-log: in sync with the registry" if not drift else
              "ship-log: out of sync — run `python3 .claude/scripts/shiplog/gen.py` locally and commit website/docs/ship-log")
        return 1 if drift else 0

    write_index(out_dir)
    verb = "deleted" if args.prune else "orphans (use --prune to delete)"
    print(f"created {len(report.created)}, stamped {len(report.stamped)}, {verb} {len(report.deleted)}; index rebuilt")
    for n in report.created:
        print(f"  + {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

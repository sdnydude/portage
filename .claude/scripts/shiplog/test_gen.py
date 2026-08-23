"""Tests for the ship-log generator (gen.py). Run: python3 -m pytest .claude/scripts/shiplog -q"""
import json

import gen


def _page(ids, total):
    return json.dumps({"ship_sessions": [{"id": i, "created_at": c} for i, c in ids], "total": total}).encode()


def test_fetch_all_paginates_and_sorts_oldest_first_with_id_tiebreak(monkeypatch):
    pages = {
        0: _page([("c", "2026-08-03T00:00:00Z"), ("b", "2026-08-02T00:00:00Z")], 5),
        2: _page([("e", "2026-08-02T00:00:00Z"), ("a", "2026-08-01T00:00:00Z")], 5),
        4: _page([("d", "2026-07-30T00:00:00Z")], 5),
    }
    calls = []

    def fake_get(url, timeout):
        offset = int(url.split("offset=")[1].split("&")[0])
        calls.append(offset)
        return pages[offset]

    monkeypatch.setattr(gen, "_http_get", fake_get)
    sessions = gen.fetch_all("http://reg", "portage", limit=2)
    assert [s["id"] for s in sessions] == ["d", "a", "b", "e", "c"]  # asc; b/e tie broken by id
    assert calls == [0, 2, 4]


def test_escape_mdx_escapes_braces_and_angle_brackets():
    assert gen.escape_mdx("a {x} <b> c") == "a \\{x\\} \\<b\\> c"


def test_escape_mdx_leaves_code_spans_intact():
    assert gen.escape_mdx("set `{stream: true}` then <done>") == "set `{stream: true}` then \\<done\\>"


def test_dedupe_collapses_same_pr_and_feature_keeping_earliest():
    a = {"id": "1", "pr_url": "https://github.com/o/r/pull/317", "feature": "Housekeeping batch 1", "created_at": "2026-08-23T15:00:00Z"}
    b = {"id": "2", "pr_url": "https://github.com/o/r/pull/317", "feature": "housekeeping batch 1 ", "created_at": "2026-08-23T15:30:00Z"}
    c = {"id": "3", "pr_url": None, "feature": "Other", "created_at": "2026-08-23T16:00:00Z"}
    assert [s["id"] for s in gen.dedupe([a, b, c])] == ["1", "3"]


def test_pr_label_accepts_github_pull_urls_only():
    assert gen.pr_label("https://github.com/sdnydude/portage/pull/317") == "[#317](https://github.com/sdnydude/portage/pull/317)"
    assert gen.pr_label(None) == "no PR recorded"
    assert gen.pr_label("https://github.com/sdnydude/portage") == "no PR recorded"
    assert gen.pr_label("not a url") == "no PR recorded"


def _write(tmp_path, name, fm, body="\n# Body\n"):
    p = tmp_path / name
    p.write_text("---\n" + fm + "---" + body, encoding="utf-8")
    return p


def test_scan_existing_reads_number_title_registry_id_and_pr(tmp_path):
    _write(tmp_path, "001-alpha.md", 'title: "Alpha — first"\nsidebar_position: 1\n')
    _write(tmp_path, "059-hk.md", 'title: "Housekeeping batch 1"\nsidebar_position: 59\nregistry_id: abc-123\ngenerated: true\n')
    _write(tmp_path, "index.md", "title: Ship Log\n")
    pages = gen.scan_existing(tmp_path)
    assert [p.number for p in pages] == [1, 59]
    assert pages[0].title == "Alpha — first" and pages[0].registry_id is None and pages[0].generated is False
    assert pages[1].registry_id == "abc-123" and pages[1].generated is True and pages[1].path.name == "059-hk.md"


def _sess(i, feature, pr=None, created="2026-08-01T00:00:00Z"):
    return {"id": i, "feature": feature, "pr_url": pr, "created_at": created}


def test_match_prefers_registry_id_then_pr_url_then_exact_title_then_unique_slug(tmp_path):
    _write(tmp_path, "001-alpha.md", 'title: "Alpha"\nregistry_id: s1\n')
    _write(tmp_path, "002-renamed.md", 'title: "Operator renamed this page"\npr_url: https://github.com/o/r/pull/2\n')
    _write(tmp_path, "003-gamma.md", 'title: "Gamma Thing"\n')
    _write(tmp_path, "004-delta-release.md", 'title: "Delta release!"\n')
    pages = gen.scan_existing(tmp_path)
    sessions = [
        _sess("s1", "Alpha (title drifted)"),
        _sess("s2", "Beta", pr="https://github.com/o/r/pull/2"),
        _sess("s3", "gamma thing"),
        _sess("s4", "Delta Release"),
        _sess("s5", "Brand new session"),
    ]
    matched, unmatched = gen.match(sessions, pages)
    assert {sid: p.path.name for sid, p in matched.items()} == {
        "s1": "001-alpha.md", "s2": "002-renamed.md", "s3": "003-gamma.md", "s4": "004-delta-release.md",
    }
    assert [s["id"] for s in unmatched] == ["s5"]


def test_match_fails_loud_on_ambiguous_slug_instead_of_guessing(tmp_path):
    prefix = "Redesign Ship 1 — DHG design system + Porter home + tab bar + /porter page + theme toggle"
    _write(tmp_path, "050-redesign-ship-1.md", f'title: "{prefix} (build)"\n')
    _write(tmp_path, "051-redesign-ship-1.md", f'title: "{prefix} (Phase 6 review)"\n')
    pages = gen.scan_existing(tmp_path)
    sessions = [_sess("a", f"{prefix}: build"), _sess("b", f"{prefix}: phase 6")]
    # titles differ only past the 60-char slug cut → both slugs identical → must raise, never stamp the wrong row
    import pytest
    with pytest.raises(gen.AmbiguousMatch):
        gen.match(sessions, pages)


def test_stamp_registry_id_adds_one_frontmatter_line_and_leaves_body_byte_identical(tmp_path):
    body = "\n# Hand-written\n\nSome {braces} and <tags> that must survive untouched.\n"
    p = _write(tmp_path, "040-bulk.md", 'id: 040-bulk\ntitle: "Bulk"\ntags: [a, b]\n', body)
    page = gen.scan_existing(tmp_path)[0]
    gen.stamp_registry_id(page, "uuid-40")
    text = p.read_text(encoding="utf-8")
    assert text == '---\nid: 040-bulk\ntitle: "Bulk"\ntags: [a, b]\nregistry_id: uuid-40\n---' + body


def test_slugify_is_deterministic_ascii_for_unicode_titles():
    assert gen.slugify("Café “smart” pricing — naïve ↔ ready 🚀") == "cafe-smart-pricing-naive-ready"
    assert len(gen.slugify("x" * 200)) == 60


def test_apply_creates_numbered_generated_pages_skips_matched_and_is_idempotent(tmp_path):
    _write(tmp_path, "059-hk.md", 'title: "Housekeeping"\nregistry_id: s59\nsidebar_position: 59\n')
    sessions = [
        _sess("s59", "Housekeeping", created="2026-08-23T00:00:00Z"),
        {"id": "s60", "feature": "New {thing} <v2>", "pr_url": "https://github.com/o/r/pull/400",
         "created_at": "2026-08-24T00:00:00Z", "status": "complete", "approach": "do it", "commits": ["abc feat"],
         "deferred": [], "decisions": ["keep"], "tags": ["x"]},
    ]
    report = gen.apply(sessions, tmp_path)
    names = sorted(p.name for p in tmp_path.glob("0*.md"))
    assert names == ["059-hk.md", "060-new-thing-v2.md"]
    new = (tmp_path / "060-new-thing-v2.md").read_text(encoding="utf-8")
    assert "registry_id: s60" in new and "generated: true" in new and "slug: ship-s60" in new
    assert "sidebar_position: 60" in new and "New \\{thing\\} \\<v2\\>" in new and "[#400]" in new
    assert report.created == ["060-new-thing-v2.md"] and report.stamped == [] and report.deleted == []

    again = gen.apply(sessions, tmp_path)
    assert again.created == [] and again.deleted == []
    assert (tmp_path / "060-new-thing-v2.md").read_text(encoding="utf-8") == new


def test_apply_deletes_only_generated_orphans_and_rebuilds_on_readd(tmp_path):
    hand = _write(tmp_path, "040-hand.md", 'title: "Hand page"\nregistry_id: gone-1\n', "\n# keep me\n")
    _write(tmp_path, "060-old.md", 'title: "Old"\nregistry_id: gone-2\ngenerated: true\nsidebar_position: 60\n')
    # Without --prune an orphan is REPORTED, never unlinked (a short fetch must not wipe pages).
    dry = gen.apply([], tmp_path)
    assert dry.deleted == ["060-old.md"] and (tmp_path / "060-old.md").exists()
    first = gen.apply([], tmp_path, prune=True)
    assert first.deleted == ["060-old.md"] and hand.exists() and not (tmp_path / "060-old.md").exists()
    # same feature re-captured under a new id → exactly one page, carrying the NEW id, numbered after the hand page
    readd = gen.apply([_sess("new-2", "Old", created="2026-09-01T00:00:00Z")], tmp_path)
    assert readd.created == ["041-old.md"]
    assert "registry_id: new-2" in (tmp_path / "041-old.md").read_text(encoding="utf-8")
    assert sorted(p.name for p in tmp_path.glob("0*.md")) == ["040-hand.md", "041-old.md"]


def test_write_index_lists_every_page_once_ordered_by_number_then_filename(tmp_path):
    _write(tmp_path, "042-a-oauth.md", 'title: "eBay OAuth"\nsidebar_position: 42\npr_url: https://github.com/o/r/pull/90\n')
    _write(tmp_path, "042-stage2.md", 'id: 042-stage2\ntitle: "Stage 2"\n')
    _write(tmp_path, "060-new.md", 'title: "New"\nslug: ship-abcd1234\nregistry_id: abcd1234-x\ngenerated: true\n')
    gen.write_index(tmp_path, project_label="Portage")
    idx = (tmp_path / "index.md").read_text(encoding="utf-8")
    rows = [l for l in idx.splitlines() if l.startswith("| 0")]
    assert [r.split("|")[1].strip() for r in rows] == ["042", "042", "060"]
    assert "(042-a-oauth)" in rows[0] and "[#90]" in rows[0]
    assert "(042-stage2)" in rows[1]          # explicit id: wins as the doc path
    assert "(ship-abcd1234)" in rows[2]       # slug: wins as the doc path
    assert "Total: 3 sessions" in idx


def test_check_mode_writes_nothing_and_exits_nonzero_when_a_session_has_no_page(tmp_path, monkeypatch, capsys):
    _write(tmp_path, "001-a.md", 'title: "A"\nregistry_id: s1\n')
    monkeypatch.setattr(gen, "fetch_all", lambda base, project, limit=100: [_sess("s1", "A"), _sess("s2", "B missing")])
    before = sorted(p.name for p in tmp_path.iterdir())
    rc = gen.main(["--check", "--project", "portage", "--out", str(tmp_path), "--registry", "http://x"])
    assert rc == 1
    assert sorted(p.name for p in tmp_path.iterdir()) == before
    out = capsys.readouterr().out
    assert "B missing" in out and "s2" in out
    # in sync → 0
    monkeypatch.setattr(gen, "fetch_all", lambda base, project, limit=100: [_sess("s1", "A")])
    assert gen.main(["--check", "--project", "portage", "--out", str(tmp_path), "--registry", "http://x"]) == 0


def test_match_disambiguates_a_shared_pr_url_by_exact_title(tmp_path):
    pr = "https://github.com/o/r/pull/65"
    _write(tmp_path, "022-fix.md", f'title: "Code health week 1 — fixes"\npr_url: {pr}\n')
    _write(tmp_path, "024-review.md", f'title: "Full codebase code health review"\npr_url: {pr}\n')
    pages = gen.scan_existing(tmp_path)
    matched, unmatched = gen.match(
        [_sess("s22", "code health week 1 — fixes", pr=pr), _sess("s24", "Full codebase code health review", pr=pr)], pages)
    assert matched["s22"].path.name == "022-fix.md" and matched["s24"].path.name == "024-review.md" and unmatched == []


def test_match_fails_loud_when_two_pages_carry_the_same_registry_id(tmp_path):
    _write(tmp_path, "041-hand.md", 'title: "Stage 1"\nregistry_id: s41\n')
    _write(tmp_path, "052-gen.md", 'title: "Stage 1: long"\nregistry_id: s41\ngenerated: true\n')
    import pytest
    with pytest.raises(gen.AmbiguousMatch):
        gen.match([_sess("s41", "Stage 1: long")], gen.scan_existing(tmp_path))


def test_render_page_frontmatter_is_valid_yaml_while_body_is_mdx_escaped():
    s = {"id": "y1", "feature": 'Scan -> persist "quoted" {expr} <tag> C:\\path', "created_at": "2026-08-01T00:00:00Z"}
    text = gen.render_page(s, 7)
    fm = text.split("---")[1]
    assert 'title: "Scan -> persist \\"quoted\\" {expr} <tag> C:\\\\path"' in fm   # YAML double-quoted, no MDX backslashes
    assert "-\\>" not in fm
    assert "# Scan -\\> persist \"quoted\" \\{expr\\} \\<tag\\> C:\\path" in text    # body: MDX-escaped


def test_dedupe_never_collapses_sessions_without_a_pr_url():
    a = _sess("1", "Fix flaky test", created="2026-08-01T00:00:00Z")
    b = _sess("2", "Fix flaky test", created="2026-08-02T00:00:00Z")
    assert [s["id"] for s in gen.dedupe([a, b])] == ["1", "2"]


def test_write_index_escapes_pipes_in_titles_so_table_rows_stay_intact(tmp_path):
    _write(tmp_path, "010-bo.md", 'title: "Best Offer redesign | conflict healing"\nregistry_id: x\n')
    gen.write_index(tmp_path)
    row = [l for l in (tmp_path / "index.md").read_text().splitlines() if l.startswith("| 010")][0]
    assert row.replace("\\|", "").count("|") == 4 and "\\|" in row


def test_main_reports_a_registry_outage_clearly_and_exits_3(monkeypatch, tmp_path, capsys):
    import urllib.error
    def boom(base, project, limit=100):
        raise urllib.error.URLError("connection refused")
    monkeypatch.setattr(gen, "fetch_all", boom)
    rc = gen.main(["--check", "--out", str(tmp_path), "--registry", "http://down"])
    assert rc == 3
    assert "REGISTRY UNREACHABLE" in capsys.readouterr().out


def test_scan_existing_body_pr_fallback_reads_only_a_labeled_pr_line(tmp_path):
    _write(tmp_path, "050-a.md", 'title: "A"\n',
           "\n**Branch:** `x` | **PR:** [#106](https://github.com/o/r/pull/106) | **Merge:** `abc`\n\nSee also https://github.com/o/r/pull/999 for context.\n")
    _write(tmp_path, "051-b.md", 'title: "B"\n', "\nRelated: https://github.com/o/r/pull/999\n")
    a, b = gen.scan_existing(tmp_path)
    assert a.pr_url == "https://github.com/o/r/pull/106"
    assert b.pr_url is None


def test_render_page_with_only_required_fields_emits_no_optional_sections():
    text = gen.render_page({"id": "min-1", "feature": "Minimal", "created_at": "2026-08-01T00:00:00Z"}, 3)
    assert "## " not in text and "**Tags:**" not in text and "| **PR** | no PR recorded |" in text


def test_main_exits_2_with_guidance_on_an_ambiguous_match(monkeypatch, tmp_path, capsys):
    prefix = "x" * 70
    _write(tmp_path, "001-a.md", f'title: "{prefix} A"\n')
    _write(tmp_path, "002-b.md", f'title: "{prefix} B"\n')
    monkeypatch.setattr(gen, "fetch_all", lambda base, project, limit=100: [_sess("s1", f"{prefix} one"), _sess("s2", f"{prefix} two")])
    assert gen.main(["--check", "--out", str(tmp_path), "--registry", "http://x"]) == 2
    assert "AMBIGUOUS" in capsys.readouterr().out


def test_pr_label_accepts_a_pull_url_with_a_trailing_path_or_fragment():
    assert gen.pr_label("https://github.com/o/r/pull/317/files") == "[#317](https://github.com/o/r/pull/317/files)"
    assert gen.pr_label("https://github.com/o/r/pull/317#issuecomment-9") == "[#317](https://github.com/o/r/pull/317#issuecomment-9)"


def test_fetch_all_refuses_a_response_without_total_or_short_of_it(monkeypatch):
    import pytest
    monkeypatch.setattr(gen, "_http_get", lambda url, timeout: _page([("a", "2026-08-01T00:00:00Z")], 1).replace(b'"total": 1', b'"x": 1'))
    with pytest.raises(ValueError, match="total"):
        gen.fetch_all("http://reg", "portage", limit=2)
    pages = {0: _page([("a", "2026-08-01T00:00:00Z")], 3), 2: _page([], 3)}
    monkeypatch.setattr(gen, "_http_get", lambda url, timeout: pages[int(url.split("offset=")[1].split("&")[0])])
    with pytest.raises(ValueError, match="1 of 3"):
        gen.fetch_all("http://reg", "portage", limit=2)


def test_scan_existing_accepts_four_digit_numbers_and_crlf_frontmatter(tmp_path):
    (tmp_path / "1000-big.md").write_text('---\ntitle: "Big"\nregistry_id: big\n---\n# b\n', encoding="utf-8")
    (tmp_path / "012-crlf.md").write_bytes(b'---\r\ntitle: "Windows page"\r\nregistry_id: win\r\n---\r\n\r\n# body\r\n')
    pages = gen.scan_existing(tmp_path)
    assert [(p.number, p.title) for p in pages] == [(12, "Windows page"), (1000, "Big")]

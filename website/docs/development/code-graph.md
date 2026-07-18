---
id: code-graph
title: Code Knowledge Graph
sidebar_position: 5
---

# Code Knowledge Graph

A [graphify](https://github.com/dhg) knowledge graph of the Portage codebase —
nodes for modules, functions, docs, and concepts; edges for structural
relationships (imports, calls) plus LLM-inferred semantic links. 4,875 nodes /
6,775 edges across 712 communities as of 2026-07-17.

## Dashboard

| What | Where |
|------|-------|
| **Stack portal** (hub for all resources: docs, graph, wiki, KB search, ops) | [http://10.0.0.251:8018/portal/](http://10.0.0.251:8018/portal/) |
| Interactive graph | [http://10.0.0.251:8018/](http://10.0.0.251:8018/) (`graph.html`) |
| Written report (communities, god nodes, stats) | [GRAPH_REPORT.md](http://10.0.0.251:8018/GRAPH_REPORT.md) |
| Raw graph data | [graph.json](http://10.0.0.251:8018/graph.json) |
| Wiki (index + 722 articles as of 2026-07-17: one per community + god nodes) | [wiki/index.md](http://10.0.0.251:8018/wiki/index.md) |

Served by the `portage-graph` service (nginx:alpine, port **8018**) defined in
`docker-compose.yml`, read-only over `graphify-out/`. New graph builds appear
without a restart — the bind mount tracks the directory.

## Query from the terminal

```bash
graphify query "how does publish idempotency work?"   # BFS answer from the graph
graphify explain "apiUpload"                          # node + neighbors, plain language
graphify path "ScanFlow" "ebay-adapter"               # shortest path between nodes
```

## Keeping it fresh

```bash
/graphify /home/swebber64/DHG/portage --update   # incremental — only new/changed files
```

Semantic extraction runs on the Gemini backend (`GEMINI_API_KEY` from `.env`);
the 2026-07-10 incremental run re-extracted 418 files in ~3.5 minutes for
~355k input tokens. The wiki export (`/graphify <path> --wiki`) is fully
deterministic — zero LLM tokens, renders from the existing graph. Other
supported backends: kimi, openai, deepseek, claude-cli; Gemini is the standing
choice for bulk extraction (cost). `graphify-out/` is generated and gitignored
— the compose service expects it to exist on the host.

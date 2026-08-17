# ENGINEERINGOS GAP ANALYSIS

Version: 1.0
Date: 2026-08-16
Scope: EngineeringOS VS Code Extension (initial build)

## 1. Discovery Summary

The repository is **empty** (no commits, no source files). This is a greenfield build.
There is no existing implementation to preserve, modify, or remove.

## 2. Gap Categories

Legend:

| Priority | Meaning |
|---|---|
| CRITICAL | Blocks the core EngineeringOS loop; must exist for the product to work |
| HIGH | Required for a credible V1; directly serves the product promise |
| MEDIUM | Improves quality, UX, or coverage; can follow the core loop |
| LOW | Nice-to-have; explicitly out of V1 scope where noted |

## 3. Gap Register

### 3.1 Project Scaffolding

| Item | Status | Priority | Note |
|---|---|---|---|
| package.json (extension manifest) | MISSING | CRITICAL | contributions, commands, views, activation |
| tsconfig (strict TypeScript) | MISSING | CRITICAL | spec section 54 |
| Build tooling (esbuild) | MISSING | HIGH | fast extension builds |
| Test tooling (vitest) | MISSING | HIGH | spec section 55 |
| .gitignore / .vscodeignore | MISSING | MEDIUM | |

### 3.2 Core Model (spec sections 2, 5–20, 54)

| Item | Status | Priority | Note |
|---|---|---|---|
| TS interfaces for Map / MentalModel / Guardrails | MISSING | CRITICAL | |
| Zod JSON-schema validation | MISSING | CRITICAL | "JSON is canonical" principle |
| config.json schema + project identity | MISSING | HIGH | spec section 6 |
| Knowledge-type separation (fact/inference/assumption/…) | MISSING | HIGH | principle 3 |
| Evidence + confidence model | MISSING | HIGH | principles 4, sections 16–17 |

### 3.3 Storage (spec sections 5, 47, 48)

| Item | Status | Priority | Note |
|---|---|---|---|
| .engineeringos/ directory layout | MISSING | CRITICAL | |
| JSON canonical read/write | MISSING | CRITICAL | atomic, no partial writes |
| modelVersion + basedOnCommit | MISSING | HIGH | section 47 |
| snapshots/ history with diffs | MISSING | MEDIUM | section 48 |
| ADR storage + rendering | MISSING | HIGH | sections 46, 66 |
| evidence/ storage | MISSING | LOW | |

### 3.4 Analyzer (spec sections 31, 53)

| Item | Status | Priority | Note |
|---|---|---|---|
| Source scanner (files by pattern) | MISSING | CRITICAL | feeds sourceLocations, drift |
| Import/dependency scanner | MISSING | HIGH | powers dependency validation |
| Git integration (diff, current commit) | MISSING | HIGH | basedOnCommit, change observation |
| package.json dependency reader | MISSING | HIGH | dependency validator |

### 3.5 Engines (spec sections 23, 24, 30, 32, 34)

| Item | Status | Priority | Note |
|---|---|---|---|
| Guardrail engine + file/import/pattern validators | MISSING | CRITICAL | section 23 |
| Echo Signal generation | MISSING | CRITICAL | section 22 |
| Context engine + task analysis + retrieval | MISSING | CRITICAL | sections 24–27 |
| Impact analysis | MISSING | HIGH | section 30 |
| Drift detection (4 drift types) | MISSING | HIGH | section 32 |
| Verification engine (PASS/REVIEW/BLOCK) | MISSING | HIGH | section 34 |
| Model update proposal flow | MISSING | HIGH | section 33 |

### 3.6 Markdown Generation (spec sections 42–45)

| Item | Status | Priority | Note |
|---|---|---|---|
| map.md generator | MISSING | HIGH | |
| mental-model.md generator | MISSING | HIGH | |
| guardrails.md generator | MISSING | HIGH | |

### 3.7 UI (spec sections 36–41, 58)

| Item | Status | Priority | Note |
|---|---|---|---|
| Sidebar webview | MISSING | HIGH | overview/map/mental-model/guardrails |
| Onboarding flow | MISSING | HIGH | section 36 |
| Component viewer | MISSING | MEDIUM | section 39 |
| Command palette commands | MISSING | HIGH | section 41 |
| Ask EngineeringOS (model-grounded Q&A) | MISSING | MEDIUM | section 40 |
| Loading / empty / error states | MISSING | MEDIUM | section 61 |

### 3.8 Agent Adapters & MCP (spec sections 28, 29)

| Item | Status | Priority | Note |
|---|---|---|---|
| AgentAdapter abstraction | MISSING | HIGH | architecture first |
| Context package output (current-task.json) | MISSING | HIGH | section 26 |
| MCP tools | MISSING | LOW | architecture-ready only in V1 |

### 3.9 Testing (spec section 55)

| Item | Status | Priority | Note |
|---|---|---|---|
| Schema tests | MISSING | HIGH | |
| Guardrail tests | MISSING | HIGH | |
| Context retrieval tests | MISSING | HIGH | |
| Model tests | MISSING | HIGH | |
| Drift tests | MISSING | HIGH | |
| Verification tests | MISSING | HIGH | |
| Impact tests | MISSING | MEDIUM | |
| Regression tests | MISSING | MEDIUM | |
| Extension/integration tests | MISSING | LOW | manual + smoke in V1 |

### 3.10 Dogfooding (spec sections 56, 57)

| Item | Status | Priority | Note |
|---|---|---|---|
| .engineeringos for this repository | MISSING | HIGH | generated in this build |
| First dogfood violation experiment | MISSING | MEDIUM | |

## 4. Explicitly Out of V1 (spec section 63)

- Social / community features
- Mobile app
- Team chat
- Massive analytics
- Autonomous production deployment / operations
- Complicated enterprise billing
- Dozens of AI integrations (build the adapter seam, integrate none beyond context export)
- Generic chatbot (Ask EngineeringOS is model-grounded, not free-form)

## 5. Build Order

1. Scaffolding
2. Core models + schemas + validation
3. Storage (JSON canonical, versioning)
4. Analyzer (source + dependencies + git)
5. Map engine + markdown
6. Mental model engine + markdown
7. Guardrail engine + Echo Signals + markdown
8. Context engine
9. Impact analysis
10. Drift detection
11. Verification engine
12. Agent adapter seam + context package export
13. Extension wiring (commands, watchers, onboarding)
14. UI webview
15. Tests across engines
16. Build + typecheck + tests green
17. Dogfood: initialize .engineeringos on this repo

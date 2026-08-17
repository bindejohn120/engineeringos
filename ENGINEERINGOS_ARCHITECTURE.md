# ENGINEERINGOS ARCHITECTURE

Version: 1.0
Status: Implementation guide for the initial EngineeringOS VS Code extension build

## 1. Design Principles

1. **Pure core, thin shell.** All engineering logic lives in modules that never import `vscode`. The extension entry point and webview are the only places that touch the VS Code API.
2. **JSON is canonical.** The `.engineeringos/*.json` files are the source of truth. Markdown is generated and written into `.engineeringos/generated/`.
3. **Single persistence boundary.** Only the `storage` module reads/writes canonical JSON, so every write is validated, versioned, and snapshotted.
4. **Minimal relevant context.** Retrieval engines score relevance and compress; nothing injects the full model.
5. **Evidence-gated claims.** Verification and generation only claim what the data supports.

## 2. Module Layout

```
src/
├── extension.ts            # VS Code activation, commands, watchers, orchestration
├── core/
│   ├── types.ts            # All shared interfaces (Map, MentalModel, Guardrails, Config, ...)
│   ├── schemas.ts          # Zod schemas matching the types
│   ├── knowledge.ts        # KnowledgeType, Severity, Confidence helpers
│   └── errors.ts           # Error kinds
├── storage/
│   ├── repository.ts       # load/save for each artifact, atomic writes, versioning, snapshots
│   └── paths.ts            # .engineeringos layout resolution
├── analyzer/
│   ├── source.ts           # file inventory by glob, imports extraction
│   ├── dependencies.ts     # package.json dependency reader
│   └── git.ts              # commit hash, status, diff (git CLI)
├── map/
│   └── engine.ts           # build/update Engineering Map, resolve sourceLocations
├── mental-model/
│   └── engine.ts           # build/update Engineering Mental Model
├── guardrails/
│   ├── engine.ts           # orchestrate validators, produce Echo Signals
│   ├── validators.ts       # file-boundary, import, dependency, pattern validators
│   └── signals.ts          # Echo Signal model
├── context/
│   └── engine.ts           # task analysis, relevance retrieval, compression, package
├── impact/
│   └── engine.ts           # blast-radius prediction from map + mental model
├── drift/
│   └── engine.ts           # four drift types + update proposals
├── verification/
│   └── engine.ts           # aggregate PASS / REVIEW / BLOCK with evidence
├── markdown/
│   └── generator.ts        # map.md, mental-model.md, guardrails.md, ADR render
├── agents/
│   └── adapter.ts          # AgentAdapter abstraction + context package export
├── ui/
│   ├── sidebar.ts          # webview panel provider (vscode boundary)
│   └── webview/
│       ├── index.html      # shell + CSP
│       ├── styles.css      # premium visual system
│       └── app.js          # client logic, message protocol
└── tests/                  # vitest suites mirroring module layout
```

## 3. Data Flow

### 3.1 Onboarding
```
developer description
  → extension.ts (collect intent)
  → map/engine.ts (build components/relationships/workflows)
  → mental-model/engine.ts (build invariants/risks/unknowns/decisions)
  → guardrails/engine.ts (seed defaults)
  → storage/repository.ts (persist JSON, version, snapshot)
  → markdown/generator.ts (render generated .md)
```

### 3.2 Context Preparation
```
task text
  → context/engine.ts analyzeTask (tokenize intent)
  → relevance retrieval over map/model/guardrails (keyword + alias scoring)
  → compress to ContextPackage
  → agents/adapter.ts export → .engineeringos/generated/contexts/current-task.json
```

### 3.3 Change Verification
```
file change / command
  → analyzer (inventory + imports + git diff)
  → guardrails/engine.ts (run validators → Echo Signals)
  → drift/engine.ts (model vs code vs requirements vs guardrails)
  → verification/engine.ts (aggregate PASS / REVIEW / BLOCK + evidence)
  → ui webview render
```

### 3.4 Model Update
```
drift findings
  → proposal diff (added/changed/removed)
  → developer accept/reject
  → storage snapshot prior version
  → persist new JSON (modelVersion++)
  → regenerate markdown
```

## 4. Storage Contract

| File | Writer | Reader | Notes |
|---|---|---|---|
| `config.json` | storage | extension, ui | project identity |
| `map.json` | storage | map, context, impact, drift | canonical map |
| `mental-model.json` | storage | mental-model, context, impact, verification | canonical model |
| `guardrails.json` | storage | guardrail, context, verification | canonical guardrails |
| `decisions/ADR-*.md` | extension | mental-model | human-authored records |
| `snapshots/` | storage | restore | versioned prior states |
| `generated/*.md` | markdown generator | humans, git | regenerated, never hand-edited |
| `generated/contexts/current-task.json` | agents adapter | AI agents | latest context package |

Every write to a canonical artifact:
- validates against its zod schema,
- bumps `modelVersion`,
- stamps `updatedAt` and `basedOnCommit`,
- writes a snapshot of the prior version first.

## 5. Guardrail Engine

```
GuardrailRule (declarative)
  ├── scope: globs
  ├── allowedPatterns / forbiddenPatterns
  ├── severity: advisory | warning | blocking
  └── enforcement: validator kinds

Validators
  ├── FileBoundaryValidator
  ├── ImportValidator
  ├── DependencyValidator
  ├── PatternValidator
  ├── TypeScriptValidator (typecheck results)
  ├── TestValidator
  └── CustomValidator (extension API seam)

Violation → Echo Signal
  { rule, ruleId, severity, file, message, boundary?, suggestedCorrection }
```

Verification maps severities: `blocking → BLOCK`, `warning → REVIEW`, `advisory → PASS` (with note).

## 6. Context Engine

Scoring model:
- tokenize task text into stemmed keywords and phrases.
- score components by name/purpose/responsibility keyword overlap and relationship graph proximity.
- retrieve top-N components, their invariants, scoped guardrails, related decisions, risks, unknowns.
- attach verification plan from component invariants/guardrails.
- estimate tokens (`sum(chars)/4` heuristic).

Output: `ContextPackage` — never includes secrets, never includes unrelated subsystems.

## 7. Drift Engine

| Drift type | Detection |
|---|---|
| Model → Code | map component sourceLocations resolve to no files, or required imports missing |
| Code → Model | files/dirs exist that no component covers (unmapped surface) |
| Requirement → Implementation | requirement evidence list empty and status open, or affected components absent |
| Guardrail → Code | guardrail validators produce violations |

Findings → `UpdateProposal { added, changed, removed, confidence, evidence }`.

## 8. Verification Engine

Checks: requirements, architecture (map consistency), guardrails, invariants, tests presence.
Result per check: `PASS | REVIEW | BLOCK` plus evidence list and explicit `notVerified` list.
Aggregate: any BLOCK → BLOCK; else any REVIEW → REVIEW; else PASS.

## 9. Agent Adapter

```ts
interface AgentAdapter {
  getCapabilities(): string[];
  prepareContext(pkg: ContextPackage): AgentContext;
  sendContext(ctx: AgentContext): Promise<DeliveryResult>;
  receiveResponse(): AsyncIterable<AgentResponse>;
  receiveErrors(): AsyncIterable<EchoSignal>;
}
```

V1 implements `FileExportAdapter` (writes `current-task.json`). MCP surface is defined but not served.

## 10. UI / Webview Protocol

The webview is a static shell; the extension host is the state owner.

Messages (webview → host):
- `ready`, `command`, `getView`, `onboarding.submit`

Messages (host → webview):
- `state:overview`, `state:map`, `state:model`, `state:guardrails`,
- `verify.result`, `onboarding.progress`, `update.proposal`

Visual system: dark, premium, monospace accents, semantic severity colors (green/amber/red), clear empty/loading/error states.

## 11. Extension Lifecycle

1. `activate()` registers commands + sidebar provider + watchers (debounced).
2. On first open of a workspace without `.engineeringos/`, show onboarding.
3. Watchers debounce file changes → analyze → verify → report; drift findings become proposals.
4. `deactivate()` disposes subscriptions.

## 12. Testing Strategy

Vitest unit suites for: schemas, storage, analyzer, guardrails (incl. Echo Signals), context retrieval, impact, drift, verification, markdown, agents. Extension/webview behavior is exercised via a smoke check and manual test matrix in V1.

# EngineeringOS Upgrade Plan: 5/10 → 8.5/10

## Why the Current Output is Only 5/10

The root cause is simple: **the AI only touches the Blueprint**. The Map, Mental Model, and Guardrails are 100% deterministic templates. A one-liner project description ("yam marketplace for students") produces the same generic output as a detailed spec.

### Specific Failures

| Problem | Current | What's Needed |
|---|---|---|
| **Onboarding captures too little** | 10 fields (name, purpose, users, capabilities, stack) | 30+ fields including domain model, integrations, NFRs, compliance |
| **AI only enhances Blueprint** | Single `aiEnhanceBlueprint()` call | Multi-pass AI: domain model → invariants → guardrails → blueprint → threat model |
| **Map is generic** | 4 foundation components + per-capability services | Domain-specific entities, bounded contexts, integration adapters |
| **Mental Model is templated** | 6 hardcoded invariants, 5 decisions, 6 risks | AI-generated domain-specific invariants, state machines, failure modes |
| **Guardrails are all regex** | 14 pattern-based rules, same for every project | Stack-specific (NestJS, Prisma), domain-specific (payment, auth), semantic (N+1, timeouts) |
| **No workspace analysis** | `analyzeWorkspace()` exists but never called | Feed existing code patterns into onboarding |
| **No quality validation** | No way to know if documents are complete | Quality scoring with completeness, consistency, traceability checks |

---

## Phase 1: Foundation (Weeks 1-2) — 5/10 → 6.5/10

**Goal:** Connect existing workspace analysis to onboarding + replace single-shot AI with multi-pass pipeline.

### 1.1 Feed Workspace Analysis Into Onboarding

`src/engine.ts` has `analyzeWorkspace()` at line 88 but `buildOnboardingModel()` at line 96 never calls it.

**Changes:**
- `src/engine.ts`: Call `analyzeWorkspace()` at start of `buildOnboardingModel()`, build `WorkspaceHints` (detected framework, language, DB, modules, patterns, test ratio), pass into `createInitialMap()` and `createInitialMentalModel()`
- `src/core/types.ts`: Add `WorkspaceHints` interface
- `src/ui/sidebar.ts`: Pass workspace hints to engine

### 1.2 Multi-Pass AI Pipeline

Replace the single `aiEnhanceBlueprint()` call with a 5-pass pipeline.

**New files:**

| File | Purpose |
|---|---|
| `src/ai/pipeline.ts` | Orchestrate 5 AI passes with progress callbacks |
| `src/ai/domain-model.ts` | AI suggests entities, value objects, aggregates, bounded contexts |
| `src/ai/mental-model.ts` | AI generates domain-specific invariants, state machines, risks |
| `src/ai/guardrails.ts` | AI generates semantic and domain-specific guardrails |
| `src/ai/threat-model.ts` | AI runs STRIDE threat modeling |
| `src/ai/prompts.ts` | Centralized prompt templates with chain-of-thought reasoning |
| `src/ai/schemas.ts` | Zod schemas for all AI structured outputs |

**Pipeline flow:**
```
Pass 1: AI enhances Map (entities, relationships, components)
Pass 2: AI enhances MentalModel (invariants, state machines, risks)
Pass 3: AI enhances Guardrails (semantic, domain-specific)
Pass 4: AI enhances Blueprint (existing, improved prompts)
Pass 5: AI runs threat modeling + quality validation
```

### 1.3 Improved AI Prompts

Current prompt is a single paragraph. New prompts use:
- Chain-of-thought reasoning ("Think step-by-step: first identify X, then Y, then Z")
- Structured output with Zod validation on all responses
- `maxTokens: 16384` (up from 4096)
- Workspace hints injected into user message
- `temperature: 0.4` for domain model, `0.2` for guardrails

**Changes to `src/ai/provider.ts`:**
- Increase default timeout to 120s
- Add optional `completeStream?()` to `AIClient`

### 1.4 Backward Compatibility

- All new `OnboardingInput` fields are optional
- If AI is not configured, deterministic-only path works identically
- Existing `.engineeringos/` artifacts are not modified

---

## Phase 2: Multi-Phase Onboarding Wizard (Weeks 3-4) — 6.5/10 → 7.5/10

**Goal:** Replace the single form with a 5-step wizard that captures rich domain context.

### Wizard Phases

**Phase 1 — Project Basics** (existing, enhanced)
- Project name, purpose, users, capabilities
- Minimum 50-character purpose description
- Guidance text for capabilities

**Phase 2 — Domain Model** (NEW, AI-suggestable)
- Core entities (e.g. User, Yam, Order, Payment)
- Value objects (e.g. Money, Address, Email)
- Aggregate roots (e.g. Order contains OrderLines, ShippingInfo)
- Bounded contexts (e.g. Catalog, Ordering, Payment, Shipping)
- Key domain events (e.g. OrderPlaced, PaymentReceived, ItemShipped)
- "AI Suggest" button fills these from project description

**Phase 3 — Integration Map** (NEW, AI-suggestable)
- Auth provider (Custom JWT, Auth0, Firebase, Clerk, etc.)
- Payment providers (Stripe, PayPal, Flutterwave, M-Pesa)
- Notification providers (SendGrid, Twilio, Firebase Push)
- Storage providers (S3, GCS, Azure Blob)
- Other integrations (Elasticsearch, Redis, RabbitMQ)
- Integration contract details (API versions, webhook formats, SLAs)

**Phase 4 — Non-Functional Requirements** (NEW, AI-suggestable)
- Target latency (p95): < 50ms, < 100ms, < 250ms, < 500ms, < 1s
- Expected concurrent users: < 100, 100-1k, 1k-10k, 10k-100k, 100k+
- Target uptime: 99%, 99.9%, 99.99%, 99.999%
- Compliance: GDPR, HIPAA, PCI-DSS, SOC2, CCPA
- Data retention policy
- SLA requirements (RTO, RPO, support response times)

**Phase 5 — Architecture Preferences** (existing, enhanced)
- Architecture style (Auto/Clean/Modular Monolith/Microservices/Layered/Event-Driven)
- Security level (Baseline/Hardened/Regulated)
- Tech stack (language, runtime, framework, database)
- Additional requirements spec
- "AI Recommend" button suggests architecture based on domain + NFRs

### Implementation

| File | Changes |
|---|---|
| `src/ui/webview/wizard.ts` | NEW: Wizard phase definitions and HTML generation |
| `src/ui/webview/content.ts` | Replace `renderOnboarding()` with wizard UI |
| `src/ui/sidebar.ts` | Handle wizard messages, AI suggest handler |
| `src/engine.ts` | Extend `OnboardingInput` with 20+ new fields |

### Quick Setup Option

For users who want fast results: a "Quick Setup" button that skips phases 2-4 and uses AI to generate defaults from the project description alone.

---

## Phase 3: Domain-Aware Guardrails (Weeks 5-6) — 7.5/10 → 8.0/10

**Goal:** Replace hardcoded guardrails with intelligent, context-aware rules.

### 3.1 Guardrail Template Library

**New file: `src/guardrails/templates.ts`**

40+ guardrail templates organized by category:

**Framework-specific:**
- NestJS: Controller dependency rule, Module boundary enforcement
- Prisma: Transaction usage, raw query safety, migration guards
- Express: Middleware ordering, error handler placement
- Next.js: Server component data access, API route auth

**Domain-specific:**
- Payment: Amount immutability, idempotency key requirement, PCI tokenization
- Authentication: Token expiry enforcement, refresh rotation, session invalidation
- Inventory: Atomic decrement, stock reservation expiry, oversell prevention
- Notification: Delivery confirmation, retry limits, deduplication

**Performance:**
- N+1 query detection (DB queries inside loops)
- External call timeout required
- Connection pool configuration
- Response size limits

**Semantic:**
- Circuit breaker on external calls
- Retry budget enforcement
- Graceful degradation patterns
- Health check endpoint required

**Compliance (selected):**
- GDPR: PII annotation, right to erasure, data portability
- PCI-DSS: Card data isolation, encryption at rest, audit logging
- HIPAA: PHI access logging, minimum necessary access, encryption

### 3.2 Dynamic Guardrail Generation

**New file: `src/guardrails/generator.ts`**

```typescript
function generateContextualGuardrails(input: {
  frameworks: string[];
  databases: string[];
  domains: string[];
  compliance: string[];
  existingGuardrails: Guardrail[];
}): Guardrail[]
```

Selects applicable templates based on tech stack and domain, deduplicates against base guardrails, caps at 40 total.

### 3.3 Integration

- `src/engine.ts`: After `seedGuardrails()`, call `generateContextualGuardrails()`
- `src/guardrails/engine.ts`: Support new rule categories (`semantic`, `performance`, `domain`)

---

## Phase 4: Quality Validation + Polish (Weeks 7-8) — 8.0/10 → 8.5/10

**Goal:** Add measurable quality scoring so users know exactly how good their documents are.

### 4.1 Quality Score Engine

**New file: `src/quality/engine.ts`**

Evaluates each artifact on 4 dimensions:
- **Completeness**: Are all required fields populated? Do entities have properties?
- **Consistency**: Do relationships reference real components? Are IDs unique?
- **Traceability**: Does every requirement trace to a component? Every invariant to a guardrail?
- **Coverage**: Are all capabilities covered by components? All invariants by tests?

**Checks per artifact:**

| Artifact | Key Checks |
|---|---|
| **Map** | Every capability has a component, every component has failure modes, all relationship endpoints exist, workflows reference real components |
| **Mental Model** | Every invariant has enforcement + verification, every risk has mitigation, high-impact assumptions have evidence, state machines define invalid transitions |
| **Guardrails** | Every blocking invariant has a guardrail, no duplicate IDs, scope covers all source directories, domain-specific rules present |
| **Blueprint** | All 17 sections present, directives are actionable (not vague), tech stack is complete, roadmap has phases |

**Output:**
```typescript
{
  overall: 82,  // 0-100
  grade: 'B+',
  map: { score: 78, checks: [...], recommendations: [...] },
  mentalModel: { score: 85, checks: [...], recommendations: [...] },
  guardrails: { score: 80, checks: [...], recommendations: [...] },
  blueprint: { score: 88, checks: [...], recommendations: [...] }
}
```

### 4.2 Quality Dashboard in UI

- Progress bars per artifact in the sidebar overview
- Failing checks with remediation suggestions
- Quality trend over time (improving/declining)
- "Fix" buttons that trigger AI to address specific gaps

### 4.3 Quality-Gated Verification

- `engineeringos.verify` now includes quality scores
- Exit code 4 (NOT_VALIDATED) triggers when quality drops below threshold
- Quality regression detection on model updates

---

## Expected Results

| Metric | Current (5/10) | After Phase 1 (6.5/10) | After Phase 2 (7.5/10) | After Phase 3 (8.0/10) | After Phase 4 (8.5/10) |
|---|---|---|---|---|---|
| Domain entities | 1 (User) | 5-8 (AI-suggested) | 10-15 (user + AI) | 10-15 | 10-15 |
| Invariants | 6 (hardcoded) | 12-18 (AI-generated) | 12-18 | 15-22 (semantic) | 15-22 |
| Guardrails | 14 (all regex) | 14 + 6-10 AI | 14 + 6-10 AI | 25-40 (stack+domain aware) | 25-40 |
| Requirements | 5 (generic) | 8-12 (domain-aware) | 12-20 (user + AI) | 12-20 | 12-20 |
| Components | 4 generic | 6-10 (AI-enhanced) | 8-15 (user + AI) | 8-15 | 8-15 |
| Quality score | None | None | None | None | Measured (0-100) |
| Time to generate | ~3s | ~15-30s (5 AI calls) | ~20-40s | ~20-40s | ~25-45s |

---

## File Summary

### New Files (12)

| File | Lines | Phase |
|---|---|---|
| `src/ai/pipeline.ts` | 200 | 1 |
| `src/ai/domain-model.ts` | 150 | 1 |
| `src/ai/mental-model.ts` | 200 | 1 |
| `src/ai/guardrails.ts` | 150 | 1 |
| `src/ai/threat-model.ts` | 120 | 1 |
| `src/ai/prompts.ts` | 300 | 1 |
| `src/ai/schemas.ts` | 200 | 1 |
| `src/guardrails/templates.ts` | 300 | 3 |
| `src/guardrails/generator.ts` | 150 | 3 |
| `src/guardrails/compliance.ts` | 200 | 3 |
| `src/quality/engine.ts` | 400 | 4 |
| `src/ui/webview/wizard.ts` | 350 | 2 |

### Modified Files (8)

| File | Changes |
|---|---|
| `src/engine.ts` | Workspace hints, extended input, multi-pass AI, quality evaluation |
| `src/ai/blueprint.ts` | Refactor to use centralized prompts, increase maxTokens |
| `src/ai/provider.ts` | Increase timeout, optional streaming |
| `src/ui/sidebar.ts` | Wizard messages, AI suggest handler, quality display |
| `src/ui/webview/content.ts` | Wizard UI, quality dashboard, progress indicators |
| `src/core/types.ts` | WorkspaceHints, ArtifactQualityScore, extended OnboardingInput |
| `src/core/schemas.ts` | New Zod schemas |
| `src/guardrails/engine.ts` | Support new rule categories |

### Total Estimated Lines: ~3,200 new + ~800 modified

import type { Blueprint, BlueprintOptions, BlueprintSection } from '../core/types';

export interface BlueprintSeedInput {
  projectName: string;
  projectId: string;
  purpose: string;
  primaryUsers: string[];
  criticalCapabilities: string[];
  options?: BlueprintOptions;
}

export const ARCHITECTURE_STYLES = [
  'clean-architecture',
  'modular-monolith',
  'microservices',
  'layered',
  'event-driven'
] as const;

export const SECURITY_LEVELS = ['baseline', 'hardened', 'regulated'] as const;

function section(id: string, title: string, purpose: string, directives: string[]): BlueprintSection {
  return { id, title, purpose, directives };
}

export function buildBlueprint(input: BlueprintSeedInput): Blueprint {
  const options = input.options ?? {};
  const architectureStyle = resolveOption(options.architectureStyle, 'layered', ARCHITECTURE_STYLES as unknown as string[]);
  const securityLevel = resolveOption<Blueprint['securityLevel']>(options.securityLevel, 'baseline', SECURITY_LEVELS as unknown as string[]) as Blueprint['securityLevel'];
  const now = new Date().toISOString();

  const sections = buildSections(input, { architectureStyle, securityLevel });

  return {
    schemaVersion: '1.0',
    modelVersion: 0,
    updatedAt: now,
    basedOnCommit: null,
    projectId: input.projectId,
    projectName: input.projectName,
    version: '1.0',
    summary:
      `Engineering blueprint for ${input.projectName}: a ${architectureStyle.replace('-', ' ')} ` +
      `system delivering ${describeList(input.criticalCapabilities)} to ${describeList(input.primaryUsers) || 'its users'}. ` +
      `Comprises ${sections.length} framework sections that an AI coding agent must follow before, during, and after building.`,
    architectureStyle,
    securityLevel,
    techStack: {
      language: options.language ?? '',
      runtime: options.runtime ?? '',
      framework: options.framework ?? '',
      database: options.database ?? ''
    },
    sections,
    sourceSpec: options.sourceSpec,
    generatedAt: now
  };
}

function buildSections(
  input: BlueprintSeedInput,
  ctx: { architectureStyle: string; securityLevel: Blueprint['securityLevel'] }
): BlueprintSection[] {
  const caps = input.criticalCapabilities;
  const users = input.primaryUsers;
  const style = ctx.architectureStyle;
  const sec = ctx.securityLevel;

  const securityDirectives = baseSecurityDirectives();
  if (sec === 'hardened' || sec === 'regulated') securityDirectives.push(
    'All secrets MUST be injected at deploy time; never commit, log, or echo them.',
    'Requests MUST carry explicit authentication and authorization; default-deny on every endpoint.',
    'Security review MUST be part of the Definition of Done for any change touching auth, payments, or personal data.'
  );
  if (sec === 'regulated') securityDirectives.push(
    'Every security-relevant action MUST be written to an append-only, tamper-evident audit log.',
    'Personal data handling MUST follow documented retention, deletion, and consent policies.',
    'Dependencies MUST be pinned and continuously scanned; known-CVEs above the threshold BLOCK release.'
  );

  return [
    section(
      'mission',
      'Engineering Mission & Success Criteria',
      `Defines why ${input.projectName} exists and how its engineering will be judged.`,
      [
        `Deliver a production-grade ${input.projectName} that provides ${describeList(caps)} to ${describeList(users) || 'its users'}.`,
        'The system MUST be secure, organized, scalable, maintainable, and predictable — built to a senior/principal engineering bar.',
        'Every feature MUST ship with tests, observable behavior, and evidence that invariants still hold.',
        'The codebase MUST remain comprehensible to a new engineer within one day of onboarding.'
      ]
    ),
    section(
      'system-context',
      'System Context & Boundaries',
      'Establishes what is inside the system, what is outside, and how they interact.',
      [
        `Primary users: ${describeList(users) || 'to be confirmed by product'}.`,
        `Critical capabilities (in scope): ${describeList(caps)}.`,
        'Every capability MUST map to at least one component and one workflow in the Engineering Map.',
        'Out-of-scope capabilities MUST be explicit (no silent scope creep) — record them as rejected requirements or unknowns.',
        `System purpose: ${input.purpose}`
      ]
    ),
    section(
      'non-negotiables',
      'Non-Negotiable Engineering Constraints',
      'Hard constraints the AI agent cannot violate, enforced by EngineeringOS guardrails.',
      [
        'No secrets in code; configuration MUST come from validated environment variables.',
        'Client/entry code MUST NOT access the database directly — enforce the boundary with file-boundary guardrails.',
        'All state-changing operations MUST be idempotent or safe to retry.',
        'No empty catch blocks; errors MUST be typed, logged, and handled or deliberately rethrown.',
        'No `any`, no untyped boundaries, no dead code, no TODO/FIXME left in committed code.',
        'New behavior MUST be covered by automated tests before it is considered done.'
      ]
    ),
    section(
      'architecture',
      `Architecture & Layering (${style})`,
      `Defines the ${style} structure the AI agent MUST build within.`,
      styleDirectives(style)
    ),
    section(
      'module-boundaries',
      'Module Boundaries & Dependency Rules',
      'Prevents the "big ball of mud" and keeps dependency direction predictable.',
      [
        'Dependencies MUST point inward: entry/API → application/domain → repository → infrastructure. Never the reverse.',
        'Cross-module communication MUST go through explicit interfaces, never shared mutable singletons.',
        'No cycles between modules — the Engineering Map MUST remain a DAG; detect and break cycles immediately.',
        'Each module MUST own its data and expose a minimal public surface; everything else is private.',
        'Business logic MUST live in domain/application modules, NOT in controllers, routes, or UI code.'
      ]
    ),
    section(
      'data',
      'Data Architecture & Integrity',
      'Governs how data is stored, validated, migrated, and kept consistent.',
      [
        `Every capability persists through a repository owned by its module (store: ${input.options?.database || 'primary database'}).`,
        'Data validation MUST happen at the boundary: schemas at entry, invariants in the domain, constraints in storage.',
        'All schema changes MUST be versioned migrations; no ad-hoc DDL in application code.',
        'Transactions MUST be used for multi-step writes; no partial-state commits.',
        'Soft-delete or audit columns MUST be present for security-relevant entities.',
        'Indexes MUST cover the primary query paths; N+1 queries are a review-blocking defect.'
      ]
    ),
    section(
      'api-design',
      'API Design Contract',
      'Defines a predictable, versioned API surface for both UI and external consumers.',
      [
        'REST-style, resource-oriented endpoints with consistent plural nouns and HTTP verbs.',
        'APIs MUST be versioned and backward-compatible; breaking changes require a new version.',
        'Every request MUST be validated before touching business logic; malformed input returns a structured 4xx.',
        'Error responses MUST follow one envelope (code, message, requestId) — never leak stack traces.',
        'State-changing endpoints MUST accept idempotency keys and return consistent responses on retry.',
        'Pagination, filtering, and field selection MUST be explicit for list endpoints.'
      ]
    ),
    section(
      'security',
      `Security Posture (${sec})`,
      'The security requirements applied to every line of code the agent writes.',
      securityDirectives
    ),
    section(
      'error-handling',
      'Error Handling Strategy',
      'Makes failures predictable, diagnosable, and recoverable.',
      [
        'Fail fast and loud: validate inputs and assumptions at the boundary; never guess around bad data.',
        'Use typed errors/result types; the caller decides recovery — no exceptions for expected control flow.',
        'No empty catches; every catch MUST log, wrap, or rethrow with context.',
        'External system failures MUST be mapped to retryable vs non-retryable and handled accordingly.',
        'A single error taxonomy MUST be shared across the app so UI and APIs speak the same failure language.'
      ]
    ),
    section(
      'observability',
      'Observability, Logging & Tracing',
      'Ensures the system can be diagnosed in production without guesswork.',
      [
        'Structured, machine-readable logs ONLY via the logging module — no `console.log` in production paths.',
        'Every log line MUST carry correlation/trace context and be PII-safe.',
        'Critical flows MUST emit metrics (latency, error rate, saturation) and traces across module boundaries.',
        'Health, readiness, and dependency liveness endpoints MUST exist.',
        'Alerting MUST cover BLOCKING invariants, not noise: alert on user impact and resource exhaustion.'
      ]
    ),
    section(
      'testing',
      'Testing Strategy & Gates',
      'Defines the quality gates that separate "works locally" from "safe to merge".',
      [
        'Unit tests for domain logic (fast, deterministic, no I/O).',
        'Integration tests across boundaries with real repositories/external stubs.',
        'An EngineeringOS invariant MUST map to at least one automated test.',
        'Coverage gate: critical paths MUST be covered; untested code MUST NOT be called "done".',
        'CI MUST run lint, typecheck, tests, build, and EngineeringOS verification on every PR.'
      ]
    ),
    section(
      'performance',
      'Performance, Scalability & Reliability',
      'Keeps the system fast under load and resilient to failure.',
      [
        'Define latency budgets per workflow; paginate and stream rather than loading all data.',
        'Cache read-heavy paths with explicit invalidation; never cache sensitive/personal data carelessly.',
        'External calls MUST have timeouts, retries with backoff, and circuit breakers.',
        'State is safe under concurrency: atomic operations or optimistic locking; no lost updates.',
        'Scale-out paths MUST be stateless; mutable state lives in stores, not in process memory.'
      ]
    ),
    section(
      'maintainability',
      'Maintainability & Code Standards',
      'Keeps the codebase organized, consistent, and predictable as it grows.',
      [
        `Directory layout MUST mirror the ${style} layers; names are descriptive and consistent.`,
        'Small, single-purpose functions and modules; DRY within a module, explicit interfaces across modules.',
        'No magic values: constants with names; no floating literals in business logic.',
        'Code review is mandatory; every PR MUST pass the review checklist in the Definition of Done.',
        'Document public APIs and non-obvious decisions inline or in ADRs; keep documentation close to code.'
      ]
    ),
    section(
      'cicd',
      'Delivery & CI/CD',
      'Defines the pipeline from commit to production.',
      [
        'Environments: development, staging, production — parity of config and data handling.',
        'CI gates: lint → typecheck → tests → build → package → EngineeringOS verification.',
        'Deploys MUST be repeatable, immutable artifacts (no manual server edits).',
        'Rollback MUST be one action, with the previous artifact kept and restored automatically.',
        'Feature flags for risky rollouts; canary/blue-green for services with high blast radius.'
      ]
    ),
    section(
      'verification',
      'EngineeringOS Verification & Evidence Loop',
      'How the agent stays in sync with the model while building.',
      [
        'Before writing code, load the Engineering Map, Mental Model, Guardrails, and this Blueprint.',
        'After each change, run `engineeringos.verify` and resolve every BLOCKING finding before continuing.',
        'Record implemented requirements with test evidence so drift detection stays green.',
        'Update map.json/mental-model.json when reality diverges — the model is the source of truth the agent plans from.',
        'Never silence a guardrail finding; fix the root cause or justify a documented, reviewed exception.'
      ]
    ),
    section(
      'definition-of-done',
      'Definition of Done',
      'The checklist every task must satisfy before it is considered complete.',
      [
        'Code exists in the mapped module, follows the dependency rule, and passes lint + typecheck.',
        'All affected requirements and invariants are implemented and covered by automated tests.',
        'No security guardrail is violated; secrets and credentials are never in code.',
        'Errors are handled per the error taxonomy; behavior is observable via logs/metrics.',
        'EngineeringOS verification reports no BLOCKING findings for the change.',
        'The model is updated (components, requirements, evidence) to reflect the change.'
      ]
    ),
    section(
      'roadmap',
      'Phased Roadmap',
      'Sequencing so the agent builds in dependency order rather than feature-by-feature in a vacuum.',
      [
        'Phase 0 — Foundations: project skeleton, config, logging, errors, CI, and the mapped directory layout.',
        'Phase 1 — Data layer: migrations, repositories, and stores for each capability.',
        'Phase 2 — Domain: business rules, invariants, and workflows for each capability (in criticality order).',
        'Phase 3 — API & integration: endpoints, auth, validation, and external system adapters.',
        'Phase 4 — Hardening: load/security/reliability passes, observability, and the remaining invariants.',
        'Every phase ends with a green EngineeringOS verification and updated model evidence.'
      ]
    )
  ];
}

function baseSecurityDirectives(): string[] {
  return [
    'No secrets, keys, or credentials in code — use validated environment variables and a secret manager.',
    'Parameterized queries / ORM bindings ONLY; never concatenate user input into SQL or shell.',
    'Never `eval` or execute untrusted input; no dynamic code from user payloads.',
    'Every endpoint MUST authenticate and authorize; default-deny.',
    'Input validation at every boundary; enforce size limits and reject malformed payloads.',
    'Use TLS everywhere; never downgrade transport for convenience.',
    'Defend against OWASP Top 10: injection, broken auth, sensitive data exposure, XXE, SSRF, insecure deserialization.'
  ];
}

function styleDirectives(style: string): string[] {
  switch (style) {
    case 'clean-architecture':
      return [
        'Layers: adapters (http, persistence, external) → use cases (application) → domain entities → interfaces.',
        'Domain MUST have zero dependencies on frameworks, databases, or HTTP.',
        'Use cases orchestrate domain logic; adapters implement the interfaces; dependency inversion at every boundary.',
        'Everything outside the domain is a plugin — replaceable without touching business rules.'
      ];
    case 'modular-monolith':
      return [
        'One deployable application composed of vertical modules, one per capability.',
        'Modules communicate through explicit internal interfaces only; no shared mutable state.',
        'Module boundaries are enforced by file-boundary guardrails; a module owns its schema and data.',
        'Modules may be split into services later without rewrites because boundaries already exist.'
      ];
    case 'microservices':
      return [
        'One bounded-context service per capability, each owning its data store and API.',
        'Services communicate over explicit contracts (REST/gRPC/events) — never shared databases.',
        'Per-service CI/CD, health, logs, and metrics; a shared observability standard.',
        'Sagas/outbox for cross-service consistency; graceful degradation when dependencies fail.'
      ];
    case 'event-driven':
      return [
        'Domain events are the primary integration mechanism; producers and consumers are decoupled.',
        'Event schemas are versioned and validated; outbox pattern guarantees at-least-once delivery.',
        'Consumers MUST be idempotent; replay is always safe.',
        'Event-driven boundaries wrap an otherwise layered core so domain logic stays testable.'
      ];
    default:
      return [
        'Presentation → application → domain → infrastructure; dependency arrows point inward.',
        'Each capability gets a module with its own controllers, services, and repositories.',
        'Cross-cutting concerns (auth, config, logging, errors) live in shared foundation modules.',
        'No business logic in controllers; controllers translate requests, delegates, and shape responses.'
      ];
  }
}

function resolveOption<T>(value: string | undefined, fallback: T, allowed: string[]): T {
  if (value && allowed.includes(value)) return value as unknown as T;
  return fallback;
}

function describeList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function blueprintSummary(blueprint: Blueprint): string {
  const lines: string[] = [];
  lines.push(`# Engineering Blueprint — ${blueprint.projectName}`);
  lines.push('');
  lines.push(blueprint.summary);
  lines.push('');
  lines.push(`- Architecture: **${blueprint.architectureStyle}**`);
  lines.push(`- Security level: **${blueprint.securityLevel}**`);
  lines.push(`- Sections: ${blueprint.sections.length}`);
  return lines.join('\n');
}

import type { Guardrail } from '../core/types';

export interface GuardrailTemplate {
  id: string;
  name: string;
  category: 'security' | 'performance' | 'correctness' | 'architecture' | 'domain' | 'compliance';
  applicableFrameworks?: string[];
  applicableDatabases?: string[];
  applicableDomains?: string[];
  applicableCompliance?: string[];
  severity: Guardrail['severity'];
  rule: string;
  scope: string[];
  forbiddenPatterns: string[];
  enforcement: string[];
  reason: string;
  verification: string[];
}

export const GUARDRAIL_TEMPLATES: GuardrailTemplate[] = [
  // ─── Framework-specific: NestJS ────────────────────────────────────────────
  {
    id: 'tpl-nestjs-controller-di',
    name: 'NestJS: Controller dependency rule',
    category: 'architecture',
    applicableFrameworks: ['nestjs', 'nest'],
    severity: 'blocking',
    rule: 'Controllers must only depend on services, not other controllers or repositories directly.',
    scope: ['**/*.controller.ts'],
    forbiddenPatterns: [
      'Repository',
      'DataSource',
      'EntityManager',
    ],
    enforcement: [
      'Static analysis: controllers must not import from repository or DataSource modules',
    ],
    reason: 'Controllers handle HTTP concerns; data access must go through service layer for testability and separation of concerns.',
    verification: [
      'Verify controller files only import from @nestjs/common, their own module, and service files',
    ],
  },
  {
    id: 'tpl-nestjs-module-boundary',
    name: 'NestJS: Module boundary isolation',
    category: 'architecture',
    applicableFrameworks: ['nestjs', 'nest'],
    severity: 'warning',
    rule: 'Modules must not import services from other modules unless explicitly exported.',
    scope: ['**/*.module.ts'],
    forbiddenPatterns: [
      'import.*from.*\\.module[\'"]',
    ],
    enforcement: [
      'Static analysis: module files should only import from their own module or explicitly exported modules',
    ],
    reason: 'Cross-module imports without exports break encapsulation and create hidden coupling between features.',
    verification: [
      'Verify each module imports only from modules listed in its imports array',
    ],
  },
  {
    id: 'tpl-nestjs-no-db-in-controller',
    name: 'NestJS: No direct DB access in controller',
    category: 'correctness',
    applicableFrameworks: ['nestjs', 'nest'],
    severity: 'blocking',
    rule: 'Controllers must not call Prisma, TypeORM, or any ORM client directly.',
    scope: ['**/*.controller.ts'],
    forbiddenPatterns: [
      'PrismaClient',
      'getRepository',
      'createQueryBuilder',
      'prisma\\.',
    ],
    enforcement: [
      'AST scan: controller files must not contain ORM client method calls',
    ],
    reason: 'Direct database access in controllers bypasses business logic, validation, and transaction management.',
    verification: [
      'Grep controller files for ORM client usage patterns',
    ],
  },

  // ─── Framework-specific: Prisma ────────────────────────────────────────────
  {
    id: 'tpl-prisma-transaction',
    name: 'Prisma: Transaction usage for multi-step writes',
    category: 'correctness',
    applicableDatabases: ['prisma', 'postgresql', 'mysql'],
    severity: 'blocking',
    rule: 'Any function that performs more than one write operation must use $transaction or a Prisma interactive transaction.',
    scope: ['**/*.service.ts', '**/*.repository.ts'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern detection: find functions with multiple prisma.<model>.create/update/delete calls outside $transaction',
    ],
    reason: 'Multiple writes without a transaction leave the database in an inconsistent state if any step fails.',
    verification: [
      'Identify functions with 2+ Prisma write operations and verify they are wrapped in $transaction',
    ],
  },
  {
    id: 'tpl-prisma-raw-sql-safety',
    name: 'Prisma: Raw query safety',
    category: 'security',
    applicableDatabases: ['prisma'],
    severity: 'blocking',
    rule: 'Raw SQL queries must use parameterized inputs ($queryRawUnsafe with Prisma.sql template). Never interpolate user input into raw query strings.',
    scope: ['**/*.ts'],
    forbiddenPatterns: [
      'queryRaw\\(`[^`]*\\$\\{',
      '\\.execute\\([^)]*\\+',
    ],
    enforcement: [
      'Regex scan: detect string concatenation or template literal interpolation in raw SQL calls',
    ],
    reason: 'Unparameterized SQL queries are vulnerable to SQL injection attacks.',
    verification: [
      'Verify all $queryRaw and $queryRawUnsafe calls use Prisma.sql template tags',
    ],
  },
  {
    id: 'tpl-prisma-migration-guard',
    name: 'Prisma: Migration safety',
    category: 'correctness',
    applicableDatabases: ['prisma'],
    severity: 'warning',
    rule: 'Schema migrations that drop columns or tables must include a data migration step and a rollback plan.',
    scope: ['**/prisma/migrations/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Review: migration files containing DROP COLUMN or DROP TABLE must have corresponding documentation',
    ],
    reason: 'Destructive migrations without rollback plans risk permanent data loss.',
    verification: [
      'Check migration files for DROP statements and verify documentation exists',
    ],
  },

  // ─── Framework-specific: Express / Fastify ─────────────────────────────────
  {
    id: 'tpl-express-error-handler',
    name: 'Express/Fastify: Global error handler required',
    category: 'correctness',
    applicableFrameworks: ['express', 'fastify'],
    severity: 'blocking',
    rule: 'Every Express/Fastify application must have a global error-handling middleware as the last registered handler.',
    scope: ['**/app.ts', '**/server.ts', '**/index.ts'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern scan: verify presence of error handler middleware (4-arg function in Express, onError hook in Fastify)',
    ],
    reason: 'Unhandled errors cause silent failures, memory leaks, and poor debugging experience.',
    verification: [
      'Check main entry file for error handling middleware registration after route definitions',
    ],
  },
  {
    id: 'tpl-express-route-auth',
    name: 'Express/Fastify: Route auth guard',
    category: 'security',
    applicableFrameworks: ['express', 'fastify'],
    severity: 'blocking',
    rule: 'All API routes except explicitly public ones must have authentication middleware applied.',
    scope: ['**/routes/**', '**/*.routes.ts'],
    forbiddenPatterns: [],
    enforcement: [
      'AST scan: routes without auth middleware annotation or wrapper must be flagged',
    ],
    reason: 'Unprotected routes expose internal operations to unauthenticated users.',
    verification: [
      'Verify each route definition has an auth middleware or is marked as public',
    ],
  },

  // ─── Framework-specific: Next.js ───────────────────────────────────────────
  {
    id: 'tpl-nextjs-server-component-data',
    name: 'Next.js: Server component data access',
    category: 'correctness',
    applicableFrameworks: ['nextjs', 'next'],
    severity: 'warning',
    rule: 'Server components must fetch data directly; do not pass async data-fetching functions as props to client components.',
    scope: ['**/app/**/page.tsx', '**/components/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern scan: detect client components receiving data-fetching callbacks from server components',
    ],
    reason: 'Server components run on the server; passing server-only functions to client components causes serialization errors.',
    verification: [
      'Verify server components fetch data inline and pass only serializable data to client components',
    ],
  },
  {
    id: 'tpl-nextjs-api-auth',
    name: 'Next.js: API route authentication',
    category: 'security',
    applicableFrameworks: ['nextjs', 'next'],
    severity: 'blocking',
    rule: 'All API routes under app/api/ must validate authentication before processing requests.',
    scope: ['**/app/api/**/route.ts'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern scan: API route handlers must call auth validation before business logic',
    ],
    reason: 'API routes are publicly accessible endpoints; without auth checks, anyone can invoke backend operations.',
    verification: [
      'Verify each API route handler calls a session/token validation function at the start',
    ],
  },

  // ─── Domain-specific: Payment ──────────────────────────────────────────────
  {
    id: 'tpl-payment-amount-immutability',
    name: 'Payment: Amount immutability',
    category: 'domain',
    applicableDomains: ['payment', 'billing', 'checkout', 'commerce'],
    severity: 'blocking',
    rule: 'Payment amounts must be calculated once and never modified after the payment intent is created.',
    scope: ['**/payment/**', '**/checkout/**', '**/billing/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Code review: payment amount fields must not have setters or mutation after creation',
    ],
    reason: 'Mutable payment amounts enable fraud and accounting discrepancies.',
    verification: [
      'Verify payment amount is set at creation and never reassigned or mutated afterward',
    ],
  },
  {
    id: 'tpl-payment-idempotency',
    name: 'Payment: Idempotency key requirement',
    category: 'domain',
    applicableDomains: ['payment', 'billing', 'checkout', 'commerce'],
    severity: 'blocking',
    rule: 'All payment API calls must include a unique idempotency key to prevent duplicate charges.',
    scope: ['**/payment/**', '**/checkout/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern scan: payment API calls must pass an idempotencyKey parameter',
    ],
    reason: 'Network retries without idempotency keys cause duplicate charges and customer disputes.',
    verification: [
      'Verify every Stripe/payment provider API call includes an idempotency_key or equivalent',
    ],
  },
  {
    id: 'tpl-payment-pci-tokenization',
    name: 'Payment: PCI tokenization',
    category: 'domain',
    applicableDomains: ['payment', 'billing', 'checkout', 'commerce'],
    severity: 'blocking',
    rule: 'Card numbers (PAN) must never be stored in the application database; use payment provider tokens instead.',
    scope: ['**/*.ts'],
    forbiddenPatterns: [
      'cardNumber',
      'card_number',
      'pan',
      'cvv',
      'cvc',
    ],
    enforcement: [
      'Secret scan: detect card-related field names in models, schemas, and database migrations',
    ],
    reason: 'Storing card data directly violates PCI-DSS and exposes the business to massive liability.',
    verification: [
      'Verify no database schema or model contains raw card number fields',
    ],
  },
  {
    id: 'tpl-payment-no-card-logging',
    name: 'Payment: No card data in logs',
    category: 'domain',
    applicableDomains: ['payment', 'billing', 'checkout', 'commerce'],
    severity: 'blocking',
    rule: 'Log statements must never output card numbers, CVVs, or full card details.',
    scope: ['**/*.ts'],
    forbiddenPatterns: [
      'log.*cardNumber',
      'console.*cardNumber',
      'logger.*cardNumber',
      'log.*card_number',
    ],
    enforcement: [
      'Static scan: detect logging statements containing card-related identifiers',
    ],
    reason: 'Logging card data creates a PCI-DSS compliance violation and a data breach vector.',
    verification: [
      'Search all log statements for card-related field references',
    ],
  },

  // ─── Domain-specific: Authentication ───────────────────────────────────────
  {
    id: 'tpl-auth-token-expiry',
    name: 'Authentication: Token expiry enforcement',
    category: 'domain',
    applicableDomains: ['authentication', 'auth', 'identity'],
    severity: 'blocking',
    rule: 'JWT access tokens must have an expiry no longer than 15 minutes.',
    scope: ['**/auth/**', '**/token/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Config scan: JWT sign calls must include expiresIn ≤ 900 seconds',
    ],
    reason: 'Long-lived access tokens increase the window of exploitation if a token is compromised.',
    verification: [
      'Verify all JWT sign calls set expiresIn to 15 minutes or less',
    ],
  },
  {
    id: 'tpl-auth-refresh-rotation',
    name: 'Authentication: Refresh token rotation',
    category: 'domain',
    applicableDomains: ['authentication', 'auth', 'identity'],
    severity: 'blocking',
    rule: 'Refresh tokens must be rotated on each use; old refresh tokens must be invalidated after use.',
    scope: ['**/auth/**', '**/token/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Logic review: refresh endpoint must generate new token and revoke the old one atomically',
    ],
    reason: 'Without rotation, a stolen refresh token provides indefinite access.',
    verification: [
      'Verify refresh flow creates new token, invalidates old token, and stores new token family',
    ],
  },
  {
    id: 'tpl-auth-session-invalidation',
    name: 'Authentication: Session invalidation on logout',
    category: 'domain',
    applicableDomains: ['authentication', 'auth', 'identity'],
    severity: 'warning',
    rule: 'Logout must invalidate the current session and all associated refresh tokens server-side.',
    scope: ['**/auth/**', '**/session/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Code review: logout handler must call session.destroy or equivalent server-side revocation',
    ],
    reason: 'Client-only logout leaves the session valid for reuse if the token is intercepted.',
    verification: [
      'Verify logout endpoint performs server-side session/token revocation',
    ],
  },
  {
    id: 'tpl-auth-password-hashing',
    name: 'Authentication: Password hashing',
    category: 'domain',
    applicableDomains: ['authentication', 'auth', 'identity'],
    severity: 'blocking',
    rule: 'Passwords must be hashed with bcrypt (cost ≥ 12), scrypt, or argon2 before storage.',
    scope: ['**/auth/**', '**/user/**'],
    forbiddenPatterns: [
      'createHash\\(\'md5',
      'createHash\\(\'sha1',
      'createHash\\(\'sha256',
      'crypto\\.md5',
      'crypto\\.sha1',
    ],
    enforcement: [
      'Secret scan: detect use of MD5, SHA-1, or SHA-256 for password hashing',
    ],
    reason: 'Fast hash algorithms are vulnerable to brute-force and rainbow table attacks.',
    verification: [
      'Verify password hashing uses bcrypt, scrypt, or argon2 with appropriate cost factors',
    ],
  },

  // ─── Domain-specific: Inventory ────────────────────────────────────────────
  {
    id: 'tpl-inventory-atomic-decrement',
    name: 'Inventory: Atomic stock decrement',
    category: 'domain',
    applicableDomains: ['inventory', 'stock', 'commerce', 'e-commerce'],
    severity: 'blocking',
    rule: 'Stock decrements must use atomic database operations (UPDATE ... WHERE stock > 0) to prevent overselling.',
    scope: ['**/inventory/**', '**/stock/**', '**/order/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern scan: stock decrement must use WHERE quantity > 0 or similar atomic condition',
    ],
    reason: 'Read-modify-write patterns on stock create race conditions that lead to overselling.',
    verification: [
      'Verify stock decrement queries use atomic WHERE conditions rather than read-then-write',
    ],
  },
  {
    id: 'tpl-inventory-reservation-expiry',
    name: 'Inventory: Stock reservation expiry',
    category: 'domain',
    applicableDomains: ['inventory', 'stock', 'commerce', 'e-commerce'],
    severity: 'warning',
    rule: 'Stock reservations must have an expiry (TTL); unredeemed reservations must be automatically released.',
    scope: ['**/inventory/**', '**/reservation/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: reservation records must include an expiresAt field and a cleanup mechanism',
    ],
    reason: 'Permanent reservations without expiry permanently reduce available stock for abandoned orders.',
    verification: [
      'Verify reservation schema has an expiry field and a scheduled job or TTL index clears expired reservations',
    ],
  },
  {
    id: 'tpl-inventory-oversell-prevention',
    name: 'Inventory: Oversell prevention',
    category: 'domain',
    applicableDomains: ['inventory', 'stock', 'commerce', 'e-commerce'],
    severity: 'blocking',
    rule: 'Order placement must check and decrement stock within a single transaction; never allow negative stock.',
    scope: ['**/order/**', '**/checkout/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Logic review: order creation must be wrapped in a transaction that validates stock availability',
    ],
    reason: 'Separating stock check and decrement creates a race window for overselling.',
    verification: [
      'Verify order creation uses a transaction that atomically validates and decrements stock',
    ],
  },

  // ─── Domain-specific: Notification ─────────────────────────────────────────
  {
    id: 'tpl-notification-delivery-confirm',
    name: 'Notification: Delivery confirmation',
    category: 'domain',
    applicableDomains: ['notification', 'messaging', 'communication'],
    severity: 'warning',
    rule: 'Critical notifications (password reset, 2FA, payment confirmation) must track delivery status.',
    scope: ['**/notification/**', '**/email/**', '**/sms/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: notification records must include a deliveryStatus field',
    ],
    reason: 'Without delivery tracking, there is no way to know if critical notifications reached the user.',
    verification: [
      'Verify notification records include delivery status and error handling for failed deliveries',
    ],
  },
  {
    id: 'tpl-notification-retry-limits',
    name: 'Notification: Retry limits',
    category: 'domain',
    applicableDomains: ['notification', 'messaging', 'communication'],
    severity: 'warning',
    rule: 'Notification retry mechanisms must have a maximum retry count (≤ 5) and exponential backoff.',
    scope: ['**/notification/**', '**/email/**', '**/sms/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern scan: retry loops must have a bounded iteration count',
    ],
    reason: 'Unbounded retries exhaust resources and can cause cascading failures in notification providers.',
    verification: [
      'Verify retry logic has a maximum count and uses exponential backoff with jitter',
    ],
  },
  {
    id: 'tpl-notification-deduplication',
    name: 'Notification: Deduplication',
    category: 'domain',
    applicableDomains: ['notification', 'messaging', 'communication'],
    severity: 'warning',
    rule: 'Notification sends must be deduplicated using a unique key per event type and entity.',
    scope: ['**/notification/**', '**/email/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: notification dispatch must check for existing pending notifications with the same key',
    ],
    reason: 'Duplicate notifications degrade user trust and waste provider quota.',
    verification: [
      'Verify notification dispatch includes a deduplication check before sending',
    ],
  },

  // ─── Performance ───────────────────────────────────────────────────────────
  {
    id: 'tpl-perf-n1-query',
    name: 'Performance: N+1 query detection',
    category: 'performance',
    severity: 'warning',
    rule: 'Database queries must not be executed inside loops. Use batch queries, joins, or eager loading.',
    scope: ['**/*.service.ts', '**/*.repository.ts'],
    forbiddenPatterns: [
      'await.*prisma\\.',
      'await.*query\\(',
      'await.*findOne\\(',
      'await.*findMany\\(',
    ],
    enforcement: [
      'AST scan: detect database query calls inside for/while/forEach/map loops',
    ],
    reason: 'N+1 queries cause exponential performance degradation as data volume grows.',
    verification: [
      'Identify query calls inside loop bodies and verify they are replaced with batch operations',
    ],
  },
  {
    id: 'tpl-perf-external-timeout',
    name: 'Performance: External call timeout required',
    category: 'performance',
    severity: 'blocking',
    rule: 'All external HTTP calls, database queries, and message queue operations must have explicit timeouts.',
    scope: ['**/*.ts'],
    forbiddenPatterns: [
      'fetch\\(',
      'axios\\.get\\(',
      'axios\\.post\\(',
      'http\\.get\\(',
    ],
    enforcement: [
      'AST scan: external call functions must include a timeout option',
    ],
    reason: 'Without timeouts, a single slow external service can block all threads and crash the application.',
    verification: [
      'Verify all fetch, axios, and HTTP calls include a timeout parameter',
    ],
  },
  {
    id: 'tpl-perf-connection-pool',
    name: 'Performance: Connection pool configuration',
    category: 'performance',
    severity: 'warning',
    rule: 'Database connection pools must have min and max limits configured.',
    scope: ['**/database/**', '**/db/**', '**/prisma/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Config scan: database configuration must specify pool size limits',
    ],
    reason: 'Unbounded connection pools exhaust database connections under load and cause connection refused errors.',
    verification: [
      'Verify database config includes connection pool min and max settings',
    ],
  },
  {
    id: 'tpl-perf-response-size',
    name: 'Performance: Response size limits',
    category: 'performance',
    severity: 'warning',
    rule: 'API responses returning lists must implement pagination. Unbounded result sets are forbidden.',
    scope: ['**/*.controller.ts', '**/routes/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern scan: GET endpoints returning arrays must accept pagination parameters',
    ],
    reason: 'Unbounded responses consume excessive memory and network bandwidth, and degrade client performance.',
    verification: [
      'Verify list-returning endpoints support limit/offset or cursor-based pagination',
    ],
  },
  {
    id: 'tpl-perf-missing-index',
    name: 'Performance: Missing index warning',
    category: 'performance',
    severity: 'warning',
    rule: 'Fields used in WHERE clauses, JOIN conditions, or ORDER BY must be indexed.',
    scope: ['**/prisma/schema.prisma', '**/*.entity.ts', '**/*.model.ts'],
    forbiddenPatterns: [],
    enforcement: [
      'Schema review: fields referenced in queries must appear in database indexes',
    ],
    reason: 'Missing indexes cause full table scans that degrade performance linearly with data growth.',
    verification: [
      'Cross-reference query WHERE/JOIN fields against schema index definitions',
    ],
  },
  {
    id: 'tpl-perf-unbounded-query',
    name: 'Performance: Unbounded query warning',
    category: 'performance',
    severity: 'warning',
    rule: 'Database queries without LIMIT, pagination, or date range filters must be flagged for review.',
    scope: ['**/*.service.ts', '**/*.repository.ts'],
    forbiddenPatterns: [
      'findMany\\(\\{\\s*\\}\\)',
      'findAll\\(\\)',
      'select\\*.*from(?!.*limit)',
    ],
    enforcement: [
      'AST scan: findMany/findAll calls without take/limit/skip parameters',
    ],
    reason: 'Queries without bounds return unbounded result sets that grow over time and cause memory exhaustion.',
    verification: [
      'Verify all data-fetching queries include limit, pagination, or date-range filters',
    ],
  },
  {
    id: 'tpl-perf-batch-operations',
    name: 'Performance: Batch database operations',
    category: 'performance',
    severity: 'advisory',
    rule: 'Bulk inserts and updates must use batch operations (createMany, upsertMany) instead of individual inserts in loops.',
    scope: ['**/*.service.ts', '**/*.repository.ts', '**/seeds/**'],
    forbiddenPatterns: [],
    enforcement: [
      'AST scan: detect individual insert/update calls inside loops',
    ],
    reason: 'Individual inserts in loops execute N separate SQL statements instead of a single batched statement.',
    verification: [
      'Verify bulk data operations use createMany or equivalent batch APIs',
    ],
  },

  // ─── Security ──────────────────────────────────────────────────────────────
  {
    id: 'tpl-sec-cors',
    name: 'Security: CORS policy enforcement',
    category: 'security',
    severity: 'blocking',
    rule: 'CORS must be configured with an explicit allowlist of origins. Wildcard (*) origin is forbidden in production.',
    scope: ['**/app.ts', '**/server.ts', '**/main.ts'],
    forbiddenPatterns: [
      'origin:\\s*[\'"]\\*[\'"]',
      'Access-Control-Allow-Origin:\\s*\\*',
    ],
    enforcement: [
      'Config scan: CORS configuration must not use wildcard origin',
    ],
    reason: 'Wildcard CORS allows any website to make authenticated requests to the API, enabling CSRF and data theft.',
    verification: [
      'Verify CORS config uses an explicit origin allowlist and not *',
    ],
  },
  {
    id: 'tpl-sec-rate-limiting',
    name: 'Security: Rate limiting configuration',
    category: 'security',
    severity: 'blocking',
    rule: 'All public API endpoints must have rate limiting applied.',
    scope: ['**/*.controller.ts', '**/routes/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: global rate limiter middleware or per-route rate limits must be configured',
    ],
    reason: 'Without rate limiting, APIs are vulnerable to brute-force attacks, denial of service, and resource exhaustion.',
    verification: [
      'Verify rate limiting middleware is applied globally or per-route',
    ],
  },
  {
    id: 'tpl-sec-input-validation',
    name: 'Security: Input validation at boundary',
    category: 'security',
    severity: 'blocking',
    rule: 'All external inputs (request body, query params, path params, headers) must be validated using a schema validator (Zod, Joi, class-validator) before processing.',
    scope: ['**/*.controller.ts', '**/routes/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern scan: controller/route handlers must apply validation middleware or schema checks',
    ],
    reason: 'Unvalidated input is the root cause of injection attacks, type confusion, and unexpected behavior.',
    verification: [
      'Verify each endpoint has a validation schema applied to its input parameters',
    ],
  },
  {
    id: 'tpl-sec-csp',
    name: 'Security: Content Security Policy',
    category: 'security',
    severity: 'warning',
    scope: ['**/*.html', '**/views/**'],
    forbiddenPatterns: [
      'unsafe-inline',
      'unsafe-eval',
    ],
    rule: 'HTML responses must include a Content-Security-Policy header or meta tag that disallows unsafe-inline and unsafe-eval.',
    enforcement: [
      'Header scan: CSP header must not include unsafe-inline or unsafe-eval directives',
    ],
    reason: 'Unsafe-inline and unsafe-eval in CSP defeat XSS protections and allow script injection.',
    verification: [
      'Verify CSP header is set and does not contain unsafe-inline or unsafe-eval',
    ],
  },
  {
    id: 'tpl-sec-file-upload-limit',
    name: 'Security: File upload size limit',
    category: 'security',
    severity: 'blocking',
    rule: 'File upload endpoints must enforce a maximum file size (≤ 10MB by default) and validate file type against an allowlist.',
    scope: ['**/*.controller.ts', '**/upload/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Pattern scan: file upload middleware must configure limits.fileSize and limits.allowedMimeTypes',
    ],
    reason: 'Unlimited file uploads enable denial of service through disk exhaustion and potential malware upload.',
    verification: [
      'Verify upload middleware enforces size limits and validates file types against an allowlist',
    ],
  },
  {
    id: 'tpl-sec-xss-prevention',
    name: 'Security: XSS prevention (output encoding)',
    category: 'security',
    severity: 'blocking',
    rule: 'All user-provided data rendered in HTML must be escaped. Use template engines with auto-escaping or explicit encoding functions.',
    scope: ['**/*.html', '**/*.tsx', '**/*.jsx', '**/views/**'],
    forbiddenPatterns: [
      'dangerouslySetInnerHTML',
      'innerHTML\\s*=',
      'document\\.write\\(',
      '\\.html\\(',
    ],
    enforcement: [
      'Static scan: detect dangerouslySetInnerHTML, innerHTML assignment, and document.write usage',
    ],
    reason: 'Unescaped user data in HTML enables cross-site scripting attacks that steal credentials and session tokens.',
    verification: [
      'Verify no user input is injected into DOM without encoding',
    ],
  },

  // ─── Compliance: GDPR ──────────────────────────────────────────────────────
  {
    id: 'tpl-compliance-gdpr-pii',
    name: 'GDPR: PII annotation and handling',
    category: 'compliance',
    applicableCompliance: ['gdpr'],
    severity: 'warning',
    rule: 'All fields containing personally identifiable information must be annotated with @PII and handled according to GDPR Article 5.',
    scope: ['**/*.entity.ts', '**/*.model.ts', '**/prisma/schema.prisma'],
    forbiddenPatterns: [],
    enforcement: [
      'Schema review: PII fields (name, email, phone, address, IP) must have explicit handling annotations',
    ],
    reason: 'GDPR requires organizations to identify and document all personal data processing activities.',
    verification: [
      'Verify PII fields are annotated and documented in data processing records',
    ],
  },
  {
    id: 'tpl-compliance-gdpr-erasure',
    name: 'GDPR: Right to erasure implementation',
    category: 'compliance',
    applicableCompliance: ['gdpr'],
    severity: 'blocking',
    rule: 'Systems storing personal data must implement a data erasure endpoint that removes PII within 30 days of request.',
    scope: ['**/user/**', '**/account/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: user/account modules must expose an erasure/deletion endpoint',
    ],
    reason: 'GDPR Article 17 gives data subjects the right to have their personal data erased.',
    verification: [
      'Verify erasure endpoint exists, removes PII from all tables, and logs the deletion',
    ],
  },
  {
    id: 'tpl-compliance-gdpr-portability',
    name: 'GDPR: Data portability export',
    category: 'compliance',
    applicableCompliance: ['gdpr'],
    severity: 'warning',
    rule: 'Systems must provide a machine-readable export of user data (JSON or CSV) upon request.',
    scope: ['**/user/**', '**/account/**', '**/export/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: user/account modules must expose a data export endpoint',
    ],
    reason: 'GDPR Article 20 gives data subjects the right to receive their personal data in a structured, machine-readable format.',
    verification: [
      'Verify export endpoint generates JSON or CSV of all user-associated data',
    ],
  },

  // ─── Compliance: PCI-DSS ───────────────────────────────────────────────────
  {
    id: 'tpl-compliance-pci-card-isolation',
    name: 'PCI-DSS: Card data isolation',
    category: 'compliance',
    applicableCompliance: ['pci-dss', 'pci'],
    severity: 'blocking',
    rule: 'Cardholder data must only be stored in PCI-compliant vaults. Application databases must never store raw card data.',
    scope: ['**/*.entity.ts', '**/*.model.ts', '**/prisma/schema.prisma'],
    forbiddenPatterns: [
      'cardNumber',
      'card_number',
      'pan',
      'expMonth',
      'expYear',
      'cvv',
    ],
    enforcement: [
      'Schema scan: detect card-related fields in application database schemas',
    ],
    reason: 'PCI-DSS Requirement 3 prohibits storage of sensitive authentication data and cardholder data in application systems.',
    verification: [
      'Verify no application schema contains raw card data fields',
    ],
  },
  {
    id: 'tpl-compliance-pci-encryption',
    name: 'PCI-DSS: Encryption at rest',
    category: 'compliance',
    applicableCompliance: ['pci-dss', 'pci'],
    severity: 'blocking',
    rule: 'Cardholder data must be encrypted at rest using AES-256 or equivalent strong encryption.',
    scope: ['**/config/**', '**/*.env*'],
    forbiddenPatterns: [],
    enforcement: [
      'Config review: database and storage configurations must enable encryption at rest',
    ],
    reason: 'PCI-DSS Requirement 3.4 requires cardholder data to be rendered unreadable anywhere it is stored.',
    verification: [
      'Verify database encryption-at-rest is enabled and key management follows PCI requirements',
    ],
  },

  // ─── Compliance: HIPAA ─────────────────────────────────────────────────────
  {
    id: 'tpl-compliance-hipaa-phi-access',
    name: 'HIPAA: PHI access logging',
    category: 'compliance',
    applicableCompliance: ['hipaa'],
    severity: 'blocking',
    rule: 'All access to Protected Health Information must be logged with user identity, timestamp, and action performed.',
    scope: ['**/patient/**', '**/medical/**', '**/health/**', '**/phi/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: PHI access paths must include audit logging middleware',
    ],
    reason: 'HIPAA Security Rule §164.312(b) requires audit controls to record and examine access to ePHI.',
    verification: [
      'Verify PHI access endpoints have audit logging middleware that records user, time, and action',
    ],
  },
  {
    id: 'tpl-compliance-hipaa-minimum-necessary',
    name: 'HIPAA: Minimum necessary access',
    category: 'compliance',
    applicableCompliance: ['hipaa'],
    severity: 'blocking',
    rule: 'PHI queries must return only the minimum fields required for the operation. SELECT * on PHI tables is forbidden.',
    scope: ['**/patient/**', '**/medical/**', '**/health/**'],
    forbiddenPatterns: [
      'select\\s+\\*.*from.*patient',
      'select\\s+\\*.*from.*medical',
      'select\\s+\\*.*from.*health',
      '\\.findMany.*include:\\s*\\{[^}]*\\}',
    ],
    enforcement: [
      'Query review: PHI queries must specify explicit field lists',
    ],
    reason: 'HIPAA §164.502(b) requires access to PHI to be limited to the minimum necessary for the intended purpose.',
    verification: [
      'Verify PHI queries specify explicit field lists and do not use SELECT * or unrestricted includes',
    ],
  },

  // ─── Compliance: SOC2 ──────────────────────────────────────────────────────
  {
    id: 'tpl-compliance-soc2-access-review',
    name: 'SOC2: Access review automation',
    category: 'compliance',
    applicableCompliance: ['soc2'],
    severity: 'warning',
    rule: 'System access permissions must be reviewable through an automated access report endpoint.',
    scope: ['**/auth/**', '**/user/**', '**/admin/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: admin module must expose an access-report endpoint listing users and permissions',
    ],
    reason: 'SOC2 CC6.1 requires periodic review of logical access rights, which requires automated reporting.',
    verification: [
      'Verify an automated endpoint or script generates user-permission access reports',
    ],
  },
  {
    id: 'tpl-compliance-soc2-audit-trail',
    name: 'SOC2: Immutable audit trail',
    category: 'compliance',
    applicableCompliance: ['soc2'],
    severity: 'blocking',
    rule: 'Security-relevant events (login, permission changes, data access, configuration changes) must be written to an append-only audit log.',
    scope: ['**/auth/**', '**/admin/**', '**/config/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: security event handlers must write to audit log table or service',
    ],
    reason: 'SOC2 CC7.2 requires monitoring of system components for anomalies, which requires an immutable audit trail.',
    verification: [
      'Verify security events are logged to an append-only store with timestamp, actor, and action',
    ],
  },

  // ─── Compliance: CCPA ──────────────────────────────────────────────────────
  {
    id: 'tpl-compliance-ccpa-opt-out',
    name: 'CCPA: Data sale opt-out mechanism',
    category: 'compliance',
    applicableCompliance: ['ccpa'],
    severity: 'warning',
    rule: 'Systems that share user data with third parties must provide a Do Not Sell My Personal Information mechanism.',
    scope: ['**/user/**', '**/privacy/**', '**/consent/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: privacy module must expose an opt-out endpoint and preference storage',
    ],
    reason: 'CCPA §1798.120 gives consumers the right to opt out of the sale of their personal information.',
    verification: [
      'Verify opt-out endpoint exists, stores preference, and is checked before data sharing',
    ],
  },
  {
    id: 'tpl-compliance-ccpa-disclosure',
    name: 'CCPA: Data disclosure endpoint',
    category: 'compliance',
    applicableCompliance: ['ccpa'],
    severity: 'warning',
    rule: 'Users must be able to request a complete disclosure of all personal data collected about them.',
    scope: ['**/user/**', '**/privacy/**'],
    forbiddenPatterns: [],
    enforcement: [
      'Architecture review: privacy module must expose a data disclosure endpoint',
    ],
    reason: 'CCPA §1798.110 requires businesses to disclose the categories and specific pieces of personal information collected.',
    verification: [
      'Verify disclosure endpoint returns all collected personal data in a human-readable format',
    ],
  },

  // ─── TDD Enforcement ────────────────────────────────────────────────────
  {
    id: 'tpl-tdd-test-before-code',
    name: 'TDD: Tests must exist before implementation',
    category: 'correctness',
    severity: 'blocking',
    rule: 'Every implementation file must have a corresponding test file. No production code without a test.',
    scope: ['src/**', 'lib/**', 'app/**'],
    forbiddenPatterns: [],
    enforcement: ['CI: verify test files exist for all source files'],
    reason: 'Test-driven development requires tests to exist alongside or before production code. Code without tests is unverifiable.',
    verification: [
      'Verify each .ts/.js source file has a corresponding .test.ts/.test.js file',
    ],
  },
  {
    id: 'tpl-tdd-no-skip-test',
    name: 'TDD: No skipped or pending tests in production',
    category: 'correctness',
    severity: 'warning',
    rule: 'Test files must not contain skipped (.skip), pending (.only), or disabled (xit/xdescribe) tests in committed code.',
    scope: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
    forbiddenPatterns: [
      '\\.skip\\(',
      '\\.only\\(',
      '\\bxit\\(',
      '\\bxdescribe\\(',
      '\\bpending\\(',
    ],
    enforcement: ['CI: reject commits containing skipped tests'],
    reason: 'Skipped tests create false confidence. Every test must be active or explicitly removed, never hidden.',
    verification: [
      'Verify no .skip(), .only(), xit(), xdescribe(), or pending() calls exist in test files',
    ],
  },
  {
    id: 'tpl-tdd-assertion-minimum',
    name: 'TDD: Tests must have assertions',
    category: 'correctness',
    severity: 'warning',
    rule: 'Every test function must contain at least one assertion (expect/ assert/ should).',
    scope: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
    forbiddenPatterns: [],
    enforcement: ['CI: lint rule to verify assertions in test blocks'],
    reason: 'A test without assertions validates nothing. It runs code but never checks the result.',
    verification: [
      'Verify each test block contains at least one expect(), assert(), or should call',
    ],
  },
  {
    id: 'tpl-tdd-coverage-threshold',
    name: 'TDD: Minimum test coverage',
    category: 'correctness',
    severity: 'warning',
    rule: 'New code must maintain minimum 80% line coverage. Coverage configuration must exist.',
    scope: ['**/*.test.ts', '**/*.test.js', 'jest.config.*', 'vitest.config.*', '.nycrc*'],
    forbiddenPatterns: [],
    enforcement: ['CI: enforce coverage threshold in test runner config'],
    reason: 'Coverage thresholds ensure new code is actually tested, not just that test files exist.',
    verification: [
      'Verify test runner config exists with coverage threshold >= 80%',
    ],
  },
  {
    id: 'tpl-tdd-red-green-refactor',
    name: 'TDD: RED-GREEN-REFACTOR commit discipline',
    category: 'correctness',
    severity: 'advisory',
    rule: 'Implementation commits should follow RED-GREEN-REFACTOR: first commit adds failing test, second adds minimal passing code, third refactors.',
    scope: ['src/**', 'lib/**', 'app/**'],
    forbiddenPatterns: [],
    enforcement: ['Code review: verify test-first in commit history'],
    reason: 'RED-GREEN-REFACTOR ensures tests drive design, not afterthoughts. Each commit is either red, green, or refactor — never all three.',
    verification: [
      'Verify commit messages or PRs show test-first progression',
    ],
  },
];

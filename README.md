# EngineeringOS

Engineering intelligence for AI-powered software development. Gives AI coding agents a persistent engineering map, mental model, and enforceable guardrails.

## What It Does

EngineeringOS sits between you and AI coding agents, providing structured engineering context that prevents AI from making uninformed architectural decisions.

- **Engineering Map** — Auto-generated component architecture with dependencies, data flows, and requirements
- **Mental Model** — Domain invariants, state machines, business rules, and risk assessments
- **Guardrails** — Enforceable rules that catch violations before they ship
- **AI Brain** — Multi-pass AI pipeline that generates domain models, threat models, and quality assessments
- **Quality Engine** — 38 automated checks with weighted scoring and letter grades

## Quick Start

### Install from Source

```bash
git clone https://github.com/bindejohn120/engineeringos.git
cd engineeringos
npm install
npm run build
```

### Run in VS Code

1. Open the extension folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. The sidebar opens automatically with a 5-phase setup wizard
4. Fill in your project details and click **Build Model**

### Install CLI

```bash
npm install -g .
engineeringos verify
engineeringos health
engineeringos map
```

## Features

### 5-Phase Onboarding Wizard

| Phase | What You Provide | What Gets Generated |
|-------|-----------------|---------------------|
| **Basics** | Project name, purpose, users, capabilities | Foundation components, workflows, requirements |
| **Domain Model** | Entities, value objects, bounded contexts, events | Domain entity components, invariants, state machines |
| **Integrations** | Auth, payment, notification, storage providers | External system components with interfaces and failure modes |
| **NFRs** | Latency, concurrency, availability, compliance, threat level | Performance requirements, compliance guardrails, security decisions |
| **Architecture** | Style, language, framework, database | Architecture decisions, constraints, technology-specific guardrails |

Each phase has an **AI Suggest** button that calls Claude to generate suggestions based on your project description.

### AI Multi-Pass Pipeline

When AI is enabled, the pipeline runs 5 passes:

1. **Domain Model** — Entities, value objects, bounded contexts, domain events
2. **Mental Model** — Invariants, state machines, failure modes, risks
3. **Guardrails** — Semantic and domain-specific rules
4. **Blueprint** — Architecture sections and recommendations
5. **Threat Model** — STRIDE analysis with mitigations

### Quality Dashboard

After building, the sidebar shows a quality score card:

- **Grade** (A+ through F) based on 38 weighted checks
- **Per-artifact scores** for Map, Model, Guardrails, and Blueprint
- **Top recommendations** for improving your engineering model

### Domain-Aware Guardrails

48 guardrail templates organized by:

- **Framework** — NestJS, Prisma, Express, Next.js patterns
- **Domain** — Payment, auth, inventory, notification rules
- **Performance** — N+1 queries, timeout budgets, connection pools
- **Security** — CORS, rate limiting, CSP, input validation
- **Compliance** — GDPR, PCI-DSS, HIPAA, SOC2, CCPA (18 rules)

### Workspace Auto-Detection

When you run the wizard, EngineeringOS scans your workspace and auto-detects:

- Language (TypeScript, Python, Go, Java, C#)
- Runtime (Node.js, Python, Go)
- Framework (NestJS, Next.js, Angular, Vue, Express)
- Database (Prisma, Drizzle, Sequelize, TypeORM)
- Architecture style (layered vs microservices)

User-provided values always take priority.

### Commands

| Command | Description |
|---------|-------------|
| `EngineeringOS: Initialize Engineering Model` | Open the setup wizard |
| `EngineeringOS: Start New Project (Reset)` | Delete all artifacts and start fresh |
| `EngineeringOS: Show Overview` | Open sidebar to overview tab |
| `EngineeringOS: Verify Current Change` | Run guardrails and drift detection |
| `EngineeringOS: Generate Engineering Blueprint` | Regenerate the architecture document |
| `EngineeringOS: Analyze Repository` | Scan codebase for structure and security |
| `EngineeringOS: Run Executable Guardrails` | Check code against enforceable rules |
| `EngineeringOS: Health Report` | Compute engineering health score |

### CLI

```bash
engineeringos verify          # Run verification checks
engineeringos health          # Compute health score
engineeringos map             # Display component map
engineeringos mental-model    # Display mental model
engineeringos guardrails      # Display guardrails
engineeringos blueprint       # Display blueprint
engineeringos init            # Initialize state files
engineeringos rebuild         # Rebuild state deterministically
```

### Reset

Three ways to start a new project:

1. **Sidebar** — Overview → Quick Actions → ↺ Start New Project (Reset)
2. **Command Palette** — `Ctrl+Shift+P` → `EngineeringOS: Start New Project (Reset)`
3. **Confirmation dialog** warns before deleting all artifacts

## AI Configuration

Set your API key to enable AI features:

```json
// .engineeringos/config.json
{
  "ai": {
    "provider": "openrouter",
    "model": "anthropic/claude-sonnet-4",
    "enabled": true
  }
}
```

Or set the environment variable in `.vscode/launch.json`:

```json
{
  "env": {
    "OPENROUTER_API_KEY": "sk-or-..."
  }
}
```

Works with OpenRouter, OpenAI, and any compatible API.

## Architecture

```
src/
├── ai/              # AI pipeline, prompts, schemas, provider
├── analyzer/        # Source code analysis, git state
├── blueprint/       # Blueprint generation engine
├── ci/              # GitHub Actions, PR reports, hooks
├── cli/             # Command-line interface
├── context/         # Agent context packages
├── core/            # Types, schemas, IDs, protocol
├── decisions/       # ADR lifecycle
├── drift/           # Drift detection engine
├── engine.ts        # Core engine (onboarding, verification, impact)
├── extension.ts     # VS Code extension entry point
├── governance/      # Risk management
├── guardrails/      # Templates, generator, compliance, validators
├── health/          # Health scoring
├── impact/          # Impact analysis
├── invariants/      # Invariant registry
├── map/             # Component map engine
├── markdown/        # Markdown generators
├── mental-model/    # Mental model engine
├── quality/         # Quality validation engine (38 checks)
├── storage/         # Repository, paths, state persistence
├── test-intelligence/ # Test coverage matrix
├── ui/              # Sidebar, webview, wizard
└── verification/    # Verification engine
```

## Tests

```bash
npm test              # Run all tests
npx vitest run        # Run tests with vitest
```

215 tests across 36 test files covering core logic, AI pipeline, quality engine, guardrails, and UI.

## License

MIT

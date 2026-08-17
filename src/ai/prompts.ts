export interface DomainModelPromptInput {
  projectName: string;
  purpose: string;
  primaryUsers: string[];
  criticalCapabilities: string[];
  architectureStyle?: string;
  language?: string;
  framework?: string;
  database?: string;
}

export function buildDomainModelPrompt(input: DomainModelPromptInput): { system: string; user: string } {
  const system = [
    'You are the chief architect of EngineeringOS. Generate a Domain-Driven Design domain model for the described system.',
    'Respond with STRICT JSON only, matching exactly:',
    JSON.stringify(
      {
        entities: [
          {
            name: 'EntityName',
            description: 'what this entity represents',
            properties: [{ name: 'propertyName', type: 'string', required: true }],
            relationships: [{ target: 'OtherEntity', type: 'has-many', description: 'relationship description' }]
          }
        ],
        valueObjects: [{ name: 'ValueObjectName', properties: [{ name: 'propertyName', type: 'string' }] }],
        boundedContexts: [{ name: 'ContextName', description: 'what this context covers', entities: ['EntityName'] }],
        domainEvents: [{ name: 'EventName', description: 'what this event represents', trigger: 'what triggers it', steps: ['step 1'], actors: ['ActorName'], payload: { key: 'value type' } }]
      },
      null,
      2
    ),
    'Entities MUST represent core domain concepts. Domain events MUST include description, trigger, steps, actors, and payload. Do not emit markdown, code fences, or commentary outside the JSON.'
  ].join('\n');

  const user = [
    `Project: ${input.projectName}`,
    `Purpose: ${input.purpose}`,
    `Primary users: ${input.primaryUsers.join(', ') || 'unspecified'}`,
    `Critical capabilities: ${input.criticalCapabilities.join(', ') || 'unspecified'}`,
    `Architecture style: ${input.architectureStyle ?? 'any'}`,
    `Language: ${input.language ?? 'unspecified'}`,
    `Framework: ${input.framework ?? 'unspecified'}`,
    `Database: ${input.database ?? 'unspecified'}`,
    'Generate the domain model JSON now.'
  ].join('\n');

  return { system, user };
}

export interface MentalModelPromptInput {
  projectName: string;
  purpose: string;
  primaryUsers: string[];
  criticalCapabilities: string[];
  entities?: string[];
  architectureStyle?: string;
  compliance?: string[];
  targetLatency?: string;
  targetConcurrency?: string;
}

export function buildMentalModelPrompt(input: MentalModelPromptInput): { system: string; user: string } {
  const system = [
    'You are the chief architect of EngineeringOS. Generate a comprehensive mental model for the described system.',
    'Respond with STRICT JSON only, matching exactly:',
    JSON.stringify(
      {
        invariants: [{ id: 'INV-AI-1', statement: 'invariant statement', severity: 'blocking', scope: ['ComponentName'], enforcement: ['how to enforce'], verification: ['how to verify'] }],
        stateMachines: [{ entity: 'EntityName', states: ['state1', 'state2'], transitions: [{ from: 'state1', to: 'state2', trigger: 'event' }], invalidTransitions: [] }],
        failureModes: [{ id: 'FM-AI-1', name: 'failure name', description: 'description', severity: 'high', mitigation: 'how to mitigate', evidence: [] }],
        recoveryStrategies: [{ id: 'REC-AI-1', name: 'strategy name', description: 'description', appliesTo: 'FM-AI-1' }],
        decisions: [{ id: 'DEC-AI-1', title: 'title', context: 'context', decision: 'what was decided', reason: 'why', alternatives: [], consequences: [], affectedComponents: [], status: 'accepted', date: '', source: 'recommendation' }],
        risks: [{ id: 'RISK-AI-1', name: 'risk name', description: 'description', likelihood: 'medium', impact: 'high', mitigation: 'how to mitigate' }],
        businessRules: [{ id: 'BR-AI-1', statement: 'rule statement', severity: 'warning', source: 'recommendation' }],
        constraints: [{ id: 'CON-AI-1', statement: 'constraint statement', scope: 'global' }]
      },
      null,
      2
    ),
    'Generate comprehensive invariants, failure modes, risks, and decisions. Do not emit markdown, code fences, or commentary outside the JSON.'
  ].join('\n');

  const user = [
    `Project: ${input.projectName}`,
    `Purpose: ${input.purpose}`,
    `Primary users: ${input.primaryUsers.join(', ') || 'unspecified'}`,
    `Critical capabilities: ${input.criticalCapabilities.join(', ') || 'unspecified'}`,
    input.entities?.length ? `Entities: ${input.entities.join(', ')}` : '',
    input.architectureStyle ? `Architecture style: ${input.architectureStyle}` : '',
    input.compliance?.length ? `Compliance requirements: ${input.compliance.join(', ')}` : '',
    input.targetLatency ? `Target latency: ${input.targetLatency}` : '',
    input.targetConcurrency ? `Target concurrency: ${input.targetConcurrency}` : '',
    'Generate the mental model JSON now.'
  ].filter(Boolean).join('\n');

  return { system, user };
}

export interface GuardrailsPromptInput {
  projectName: string;
  purpose: string;
  language?: string;
  framework?: string;
  database?: string;
  entities?: string[];
  compliance?: string[];
  securityLevel?: string;
}

export function buildGuardrailsPrompt(input: GuardrailsPromptInput): { system: string; user: string } {
  const system = [
    'You are the chief architect of EngineeringOS. Generate enforceable guardrails for the described system.',
    'Respond with STRICT JSON only, matching exactly:',
    JSON.stringify(
      {
        guardrails: [
          {
            name: 'guardrail name',
            rule: 'human-readable rule statement',
            severity: 'blocking',
            scope: ['path/pattern'],
            allowedPatterns: ['allowed regex or glob'],
            forbiddenPatterns: ['forbidden regex or glob'],
            enforcement: ['how enforced'],
            reason: 'why this rule exists',
            verification: ['how to verify']
          }
        ]
      },
      null,
      2
    ),
    'Severity MUST be one of: advisory, warning, blocking. Scope MUST use file path patterns. Do not emit markdown, code fences, or commentary outside the JSON.'
  ].join('\n');

  const user = [
    `Project: ${input.projectName}`,
    `Purpose: ${input.purpose}`,
    input.language ? `Language: ${input.language}` : '',
    input.framework ? `Framework: ${input.framework}` : '',
    input.database ? `Database: ${input.database}` : '',
    input.entities?.length ? `Entities: ${input.entities.join(', ')}` : '',
    input.compliance?.length ? `Compliance: ${input.compliance.join(', ')}` : '',
    input.securityLevel ? `Security level: ${input.securityLevel}` : '',
    'Generate the guardrails JSON now.'
  ].filter(Boolean).join('\n');

  return { system, user };
}

export interface ThreatModelPromptInput {
  projectName: string;
  purpose: string;
  entities?: string[];
  integrations?: string[];
  compliance?: string[];
  securityLevel?: string;
}

export function buildThreatModelPrompt(input: ThreatModelPromptInput): { system: string; user: string } {
  const system = [
    'You are the chief security architect of EngineeringOS. Generate a STRIDE threat model for the described system.',
    'Respond with STRICT JSON only, matching exactly:',
    JSON.stringify(
      {
        threats: [
          {
            stride: 'Spoofing',
            threat: 'threat description',
            affectedComponent: 'component name',
            severity: 'high',
            mitigation: 'how to mitigate'
          }
        ],
        attackSurface: ['attack surface entry point'],
        securityRequirements: [
          { text: 'security requirement text', severity: 'blocking' }
        ]
      },
      null,
      2
    ),
    'Threats MUST cover STRIDE categories where applicable. Severity: low, medium, high, critical. Security requirement severity: advisory, warning, blocking. Do not emit markdown, code fences, or commentary outside the JSON.'
  ].join('\n');

  const parts: string[] = [
    `Project: ${input.projectName}`,
    `Purpose: ${input.purpose}`
  ];

  if (input.entities?.length) parts.push(`Entities: ${input.entities.join(', ')}`);
  if (input.integrations?.length) parts.push(`Integrations: ${input.integrations.join(', ')}`);
  if (input.compliance?.length) parts.push(`Compliance: ${input.compliance.join(', ')}`);
  if (input.securityLevel) parts.push(`Security level: ${input.securityLevel}`);
  parts.push('Generate the threat model JSON now.');

  return { system, user: parts.join('\n') };
}

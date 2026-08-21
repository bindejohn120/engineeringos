export interface WizardField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'tags';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

export interface WizardPhase {
  id: string;
  title: string;
  description: string;
  fields: WizardField[];
  aiSuggestable: boolean;
}

export function getWizardPhases(): WizardPhase[] {
  return [
    {
      id: 'basics',
      title: 'Project Basics',
      description: 'Tell us about your project.',
      aiSuggestable: false,
      fields: [
        { id: 'projectName', label: 'Project Name', type: 'text', placeholder: 'e.g. Yam Marketplace', required: true },
        { id: 'purpose', label: 'Purpose', type: 'textarea', placeholder: 'I\'m building a fintech marketplace for African businesses...', required: true },
        { id: 'primaryUsers', label: 'Primary Users', type: 'tags', placeholder: 'e.g. farmers, buyers, traders, administrators' },
        { id: 'coreCapabilities', label: 'Core Capabilities', type: 'tags', placeholder: 'e.g. registration, listing, search, ordering, payment' }
      ]
    },
    {
      id: 'domain',
      title: 'Domain Model',
      description: 'Define the core domain concepts.',
      aiSuggestable: true,
      fields: [
        { id: 'entities', label: 'Core Entities', type: 'tags', placeholder: 'e.g. User, Product, Order, Payment' },
        { id: 'valueObjects', label: 'Value Objects', type: 'tags', placeholder: 'e.g. Money, Address, Email' },
        { id: 'boundedContexts', label: 'Bounded Contexts', type: 'tags', placeholder: 'e.g. Catalog, Ordering, Payments' },
        { id: 'domainEvents', label: 'Domain Events', type: 'tags', placeholder: 'e.g. OrderPlaced, PaymentReceived' }
      ]
    },
    {
      id: 'integrations',
      title: 'Integrations',
      description: 'Select external providers and services.',
      aiSuggestable: true,
      fields: [
        {
          id: 'authProvider',
          label: 'Auth Provider',
          type: 'select',
          options: ['Custom JWT', 'Auth0', 'Firebase Auth', 'Clerk', 'Supabase Auth', 'Keycloak', 'AWS Cognito', 'None']
        },
        { id: 'paymentProviders', label: 'Payment Providers', type: 'tags', placeholder: 'e.g. Stripe, PayPal, Flutterwave, M-Pesa' },
        { id: 'notificationProviders', label: 'Notification Providers', type: 'tags', placeholder: 'e.g. SendGrid, Twilio, Firebase Push' },
        { id: 'storageProviders', label: 'Storage Providers', type: 'tags', placeholder: 'e.g. S3, GCS, Azure Blob' },
        { id: 'otherIntegrations', label: 'Other Integrations', type: 'tags', placeholder: 'e.g. ElasticSearch, Redis, RabbitMQ' }
      ]
    },
    {
      id: 'nfr',
      title: 'Non-Functional Requirements',
      description: 'Define performance and compliance targets.',
      aiSuggestable: true,
      fields: [
        {
          id: 'targetLatency',
          label: 'Target Latency (p95)',
          type: 'select',
          options: ['< 50ms', '< 100ms', '< 250ms', '< 500ms', '< 1s', 'No specific']
        },
        {
          id: 'targetConcurrency',
          label: 'Expected Concurrent Users',
          type: 'select',
          options: ['< 100', '100-1k', '1k-10k', '10k-100k', '100k+']
        },
        {
          id: 'targetUptime',
          label: 'Target Uptime',
          type: 'select',
          options: ['99%', '99.9%', '99.99%', '99.999%']
        },
        { id: 'compliance', label: 'Compliance', type: 'tags', placeholder: 'e.g. GDPR, HIPAA, PCI-DSS, SOC2, CCPA' },
        { id: 'dataRetention', label: 'Data Retention', type: 'textarea', placeholder: 'e.g. User data retained for 3 years, soft-delete for 30 days...' },
        { id: 'slaRequirements', label: 'SLA Requirements', type: 'textarea', placeholder: 'e.g. Support response within 4 hours during business hours...' }
      ]
    },
    {
      id: 'architecture',
      title: 'Architecture & Stack',
      description: 'Choose your architecture and technology stack.',
      aiSuggestable: true,
      fields: [
        {
          id: 'architectureStyle',
          label: 'Architecture Style',
          type: 'select',
          options: ['Auto (AI recommends)', 'Clean Architecture', 'Modular Monolith', 'Microservices', 'Layered', 'Event-Driven', 'JAMstack', 'Server Components', 'Islands Architecture']
        },
        {
          id: 'securityLevel',
          label: 'Security Level',
          type: 'select',
          options: ['Baseline', 'Hardened', 'Regulated']
        },
        { id: 'language', label: 'Language', type: 'text', placeholder: 'e.g. TypeScript, Python, Go, Dart, Kotlin' },
        { id: 'runtime', label: 'Runtime', type: 'text', placeholder: 'e.g. Node.js, Bun, Deno, Browser, iOS, Android' },
        { id: 'framework', label: 'Framework', type: 'text', placeholder: 'e.g. React, Next.js, Vue, NestJS, Flutter, Express' },
        { id: 'database', label: 'Database', type: 'text', placeholder: 'e.g. PostgreSQL, MongoDB, SQLite, Firebase' },
        { id: 'blueprintText', label: 'Additional Requirements', type: 'textarea', placeholder: 'Paste any extra requirements, constraints, or a full spec...' }
      ]
    }
  ];
}

export function renderWizardProgressHTML(current: number, total: number): string {
  const pct = Math.round(((current + 1) / total) * 100);
  let html = '<div style="margin-bottom:12px">';
  html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
  for (let i = 0; i < total; i++) {
    const state = i < current ? 'done' : i === current ? 'active' : 'pending';
    const color = state === 'done' ? 'var(--green)' : state === 'active' ? 'var(--accent)' : 'var(--border)';
    html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px" title="Step ${i + 1}"></span>`;
  }
  html += '</div>';
  html += `<div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden">`;
  html += `<div style="height:100%;width:${pct}%;background:var(--accent);border-radius:2px;transition:width 0.3s"></div>`;
  html += '</div>';
  html += `<div class="small muted" style="margin-top:4px">Step ${current + 1} of ${total}</div>`;
  html += '</div>';
  return html;
}

function esc(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderWizardPhaseHTML(phase: WizardPhase): string {
  let html = `<div class="card">`;
  html += `<h3>${esc(phase.title)}</h3>`;
  html += `<div class="small muted" style="margin-bottom:12px">${esc(phase.description)}</div>`;

  for (const field of phase.fields) {
    html += `<label for="wz-${field.id}">${esc(field.label)}${field.required ? ' *' : ''}</label>`;

    switch (field.type) {
      case 'text':
        html += `<input type="text" id="wz-${field.id}" placeholder="${esc(field.placeholder || '')}" data-field-id="${field.id}"${field.required ? ' required' : ''}>`;
        break;
      case 'textarea':
        html += `<textarea id="wz-${field.id}" placeholder="${esc(field.placeholder || '')}" data-field-id="${field.id}"${field.required ? ' required' : ''}></textarea>`;
        break;
      case 'select':
        html += `<select id="wz-${field.id}" data-field-id="${field.id}">`;
        html += `<option value="">-- Select --</option>`;
        for (const opt of field.options || []) {
          html += `<option value="${esc(opt)}">${esc(opt)}</option>`;
        }
        html += `</select>`;
        break;
      case 'tags':
        html += `<input type="text" id="wz-${field.id}-input" placeholder="${esc(field.placeholder || 'Comma separated')}" data-field-id="${field.id}" data-type="tags">`;
        html += `<div id="wz-${field.id}-tags" class="wizard-tag-container" data-field-id="${field.id}" style="min-height:20px;margin-bottom:10px"></div>`;
        break;
    }
  }

  html += '</div>';
  return html;
}

export function renderWizardNavHTML(phaseIndex: number, total: number, aiSuggestable: boolean): string {
  let html = '<div class="btn-row" style="margin-top:8px">';

  if (phaseIndex > 0) {
    html += '<button class="btn secondary" id="wz-prev">Previous</button>';
  }

  if (aiSuggestable) {
    html += '<button class="btn secondary" id="wz-ai-suggest" style="flex:1">AI Suggest</button>';
  }

  if (phaseIndex < total - 1) {
    html += '<button class="btn" id="wz-next" style="flex:1">Next</button>';
  } else {
    html += '<button class="btn" id="wz-build" style="flex:1">Build My Engineering Model</button>';
  }

  html += '</div>';
  return html;
}

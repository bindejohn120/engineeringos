export function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
:root {
  --bg: #0d1117;
  --panel: #161b22;
  --panel-2: #1c2330;
  --border: #2a3442;
  --text: #e6edf3;
  --muted: #8b98a9;
  --accent: #4f9cf9;
  --green: #3fb950;
  --amber: #d29922;
  --red: #f85149;
  --purple: #bc8cff;
  --mono: "SF Mono", Consolas, "JetBrains Mono", monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; line-height: 1.5; padding: 12px; }
.logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; letter-spacing: 0.5px; margin-bottom: 4px; }
.logo .dot { width: 10px; height: 10px; border-radius: 3px; background: linear-gradient(135deg, var(--accent), var(--purple)); display: inline-block; }
.tagline { color: var(--muted); font-size: 11px; margin-bottom: 14px; }
.nav { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 14px; }
.nav button { background: var(--panel); color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 5px 9px; font-size: 11px; cursor: pointer; }
.nav button:hover { color: var(--text); }
.nav button.active { color: var(--text); border-color: var(--accent); }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.card h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); margin-bottom: 8px; }
.kpi-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.kpi { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; min-width: 90px; text-align: center; }
.kpi .num { font-size: 20px; font-weight: 700; font-family: var(--mono); }
.kpi .lbl { font-size: 10px; color: var(--muted); margin-top: 2px; }
.badge { display: inline-block; border-radius: 4px; padding: 2px 7px; font-size: 10px; font-weight: 600; font-family: var(--mono); }
.badge.blocking { background: rgba(248,81,73,0.15); color: var(--red); }
.badge.warning { background: rgba(210,153,34,0.15); color: var(--amber); }
.badge.advisory { background: rgba(139,152,169,0.15); color: var(--muted); }
.badge.pass { background: rgba(63,185,80,0.15); color: var(--green); }
.badge.info { background: rgba(79,156,249,0.15); color: var(--accent); }
.severity { font-family: var(--mono); font-size: 10px; font-weight: 700; }
.sev-blocking { color: var(--red); }
.sev-warning { color: var(--amber); }
.sev-advisory { color: var(--muted); }
.component { border-bottom: 1px solid var(--border); padding: 10px 0; }
.component:last-child { border-bottom: none; }
.component .name { font-weight: 600; font-size: 13px; }
.component .id { color: var(--muted); font-family: var(--mono); font-size: 11px; margin-left: 6px; }
.component .purpose { color: var(--muted); font-size: 12px; margin: 4px 0; }
.component .meta { font-size: 11px; color: var(--muted); }
.component .meta b { color: var(--text); font-weight: 500; }
.loc { font-family: var(--mono); font-size: 10px; color: var(--accent); background: var(--panel-2); border-radius: 4px; padding: 1px 5px; display: inline-block; margin: 2px 2px 0 0; }
.rule { border-left: 3px solid var(--border); padding: 8px 10px; margin-bottom: 8px; background: var(--panel); border-radius: 0 6px 6px 0; }
.rule .top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.rule .name { font-weight: 600; }
.rule .desc { color: var(--muted); font-size: 12px; margin-top: 4px; }
.check { display: flex; gap: 8px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid var(--border); }
.check:last-child { border-bottom: none; }
.check .verdict { font-family: var(--mono); font-weight: 700; font-size: 11px; min-width: 56px; }
.v-PASS { color: var(--green); }
.v-REVIEW { color: var(--amber); }
.v-BLOCK { color: var(--red); }
.evidence { font-size: 11px; color: var(--muted); }
.evidence li { margin-left: 16px; }
.empty { color: var(--muted); font-style: italic; padding: 16px; text-align: center; }
input, textarea, select { width: 100%; background: var(--panel-2); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 13px; margin-bottom: 10px; font-family: inherit; }
textarea { min-height: 70px; resize: vertical; }
label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.btn { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn.secondary { background: var(--panel-2); color: var(--text); border: 1px solid var(--border); }
.btn-block { width: 100%; margin-top: 6px; }
.btn-row { display: flex; gap: 8px; }
.mono { font-family: var(--mono); }
.muted { color: var(--muted); }
.small { font-size: 11px; }
.hidden { display: none; }
.action { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 9px 10px; margin-bottom: 6px; cursor: pointer; font-size: 12px; }
.action:hover { border-color: var(--accent); }
.action .arrow { color: var(--accent); font-family: var(--mono); }
.signal { border-left: 3px solid var(--red); background: rgba(248,81,73,0.08); border-radius: 0 6px 6px 0; padding: 8px 10px; margin-bottom: 8px; }
.signal .head { font-family: var(--mono); font-size: 11px; font-weight: 700; color: var(--red); }
.tag { display: inline-block; background: var(--panel-2); border: 1px solid var(--border); color: var(--muted); font-size: 10px; border-radius: 10px; padding: 2px 8px; margin: 2px; }
.progress { color: var(--muted); }
ul { padding-left: 18px; }
li { margin-bottom: 2px; }
</style>
</head>
<body>
<div class="logo"><span class="dot"></span>ENGINEERINGOS</div>
<div class="tagline" id="tagline">Engineering intelligence for AI-powered development</div>
<div class="nav" id="nav"></div>
<div id="app"></div>
<script>
(function () {
  var vscode = acquireVsCodeApi();
  var state = null;
  var currentView = 'overview';

  function post(msg) { vscode.postMessage(msg); }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var NAV = [
    { id: 'overview', label: 'Overview' },
    { id: 'map', label: 'Map' },
    { id: 'model', label: 'Mental Model' },
    { id: 'guardrails', label: 'Guardrails' },
    { id: 'verify', label: 'Verify' }
  ];

  function renderNav() {
    var nav = document.getElementById('nav');
    nav.innerHTML = '';
    NAV.forEach(function (n) {
      var b = document.createElement('button');
      b.textContent = n.label;
      if (n.id === currentView) b.classList.add('active');
      b.onclick = function () { currentView = n.id; renderNav(); render(); };
      nav.appendChild(b);
    });
  }

  function kpi(label, value, color) {
    return '<div class="kpi"><div class="num" style="color:' + (color || 'var(--text)') + '">' + esc(value) + '</div><div class="lbl">' + esc(label) + '</div></div>';
  }

  function renderOverview(p) {
    var app = document.getElementById('app');
    var h = '<div class="card"><h3>Project</h3>' +
      '<div style="font-weight:700;font-size:15px">' + esc(p.projectName || 'Untitled') + '</div>' +
      '<div class="muted small">' + esc(p.purpose || 'No purpose captured yet.') + '</div></div>';
    h += '<div class="kpi-row">' +
      kpi('Components', p.counts.components) + kpi('Requirements', p.counts.requirements) +
      kpi('Invariants', p.counts.invariants) + kpi('Guardrails', p.counts.guardrails) +
      kpi('Risks', p.counts.risks) + kpi('Unknowns', p.counts.unknowns) + '</div>';
    if (p.blueprint) {
      h += '<div class="card"><h3>Engineering Blueprint</h3>' +
        '<div class="meta"><b>Architecture:</b> ' + esc(p.blueprint.architectureStyle) + '</div>' +
        '<div class="meta"><b>Security:</b> ' + esc(p.blueprint.securityLevel) + '</div>' +
        '<div class="meta"><b>Sections:</b> ' + esc(p.blueprint.sections) + '</div>' +
        '<div class="meta"><b>AI-assisted:</b> ' + (p.blueprint.aiEnabled ? 'enabled' : 'deterministic (set ENGINEERINGOS_AI_KEY to enable)') + '</div>' +
        '<button class="action" data-cmd="openBlueprint" style="margin-top:8px"><span class="arrow">→</span> Open Blueprint (agent framework document)</button></div>';
    }
    if (p.verification) {
      h += '<div class="card"><h3>Last Verification</h3><div class="severity sev-' + (p.verification.overall === 'BLOCK' ? 'blocking' : p.verification.overall === 'REVIEW' ? 'warning' : 'advisory') + '" style="font-size:18px">' + p.verification.overall + '</div></div>';
    }
    if (p.ai) {
      var aiColor = p.ai.configured ? 'var(--green)' : 'var(--amber)';
      var aiLabel = p.ai.configured ? p.ai.provider + ' / ' + p.ai.model : 'Not configured';
      h += '<div class="card"><h3>AI Provider</h3>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<div style="width:8px;height:8px;border-radius:50%;background:' + aiColor + '"></div>' +
        '<span style="font-weight:600">' + esc(p.ai.provider) + '</span>' +
        '<span class="muted">' + esc(p.ai.model) + '</span>' +
        '</div>' +
        (!p.ai.configured ? '<button class="action" data-cmd="configureAI" style="margin-top:8px"><span class="arrow">🔑</span> Configure AI Key</button>' : '') +
        '</div>';
    }
    if (p.quality) {
      var gradeColor = p.quality.score >= 90 ? '#4caf50' : p.quality.score >= 70 ? '#ff9800' : '#f44336';
      h += '<div class="card"><h3>Quality Score</h3>' +
        '<div style="font-size:32px;font-weight:800;color:' + gradeColor + '">' + p.quality.grade + ' <span style="font-size:18px;color:#888">(' + p.quality.score + '/100)</span></div>' +
        '<div class="kpi-row" style="margin-top:8px">' +
        kpi('Map', p.quality.map) + kpi('Model', p.quality.mentalModel) +
        kpi('Guardrails', p.quality.guardrails) + kpi('Blueprint', p.quality.blueprint) + '</div>';
      if (p.quality.recommendations.length > 0) {
        h += '<div style="margin-top:8px"><b>Top Recommendations:</b><ul style="margin:4px 0;padding-left:16px">';
        p.quality.recommendations.forEach(function (r) { h += '<li style="color:#888;font-size:12px">' + esc(r) + '</li>'; });
        h += '</ul></div>';
      }
      h += '</div>';
    }
    h += '<div class="card"><h3>Quick Actions</h3>' +
      '<button class="action" data-cmd="verify"><span class="arrow">→</span> Verify Current Change</button>' +
      '<button class="action" data-cmd="analyze"><span class="arrow">→</span> Analyze Change / Predict Impact</button>' +
      '<button class="action" data-cmd="context"><span class="arrow">→</span> Prepare Agent Context</button>' +
      '<button class="action" data-cmd="update"><span class="arrow">→</span> Update Model</button>' +
      '<button class="action" data-cmd="ask"><span class="arrow">→</span> Ask EngineeringOS</button>' +
      '<button class="action" data-cmd="configureAI"><span class="arrow">🔑</span> Configure AI Key</button>' +
      '<button class="action" data-cmd="reset" style="color:var(--red);border-color:var(--red);margin-top:8px"><span class="arrow">↺</span> Start New Project (Reset)</button>' +
      '</div>';
    app.innerHTML = h;
    app.querySelectorAll('[data-cmd]').forEach(function (b) {
      b.onclick = function () { post({ type: 'command', command: b.getAttribute('data-cmd') }); };
    });
  }

  var wizardState = { currentPhase: 0, data: {} };

  var WIZARD_PHASES = [
    { id: 'basics', title: 'Project Basics', description: 'Tell us what you are building', aiSuggestable: false, fields: [
      { id: 'projectName', label: 'Project Name', type: 'text', placeholder: 'e.g. Yam Marketplace', required: true },
      { id: 'purpose', label: 'Purpose', type: 'textarea', placeholder: 'Describe what you are building and why...', required: true },
      { id: 'users', label: 'Primary Users', type: 'tags', placeholder: 'farmers, buyers, admins' },
      { id: 'capabilities', label: 'Core Capabilities', type: 'tags', placeholder: 'registration, listing, search, ordering, payment' }
    ]},
    { id: 'domain', title: 'Domain Model', description: 'Define your business entities and relationships', aiSuggestable: true, fields: [
      { id: 'entities', label: 'Core Entities', type: 'tags', placeholder: 'User, Product, Order, Payment, Shipment' },
      { id: 'valueObjects', label: 'Value Objects', type: 'tags', placeholder: 'Money, Address, Email, PhoneNumber' },
      { id: 'boundedContexts', label: 'Bounded Contexts', type: 'tags', placeholder: 'Catalog, Ordering, Payment, Shipping' },
      { id: 'domainEvents', label: 'Key Domain Events', type: 'tags', placeholder: 'OrderPlaced, PaymentReceived, ItemShipped' }
    ]},
    { id: 'integrations', title: 'Integration Map', description: 'External systems and providers', aiSuggestable: true, fields: [
      { id: 'authProvider', label: 'Auth Provider', type: 'select', options: ['', 'Custom JWT', 'Auth0', 'Firebase Auth', 'Clerk', 'Supabase Auth', 'Keycloak', 'AWS Cognito'] },
      { id: 'paymentProviders', label: 'Payment Providers', type: 'tags', placeholder: 'Stripe, PayPal, Flutterwave, M-Pesa' },
      { id: 'notificationProviders', label: 'Notification Providers', type: 'tags', placeholder: 'SendGrid, Twilio, Firebase Push' },
      { id: 'storageProviders', label: 'Storage Providers', type: 'tags', placeholder: 'S3, GCS, Azure Blob' },
      { id: 'otherIntegrations', label: 'Other Integrations', type: 'tags', placeholder: 'ElasticSearch, Redis, RabbitMQ' }
    ]},
    { id: 'nfr', title: 'Non-Functional Requirements', description: 'Performance, compliance, and operational targets', aiSuggestable: true, fields: [
      { id: 'targetLatency', label: 'Target Latency (p95)', type: 'select', options: ['', '< 50ms', '< 100ms', '< 250ms', '< 500ms', '< 1s', 'No specific requirement'] },
      { id: 'targetConcurrency', label: 'Expected Concurrent Users', type: 'select', options: ['', '< 100', '100-1k', '1k-10k', '10k-100k', '100k+'] },
      { id: 'availability', label: 'Availability Target', type: 'select', options: ['', '99% (best effort)', '99.9% (standard)', '99.99% (high availability)', '99.999% (mission critical)'] },
      { id: 'threatLevel', label: 'Threat Level', type: 'select', options: ['none', 'low', 'medium', 'high', 'critical'] },
      { id: 'compliance', label: 'Compliance Requirements', type: 'tags', placeholder: 'GDPR, HIPAA, PCI-DSS, SOC2, CCPA' },
      { id: 'dataRetention', label: 'Data Retention Policy', type: 'textarea', placeholder: 'e.g. User data retained for 7 years, PII deletable on request' },
      { id: 'slaRequirements', label: 'SLA Requirements', type: 'textarea', placeholder: 'e.g. Support response < 4h for P1, RTO < 1h, RPO < 5min' }
    ]},
    { id: 'architecture', title: 'Architecture & Stack', description: 'Choose your stack and style (AI will recommend)', aiSuggestable: true, fields: [
      { id: 'architectureStyle', label: 'Architecture Style', type: 'select', options: ['Auto (AI recommends)', 'Clean Architecture', 'Modular Monolith', 'Microservices', 'Layered', 'Event-Driven'] },
      { id: 'securityLevel', label: 'Security Level', type: 'select', options: ['Baseline', 'Hardened', 'Regulated'] },
      { id: 'language', label: 'Language', type: 'text', placeholder: 'TypeScript, Go, Rust, Python' },
      { id: 'runtime', label: 'Runtime', type: 'text', placeholder: 'Node.js 20, Bun, Deno' },
      { id: 'framework', label: 'Framework', type: 'text', placeholder: 'NestJS, Express, Fastify, Next.js' },
      { id: 'database', label: 'Database', type: 'text', placeholder: 'PostgreSQL, MongoDB, DynamoDB' },
      { id: 'blueprintText', label: 'Additional Requirements', type: 'textarea', placeholder: 'Paste a detailed spec, constraints, or requirements...' }
    ]}
  ];

  function renderField(f) {
    var h = '<label>' + esc(f.label) + (f.required ? ' <span style="color:var(--red)">*</span>' : '') + '</label>';
    if (f.type === 'text') {
      h += '<input id="wf-' + f.id + '" placeholder="' + esc(f.placeholder || '') + '">';
    } else if (f.type === 'textarea') {
      h += '<textarea id="wf-' + f.id + '" placeholder="' + esc(f.placeholder || '') + '"></textarea>';
    } else if (f.type === 'select') {
      h += '<select id="wf-' + f.id + '">';
      (f.options || []).forEach(function (opt) {
        h += '<option value="' + esc(opt) + '">' + esc(opt || '— Select —') + '</option>';
      });
      h += '</select>';
    } else if (f.type === 'tags') {
      h += '<input id="wf-' + f.id + '" placeholder="' + esc(f.placeholder || '') + '">';
      h += '<div class="small muted" style="margin-top:2px">Comma-separated</div>';
    }
    return h;
  }

  function getFieldValue(f) {
    var el = document.getElementById('wf-' + f.id);
    if (!el) return '';
    if (f.type === 'tags') return el.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    return el.value.trim();
  }

  function renderWizardProgress(current, total) {
    var h = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">';
    for (var i = 0; i < total; i++) {
      var cls = i === current ? 'active' : i < current ? 'done' : '';
      h += '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;' +
        (cls === 'active' ? 'background:var(--accent);color:#fff' : cls === 'done' ? 'background:var(--green);color:#fff' : 'background:var(--panel-2);color:var(--muted)') + '">' +
        (i < current ? '\u2713' : (i + 1)) + '</div>';
    }
    h += '<div style="flex:1;height:3px;background:var(--border);border-radius:2px;margin-left:4px"><div style="height:100%;width:' +
      Math.round(((current + 1) / total) * 100) + '%;background:var(--accent);border-radius:2px"></div></div></div>';
    return h;
  }

  function renderWizardPhase() {
    var app = document.getElementById('app');
    var phase = WIZARD_PHASES[wizardState.currentPhase];
    var total = WIZARD_PHASES.length;
    var idx = wizardState.currentPhase;

    var h = '<div class="card"><h3>Step ' + (idx + 1) + '/' + total + ': ' + esc(phase.title) + '</h3>' +
      '<div class="muted small" style="margin-bottom:12px">' + esc(phase.description) + '</div>' +
      renderWizardProgress(idx, total);

    phase.fields.forEach(function (f) { h += renderField(f); });

    h += '<div class="btn-row" style="margin-top:14px">';
    if (idx > 0) h += '<button class="action" id="wiz-prev">Previous</button>';
    if (phase.aiSuggestable) h += '<button class="action" id="wiz-ai" style="border-color:var(--purple);color:var(--purple)">AI Suggest</button>';
    if (idx < total - 1) {
      h += '<button class="btn" id="wiz-next" style="margin-left:auto">Next \u2192</button>';
    } else {
      h += '<button class="btn btn-block" id="wiz-build" style="margin-left:auto;margin-top:8px">Build My Engineering Model</button>';
    }
    h += '</div></div>';
    h += '<div id="wiz-progress" style="display:none" class="card"><h3>Generating...</h3><div class="muted" id="wiz-progress-text">Starting AI pipeline...</div></div>';
    app.innerHTML = h;

    if (idx > 0) document.getElementById('wiz-prev').onclick = function () {
      saveCurrentPhaseData();
      wizardState.currentPhase--;
      restorePhaseData();
      renderWizardPhase();
    };
    if (phase.aiSuggestable) document.getElementById('wiz-ai').onclick = function () {
      saveCurrentPhaseData();
      post({ type: 'wizard.ai.suggest', phaseId: phase.id });
    };
    if (idx < total - 1) document.getElementById('wiz-next').onclick = function () {
      saveCurrentPhaseData();
      wizardState.currentPhase++;
      restorePhaseData();
      renderWizardPhase();
    };
    if (idx === total - 1) document.getElementById('wiz-build').onclick = function () {
      saveCurrentPhaseData();
      var payload = buildWizardPayload();
      document.getElementById('wiz-progress').style.display = 'block';
      document.getElementById('wiz-build').disabled = true;
      document.getElementById('wiz-build').textContent = 'Building...';
      post({ type: 'wizard.complete', payload: payload });
    };
    restorePhaseData();
  }

  function saveCurrentPhaseData() {
    var phase = WIZARD_PHASES[wizardState.currentPhase];
    if (!wizardState.data[phase.id]) wizardState.data[phase.id] = {};
    phase.fields.forEach(function (f) {
      wizardState.data[phase.id][f.id] = getFieldValue(f);
    });
  }

  function restorePhaseData() {
    var phase = WIZARD_PHASES[wizardState.currentPhase];
    var saved = wizardState.data[phase.id] || {};
    phase.fields.forEach(function (f) {
      var el = document.getElementById('wf-' + f.id);
      if (!el) return;
      var val = saved[f.id];
      if (val === undefined || val === '') return;
      if (Array.isArray(val)) el.value = val.join(', ');
      else el.value = val;
    });
  }

  function buildWizardPayload() {
    var d = wizardState.data;
    var b = d.basics || {};
    var dm = d.domain || {};
    var ig = d.integrations || {};
    var nfr = d.nfr || {};
    var ar = d.architecture || {};
    return {
      projectName: b.projectName || 'Untitled Project',
      purpose: b.purpose || '',
      users: b.users || [],
      capabilities: b.capabilities || [],
      entities: dm.entities || [],
      valueObjects: dm.valueObjects || [],
      boundedContexts: dm.boundedContexts || [],
      domainEvents: dm.domainEvents || [],
      authProvider: ig.authProvider || undefined,
      paymentProviders: ig.paymentProviders || [],
      notificationProviders: ig.notificationProviders || [],
      storageProviders: ig.storageProviders || [],
      otherIntegrations: ig.otherIntegrations || [],
      targetLatency: nfr.targetLatency || undefined,
      targetConcurrency: nfr.targetConcurrency || undefined,
      availability: nfr.availability || undefined,
      threatLevel: nfr.threatLevel || undefined,
      compliance: nfr.compliance || [],
      dataRetention: nfr.dataRetention || undefined,
      slaRequirements: nfr.slaRequirements || undefined,
      architectureStyle: ar.architectureStyle || undefined,
      securityLevel: ar.securityLevel || undefined,
      language: ar.language || undefined,
      runtime: ar.runtime || undefined,
      framework: ar.framework || undefined,
      database: ar.database || undefined,
      blueprintText: ar.blueprintText || undefined
    };
  }

  function renderOnboarding() {
    wizardState = { currentPhase: 0, data: {} };
    renderWizardPhase();
  }

  function renderMap(p) {
    var app = document.getElementById('app');
    if (!p.components || p.components.length === 0) {
      app.innerHTML = '<div class="empty">No components mapped yet.</div>';
      return;
    }
    var h = '<div class="card"><h3>Architecture</h3>' + esc(p.systemPurpose || '') + '</div>';
    h += p.components.map(function (c) {
      var html = '<div class="component"><div class="name">' + esc(c.name) + '<span class="id">' + esc(c.id) + '</span></div>' +
        '<div class="purpose">' + esc(c.purpose) + '</div>';
      if (c.dependencies && c.dependencies.length) html += '<div class="meta"><b>Depends on:</b> ' + esc(c.dependencies.join(', ')) + '</div>';
      if (c.dependents && c.dependents.length) html += '<div class="meta"><b>Used by:</b> ' + esc(c.dependents.join(', ')) + '</div>';
      if (c.sourceLocations && c.sourceLocations.length) html += '<div>' + c.sourceLocations.map(function (l) { return '<span class="loc">' + esc(l) + '</span>'; }).join('') + '</div>';
      html += '</div>';
      return html;
    }).join('');
    if (p.workflows && p.workflows.length) {
      h += '<div class="card"><h3>Workflows</h3>' + p.workflows.map(function (w) {
        return '<div style="margin-bottom:8px"><b>' + esc(w.name) + '</b><div class="small muted">' + esc(w.description || '') + '</div></div>';
      }).join('') + '</div>';
    }
    if (p.requirements && p.requirements.length) {
      h += '<div class="card"><h3>Requirements</h3><ul>' + p.requirements.map(function (r) {
        return '<li><span class="badge ' + (r.priority === 'critical' ? 'blocking' : r.priority === 'high' ? 'warning' : 'advisory') + '">' + esc(r.priority) + '</span> <span class="small">' + esc(r.id) + '</span> ' + esc(r.text) + '</li>';
      }).join('') + '</ul></div>';
    }
    app.innerHTML = h;
  }

  function renderModel(p) {
    var app = document.getElementById('app');
    var h = '';
    if (p.systemPurpose) h += '<div class="card"><h3>System Purpose</h3>' + esc(p.systemPurpose) + '</div>';
    if (p.invariants && p.invariants.length) {
      h += '<div class="card"><h3>Invariants</h3>' + p.invariants.map(function (i) {
        return '<div class="rule"><div class="top"><span class="name">' + esc(i.id) + '</span><span class="badge ' + i.severity + '">' + esc(i.severity).toUpperCase() + '</span></div><div class="desc">' + esc(i.statement) + '</div></div>';
      }).join('') + '</div>';
    }
    if (p.decisions && p.decisions.length) {
      h += '<div class="card"><h3>Decisions</h3><ul>' + p.decisions.map(function (d) {
        return '<li><b>' + esc(d.id) + '</b> ' + esc(d.decision) + '</li>';
      }).join('') + '</ul></div>';
    }
    if (p.risks && p.risks.length) {
      h += '<div class="card"><h3>Risks</h3>' + p.risks.map(function (r) {
        return '<div class="rule"><div class="top"><span class="name">' + esc(r.name) + '</span><span class="badge warning">' + esc(r.likelihood + '/' + r.impact) + '</span></div><div class="desc">' + esc(r.description) + '</div></div>';
      }).join('') + '</div>';
    }
    if (p.unknowns && p.unknowns.length) {
      h += '<div class="card"><h3>Unknowns</h3>' + p.unknowns.map(function (u) {
        return '<div class="rule"><div class="desc"><b>' + esc(u.id) + '</b> ' + esc(u.question) + '</div></div>';
      }).join('') + '</div>';
    }
    if (!h) h = '<div class="empty">No mental model yet.</div>';
    app.innerHTML = h;
  }

  function renderGuardrails(p) {
    var app = document.getElementById('app');
    if (!p.guardrails || p.guardrails.length === 0) {
      app.innerHTML = '<div class="empty">No guardrails defined.</div>';
      return;
    }
    var h = '<div class="card"><h3>Engineering Guardrails</h3></div>';
    h += p.guardrails.map(function (g) {
      return '<div class="rule" style="border-left-color:' + (g.severity === 'blocking' ? 'var(--red)' : g.severity === 'warning' ? 'var(--amber)' : 'var(--border)') + '">' +
        '<div class="top"><span class="name">' + esc(g.id) + ' — ' + esc(g.name) + '</span><span class="badge ' + g.severity + '">' + esc(g.severity).toUpperCase() + '</span></div>' +
        '<div class="desc">' + esc(g.rule) + '</div>' +
        (g.reason ? '<div class="small muted" style="margin-top:4px">' + esc(g.reason) + '</div>' : '') +
        '</div>';
    }).join('');
    app.innerHTML = h;
  }

  function renderVerify(p) {
    var app = document.getElementById('app');
    if (!p || !p.results) { app.innerHTML = '<div class="empty">Run verification to see results.</div>'; return; }
    var color = p.overall === 'BLOCK' ? 'blocking' : p.overall === 'REVIEW' ? 'warning' : 'advisory';
    var h = '<div class="card"><h3>Verification Result</h3><div class="severity sev-' + color + '" style="font-size:22px">' + p.overall + '</div></div>';
    h += p.results.map(function (r) {
      return '<div class="check"><div class="verdict v-' + r.verdict + '">' + r.verdict + '</div><div style="flex:1"><div><b>' + esc(r.check) + '</b></div>' +
        (r.evidence.length ? '<ul class="evidence">' + r.evidence.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '') +
        (r.notVerified.length ? '<div class="small muted">Not verified: ' + esc(r.notVerified.join('; ')) + '</div>' : '') +
        '</div></div>';
    }).join('');
    if (p.signals && p.signals.length) {
      h += '<div class="card"><h3>Echo Signals</h3>' + p.signals.map(function (s) {
        return '<div class="signal"><div class="head">' + esc(s.ruleId) + ' · ' + esc(s.severity.toUpperCase()) + '</div><div>' + esc(s.message) + '</div><div class="small mono">' + esc(s.file) + '</div></div>';
      }).join('') + '</div>';
    }
    app.innerHTML = h;
  }

  function renderContext(p) {
    var app = document.getElementById('app');
    var h = '<div class="card"><h3>Agent Context Package</h3>' +
      '<div class="kpi-row">' + kpi('Est. tokens', p.estimatedTokens || 0) + kpi('Files', p.files || 0) + '</div>' +
      (p.contains && p.contains.length ? '<div class="small">Contains: ' + p.contains.map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="small muted">Does not contain: secrets, env vars, unrelated subsystems</div>' +
      '<div class="small muted">Written to <span class="mono">.engineeringos/generated/contexts/current-task.json</span></div>' +
      '<button class="btn btn-block" id="btn-copy">Copy Agent Context</button></div>';
    h += '<div class="card"><h3>Context Preview</h3><pre class="mono" style="font-size:11px;white-space:pre-wrap;color:var(--muted)">' + esc(p.serialized || '') + '</pre></div>';
    app.innerHTML = h;
    if (p.serialized) {
      document.getElementById('btn-copy').onclick = function () { post({ type: 'command', command: 'copyContext', payload: p.serialized }); };
    }
  }

  function renderImpact(p) {
    var app = document.getElementById('app');
    if (!p) { app.innerHTML = '<div class="empty">Run impact analysis to see results.</div>'; return; }
    var color = p.severity === 'HIGH' ? 'blocking' : p.severity === 'MEDIUM' ? 'warning' : 'advisory';
    var h = '<div class="card"><h3>Impact Analysis — ' + esc(p.target) + '</h3><div class="severity sev-' + color + '" style="font-size:22px">IMPACT: ' + p.severity + '</div></div>';
    if (p.affectedComponents && p.affectedComponents.length) {
      h += '<div class="card"><h3>Affected Components</h3><ul>' + p.affectedComponents.map(function (c) { return '<li>' + esc(c.name) + '</li>'; }).join('') + '</ul></div>';
    }
    if (p.affectedWorkflows && p.affectedWorkflows.length) {
      h += '<div class="card"><h3>Affected Workflows</h3>' + p.affectedWorkflows.map(function (w) { return '<div class="tag">' + esc(w) + '</div>'; }).join('') + '</div>';
    }
    if (p.requiredVerification && p.requiredVerification.length) {
      h += '<div class="card"><h3>Required Verification</h3><ul>' + p.requiredVerification.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('') + '</ul></div>';
    }
    app.innerHTML = h;
  }

  function renderAsk() {
    var app = document.getElementById('app');
    app.innerHTML = '<div class="card"><h3>Ask EngineeringOS</h3>' +
      '<label>Question</label><textarea id="ask-q" placeholder="What depends on this component? What could break if I change this? What don\\\'t we know?"></textarea>' +
      '<button class="btn btn-block" id="btn-ask">Ask</button></div>' +
      '<div id="ask-a"></div>';
    document.getElementById('btn-ask').onclick = function () {
      var q = document.getElementById('ask-q').value.trim();
      if (q) post({ type: 'command', command: 'ask', payload: q });
    };
  }

  function renderUpdate(p) {
    var app = document.getElementById('app');
    if (!p || !p.findings) { app.innerHTML = '<div class="empty">No drift findings. Run update model to analyze.</div>'; return; }
    var h = '<div class="card"><h3>Model Update Proposal</h3><div class="small muted">Detected drift. Review and accept changes to reconcile the model with reality.</div></div>';
    h += p.findings.map(function (f) {
      return '<div class="rule"><div class="top"><span class="name">' + esc(f.title) + '</span><span class="badge ' + f.severity + '">' + esc(f.severity).toUpperCase() + '</span></div><div class="desc">' + esc(f.description) + '</div>' +
        (f.proposedChange ? '<div class="small mono muted">→ ' + esc(f.proposedChange) + '</div>' : '') +
        '</div>';
    }).join('');
    h += '<div class="btn-row"><button class="btn" id="btn-accept" style="flex:1">Accept</button><button class="btn secondary" id="btn-dismiss" style="flex:1">Dismiss</button></div>';
    app.innerHTML = h;
    document.getElementById('btn-accept').onclick = function () { post({ type: 'command', command: 'acceptUpdate' }); };
    document.getElementById('btn-dismiss').onclick = function () { post({ type: 'command', command: 'dismissUpdate' }); };
  }

  function render() {
    if (!state) return;
    if (!state.initialized) { renderOnboarding(); return; }
    switch (currentView) {
      case 'overview': renderOverview(state.overview); break;
      case 'map': renderMap(state.map); break;
      case 'model': renderModel(state.model); break;
      case 'guardrails': renderGuardrails(state.guardrails); break;
      case 'verify': renderVerify(state.verify); break;
    }
    if (state.activeContext) renderContext(state.activeContext);
    if (state.activeImpact) renderImpact(state.activeImpact);
    if (state.activeAsk) renderAsk();
    if (state.activeUpdate) renderUpdate(state.activeUpdate);
  }

  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (msg.type === 'state') {
      state = msg.payload;
      renderNav();
      render();
    } else if (msg.type === 'view') {
      currentView = msg.view;
      renderNav();
      render();
    } else if (msg.type === 'wizard.ai.suggest.result') {
      var phase = WIZARD_PHASES.find(function (p) { return p.id === msg.phaseId; });
      if (phase && msg.data) {
        phase.fields.forEach(function (f) {
          var el = document.getElementById('wf-' + f.id);
          if (!el || !msg.data[f.id]) return;
          var val = msg.data[f.id];
          if (Array.isArray(val)) el.value = val.join(', ');
          else el.value = val;
        });
      }
    } else if (msg.type === 'wizard.progress') {
      var progEl = document.getElementById('wiz-progress-text');
      if (progEl) progEl.textContent = msg.phase + ' (' + msg.progress + '%)';
    }
  });

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

import { createMap, addComponent } from '../map/engine';
import { createMentalModel, addInvariant, addUnknown, addRisk } from '../mental-model/engine';
import type { Map, MentalModel, Guardrails } from '../core/types';

export function fixtureMap(): Map {
  let map = createMap('Test App', 'test-app');
  map.project.purpose = 'A test marketplace application.';

  map = addComponent(map, {
    id: 'payment-service',
    name: 'Payment Service',
    purpose: 'Processes payments for the marketplace.',
    responsibilities: ['handle payment confirmation'],
    inputs: ['checkout intent'],
    outputs: ['payment confirmation'],
    dependencies: ['order-service'],
    dependents: ['checkout'],
    interfaces: [],
    failureModes: ['provider timeout', 'duplicate webhook'],
    sourceLocations: ['src/services/payment.ts']
  });

  map = addComponent(map, {
    id: 'order-service',
    name: 'Order Service',
    purpose: 'Manages orders.',
    responsibilities: ['create orders'],
    inputs: [],
    outputs: [],
    dependencies: [],
    dependents: ['payment-service'],
    interfaces: [],
    failureModes: [],
    sourceLocations: ['src/services/order.ts']
  });

  map = addComponent(map, {
    id: 'checkout',
    name: 'Checkout',
    purpose: 'Checkout workflow in the client.',
    responsibilities: ['submit checkout'],
    inputs: [],
    outputs: [],
    dependencies: ['payment-service'],
    dependents: [],
    interfaces: [],
    failureModes: [],
    sourceLocations: ['src/client/checkout.ts']
  });

  map = {
    ...map,
    relationships: [
      { id: 'rel-1', from: 'checkout', to: 'payment-service', type: 'calls' },
      { id: 'rel-2', from: 'payment-service', to: 'order-service', type: 'updates' }
    ],
    workflows: [
      {
        id: 'wf-checkout',
        name: 'Checkout',
        description: 'Complete a purchase.',
        steps: ['submit checkout', 'confirm payment'],
        components: ['checkout', 'payment-service', 'order-service'],
        inputs: ['cart'],
        outputs: ['order']
      }
    ],
    requirements: [
      {
        id: 'REQ-001',
        text: 'Payments must be idempotent.',
        source: 'developer',
        priority: 'critical',
        status: 'open',
        schemaVersion: '1.0',
        modelVersion: 1,
        evidence: [],
        affectedComponents: ['payment-service']
      }
    ]
  };

  return map;
}

export function fixtureMentalModel(): MentalModel {
  let model = createMentalModel('A test marketplace application.');
  model.systemUnderstanding.primaryUsers = ['buyers', 'sellers'];
  model.systemUnderstanding.criticalCapabilities = ['payment', 'ordering', 'checkout'];

  model = addInvariant(model, {
    id: 'INV-001',
    statement: 'Payment webhook processing must be idempotent.',
    severity: 'blocking',
    scope: ['payment'],
    enforcement: ['idempotency key'],
    verification: ['duplicate webhook test']
  });

  model = addInvariant(model, {
    id: 'INV-002',
    statement: 'Order total equals line items plus fees.',
    severity: 'warning',
    scope: ['order'],
    enforcement: [],
    verification: ['order total test']
  });

  model = addUnknown(model, {
    id: 'UNK-001',
    question: 'When should sellers receive funds?',
    impact: 'high',
    blocks: ['seller-payout'],
    status: 'unresolved',
    evidence: []
  });

  model = addRisk(model, {
    id: 'RISK-001',
    name: 'Payment provider outage',
    description: 'Provider may be unavailable during checkout.',
    likelihood: 'medium',
    impact: 'high',
    mitigation: 'retry with backoff'
  });

  model = {
    ...model,
    decisions: [
      {
        id: 'ADR-001',
        title: 'Payment provider adapter',
        context: 'Multiple providers possible.',
        decision: 'Keep provider logic behind an adapter.',
        reason: 'Swap providers without touching domain.',
        alternatives: ['direct integration'],
        consequences: ['more boilerplate'],
        affectedComponents: ['payment-service'],
        status: 'accepted',
        date: '2026-01-01',
        source: 'developer'
      }
    ]
  };

  return model;
}

export function fixtureGuardrails(): Guardrails {
  return {
    schemaVersion: '1.0',
    modelVersion: 1,
    guardrails: [
      {
        id: 'GR-001',
        name: 'No Client Database Access',
        rule: 'Client code must not import database modules.',
        severity: 'blocking',
        scope: ['src/client/**'],
        allowedPatterns: [],
        forbiddenPatterns: ['db'],
        enforcement: ['import'],
        reason: 'Enforces client → API boundary.',
        verification: ['import validation']
      },
      {
        id: 'GR-002',
        name: 'No Secrets in Code',
        rule: 'Code must not contain hard-coded secrets.',
        severity: 'blocking',
        scope: ['src/**'],
        allowedPatterns: [],
        forbiddenPatterns: ['(api[_-]?key|secret)\\s*[:=]\\s*["\'][^"\']{8,}'],
        enforcement: ['pattern'],
        reason: 'Prevents credential leakage.',
        verification: ['pattern scan']
      }
    ]
  };
}

export function tmpDir(): string {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engineeringos-test-'));
  return dir;
}

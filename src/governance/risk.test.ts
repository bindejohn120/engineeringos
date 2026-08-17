import { describe, it, expect } from 'vitest';
import { classifyRisk, generateChangePlan, needsApproval } from '../governance/risk';

describe('risk classifier', () => {
  it('classifies LOW risk for simple changes', () => {
    const change = {
      id: 'CHG-001', description: 'Fix typo in readme', requestedBy: 'dev',
      requestedAt: new Date().toISOString(), files: ['README.md'], status: 'draft' as const
    };
    expect(classifyRisk(change)).toBe('LOW');
  });

  it('classifies HIGH risk for auth changes', () => {
    const change = {
      id: 'CHG-002', description: 'Update auth flow', requestedBy: 'dev',
      requestedAt: new Date().toISOString(), files: ['src/auth.ts'], status: 'draft' as const
    };
    expect(classifyRisk(change)).toBe('HIGH');
  });

  it('classifies CRITICAL for destructive operations', () => {
    const change = {
      id: 'CHG-003', description: 'Delete old data', requestedBy: 'dev',
      requestedAt: new Date().toISOString(), files: ['migrations/003.sql'], status: 'draft' as const
    };
    expect(classifyRisk(change)).toBe('CRITICAL');
  });

  it('needsApproval returns true for HIGH changes', () => {
    const change = {
      id: 'CHG-004', description: 'Auth update', requestedBy: 'dev',
      requestedAt: new Date().toISOString(), files: ['src/auth.ts'], status: 'draft' as const,
      riskTier: 'HIGH' as const
    };
    expect(needsApproval(change)).toBe(true);
  });

  it('needsApproval returns false for LOW changes', () => {
    const change = {
      id: 'CHG-005', description: 'Fix typo', requestedBy: 'dev',
      requestedAt: new Date().toISOString(), files: ['README.md'], status: 'draft' as const,
      riskTier: 'LOW' as const
    };
    expect(needsApproval(change)).toBe(false);
  });

  it('generates a change plan', () => {
    const change = {
      id: 'CHG-006', description: 'Update payment flow', requestedBy: 'dev',
      requestedAt: new Date().toISOString(), files: ['src/payment.ts'], status: 'draft' as const
    };
    const plan = generateChangePlan(change, {
      components: [{ id: 'payment', name: 'Payment', purpose: 'payments' }],
      invariants: [{ id: 'INV-1', statement: 'payment must be valid', severity: 'CRITICAL' }],
      guardrails: [{ id: 'GR-1', rule: 'no direct payment access', severity: 'blocking' }],
      decisions: [{ id: 'DEC-1', decision: 'use stripe' }]
    });
    expect(plan.riskTier).toBe('HIGH');
    expect(plan.filesAllowed).toContain('src/payment.ts');
    expect(plan.approvalRequired).toBe(true);
    expect(plan.testsRequired.length).toBeGreaterThan(0);
  });
});

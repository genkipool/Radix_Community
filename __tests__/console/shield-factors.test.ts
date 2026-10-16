import { describe, expect, it } from 'vitest';

import { factorRequirementOf, shieldFactorsOf, type RuleSummary } from '@/features/console/lib/account-security';

const badges = (n: number) => Array.from({ length: n }, (_, i) => ({ resource: `resource_${i}` }));
const rule = (kind: RuleSummary['kind'], threshold: number | null, n: number): RuleSummary => ({ kind, threshold, badges: badges(n) });

describe('factorRequirementOf', () => {
  it('reads a 2-of-3 shield as multi-factor', () => {
    expect(factorRequirementOf(rule('countOf', 2, 3))).toEqual({ kind: 'multi', need: 2, total: 3 });
    expect(factorRequirementOf(rule('allOf', 2, 2))).toEqual({ kind: 'multi', need: 2, total: 2 });
  });

  it('reads any-of rules as one factor enough', () => {
    expect(factorRequirementOf(rule('anyOf', 1, 3))).toEqual({ kind: 'single', need: 1, total: 3 });
    expect(factorRequirementOf(rule('require', 1, 1))).toEqual({ kind: 'single', need: 1, total: 1 });
  });

  it('names open, locked and unreadable rules', () => {
    expect(factorRequirementOf(rule('allowAll', null, 0)).kind).toBe('anyone');
    expect(factorRequirementOf(rule('denyAll', null, 0)).kind).toBe('nobody');
    expect(factorRequirementOf(null).kind).toBe('unknown');
  });

  it('never needs more factors than it lists', () => {
    expect(factorRequirementOf(rule('countOf', 5, 2))).toEqual({ kind: 'multi', need: 2, total: 2 });
  });
});

describe('shieldFactorsOf', () => {
  it('is null without a controller', () => {
    expect(shieldFactorsOf(null)).toBeNull();
  });
});

describe('summariseAccessRule with rule-level AnyOf / AllOf', () => {
  const requireNft = (id: string) => ({
    type: 'ProofRule',
    proof_rule: {
      type: 'Require',
      requirement: { type: 'NonFungible', non_fungible: { resource_address: 'resource_sig', local_id: { simple_rep: id } } },
    },
  });

  it('reads AllOf of two signatures as 2 of 2', async () => {
    const { summariseAccessRule } = await import('@/features/console/lib/account-security');
    const summary = summariseAccessRule({ type: 'Protected', access_rule: { type: 'AllOf', access_rules: [requireNft('[a]'), requireNft('[b]')] } });
    expect(factorRequirementOf(summary)).toEqual({ kind: 'multi', need: 2, total: 2 });
  });

  it('reads AnyOf of two signatures as 1 of 2', async () => {
    const { summariseAccessRule } = await import('@/features/console/lib/account-security');
    const summary = summariseAccessRule({ type: 'Protected', access_rule: { type: 'AnyOf', access_rules: [requireNft('[a]'), requireNft('[b]')] } });
    expect(factorRequirementOf(summary)).toEqual({ kind: 'single', need: 1, total: 2 });
  });
});

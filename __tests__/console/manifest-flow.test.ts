import { describe, it, expect } from 'vitest';
import {
  buildManifestFlowSteps,
  parseInstructions,
  type FlowLabels,
} from '@/features/console/lib/manifest-flow';
import en from '@/features/console/locales/en.json';

const labels = en.console.manifest.flow as FlowLabels;

const TRANSFER_MANIFEST = `
CALL_METHOD
    Address("account_rdx12sender")
    "withdraw"
    Address("resource_rdx1token")
    Decimal("100")
;
TAKE_FROM_WORKTOP
    Address("resource_rdx1token")
    Decimal("100")
    Bucket("bucket1")
;
CALL_METHOD
    Address("account_rdx12receiver")
    "try_deposit_or_abort"
    Bucket("bucket1")
    Enum<0u8>()
;
`;

describe('parseInstructions', () => {
  it('splits a manifest into named instructions', () => {
    const instructions = parseInstructions(TRANSFER_MANIFEST);
    expect(instructions.map((i) => i.name)).toEqual([
      'CALL_METHOD',
      'TAKE_FROM_WORKTOP',
      'CALL_METHOD',
    ]);
  });

  it('ignores semicolons inside strings', () => {
    const instructions = parseInstructions(
      'SET_METADATA Address("account_rdx1x") "description" Enum<Metadata::String>("a;b") ;',
    );
    expect(instructions).toHaveLength(1);
    expect(instructions[0].name).toBe('SET_METADATA');
  });
});

describe('buildManifestFlowSteps', () => {
  it('returns null for empty input', () => {
    expect(buildManifestFlowSteps('', labels)).toBeNull();
    expect(buildManifestFlowSteps('   not an instruction', labels)).toBeNull();
  });

  it('builds detailed steps for a transfer', () => {
    const steps = buildManifestFlowSteps(TRANSFER_MANIFEST, labels)!;
    expect(steps.map((s) => s.kind)).toEqual(['withdraw', 'take', 'deposit']);

    const [withdraw, take, deposit] = steps;
    expect(withdraw.title).toBe(labels.steps.withdraw.title);
    expect(withdraw.description).toContain('100');
    expect(withdraw.details).toContainEqual({
      label: labels.detailLabels.account,
      value: 'account_rdx12sender',
      mono: true,
    });
    expect(withdraw.details).toContainEqual({
      label: labels.detailLabels.resource,
      value: 'resource_rdx1token',
      mono: true,
    });

    expect(take.instruction).toBe('TAKE_FROM_WORKTOP');
    expect(take.details).toContainEqual({
      label: labels.detailLabels.bucket,
      value: 'bucket1',
      mono: true,
    });

    expect(deposit.details).toContainEqual({
      label: labels.detailLabels.account,
      value: 'account_rdx12receiver',
      mono: true,
    });
  });

  it('describes metadata keys without confusing wrapped strings', () => {
    const steps = buildManifestFlowSteps(
      'SET_METADATA Address("account_rdx1x") "name" Enum<Metadata::String>("My dApp") ;',
      labels,
    )!;
    expect(steps[0].kind).toBe('metadata');
    expect(steps[0].description).toContain('"name"');
    expect(steps[0].details).toContainEqual({
      label: labels.detailLabels.metadataKey,
      value: 'name',
      mono: true,
    });
  });

  it('describes creation, publication and function calls', () => {
    const manifest = `
      CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY None true 18u8 Decimal("1000") Tuple() Tuple() None ;
      PUBLISH_PACKAGE_ADVANCED None Tuple() Blob("abc") Map<String, Tuple>() None ;
      CALL_FUNCTION Address("package_rdx1pkg") "Gumball" "instantiate" ;
    `;
    const steps = buildManifestFlowSteps(manifest, labels)!;
    expect(steps.map((s) => s.kind)).toEqual(['create', 'publish', 'call']);
    expect(steps[0].description).toContain('1000');
    expect(steps[2].description).toContain('instantiate');
    expect(steps[2].details).toContainEqual({
      label: labels.detailLabels.blueprint,
      value: 'Gumball',
      mono: true,
    });
  });

  it('falls back to a generic step for unknown instructions', () => {
    const steps = buildManifestFlowSteps('SOME_FUTURE_INSTRUCTION Tuple() ;', labels)!;
    expect(steps[0].kind).toBe('other');
    expect(steps[0].description).toContain('SOME_FUTURE_INSTRUCTION');
  });
});

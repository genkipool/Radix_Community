import { describe, it, expect } from 'vitest';
import {
  assignBucketNames,
  availableBuckets,
  buildManifestFromBlocks,
  isBlockComplete,
  type BlockInstance,
} from '@/features/console/lib/manifest-blocks';

const block = (
  type: BlockInstance['type'],
  values: Record<string, string>,
  id: string = type,
): BlockInstance => ({
  id,
  type,
  values,
});

describe('manifest blocks', () => {
  it('validates required fields, allowing optional ones to be empty', () => {
    expect(isBlockComplete(block('withdraw', { account: 'account_rdx1a', resource: 'resource_rdx1r', amount: '5' }))).toBe(true);
    expect(isBlockComplete(block('withdraw', { account: 'account_rdx1a', resource: '', amount: '5' }))).toBe(false);
    expect(isBlockComplete(block('proof', { account: 'account_rdx1a', resource: 'resource_rdx1r' }))).toBe(true);
  });

  it('auto-names buckets in order and offers only earlier buckets', () => {
    const blocks = [
      block('takeAllFromWorktop', { resource: 'resource_rdx1r' }, 'take1'),
      block('depositBucket', { account: 'account_rdx1a', bucket: '' }, 'dep1'),
      block('takeFromWorktop', { resource: 'resource_rdx1r', amount: '1' }, 'take2'),
    ];
    const names = assignBucketNames(blocks);
    expect(names.get('take1')).toBe('bucket1');
    expect(names.get('take2')).toBe('bucket2');
    expect(availableBuckets(blocks, 'dep1')).toEqual(['bucket1']);
    expect(availableBuckets(blocks, 'take1')).toEqual([]);
  });

  it('builds a transfer manifest from a withdraw/take/deposit stack', () => {
    const blocks = [
      block('withdraw', { account: 'account_rdx1sender', resource: 'resource_rdx1r', amount: '10' }),
      block('takeFromWorktop', { resource: 'resource_rdx1r', amount: '10' }, 'take'),
      block('depositBucket', { account: 'account_rdx1dest', bucket: 'bucket1' }),
    ];
    const { manifest, incompleteIds } = buildManifestFromBlocks(blocks);
    expect(incompleteIds).toEqual([]);
    expect(manifest).toContain('"withdraw"');
    expect(manifest).toContain('TAKE_FROM_WORKTOP');
    expect(manifest).toContain('Bucket("bucket1")');
    expect(manifest).toContain('"try_deposit_or_abort"');
    expect(manifest).toContain('account_rdx1dest');
  });

  it('skips incomplete blocks and reports their ids', () => {
    const blocks = [
      block('withdraw', { account: 'account_rdx1a', resource: 'resource_rdx1r', amount: '1' }, 'ok'),
      block('depositAll', {}, 'missing'),
    ];
    const { manifest, incompleteIds } = buildManifestFromBlocks(blocks);
    expect(incompleteIds).toEqual(['missing']);
    expect(manifest).toContain('"withdraw"');
    expect(manifest).not.toContain('deposit_batch');
  });

  it('escapes quotes in metadata blocks and appends ; to raw blocks', () => {
    const blocks = [
      block('setMetadata', { entity: 'account_rdx1a', metadataKey: 'name', value: 'My "dApp"' }),
      block('raw', { instructions: 'DROP_ALL_PROOFS' }),
    ];
    const { manifest } = buildManifestFromBlocks(blocks);
    expect(manifest).toContain('My \\"dApp\\"');
    expect(manifest).toContain('DROP_ALL_PROOFS\n;');
  });
});

import { describe, it, expect } from 'vitest';
import {
  assignBlockNames,
  assignBucketNames,
  availableBuckets,
  availableProofs,
  BLOCK_CATEGORIES,
  BLOCK_DEFS,
  BLOCK_PALETTE,
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

  it('includes incomplete blocks in the manifest but reports their ids', () => {
    const blocks = [
      block('withdraw', { account: 'account_rdx1a', resource: 'resource_rdx1r', amount: '1' }, 'ok'),
      block('depositAll', {}, 'missing'),
    ];
    const { manifest, incompleteIds } = buildManifestFromBlocks(blocks);
    expect(incompleteIds).toEqual(['missing']);
    expect(manifest).toContain('"withdraw"');
    expect(manifest).toContain('deposit_batch');
  });

  it('exposes every block through exactly one palette category', () => {
    expect([...BLOCK_PALETTE].sort()).toEqual(Object.keys(BLOCK_DEFS).sort());
    expect(new Set(BLOCK_PALETTE).size).toBe(BLOCK_PALETTE.length);
    expect(BLOCK_CATEGORIES.flatMap((category) => category.blocks)).toEqual(BLOCK_PALETTE);
  });

  it('auto-names proofs in order and offers only earlier proofs', () => {
    const blocks = [
      block('popFromAuthZone', {}, 'pop'),
      block('cloneProof', { proof: 'proof1' }, 'clone'),
      block('dropProof', { proof: '' }, 'drop'),
    ];
    const { proofs } = assignBlockNames(blocks);
    expect(proofs.get('pop')).toBe('proof1');
    expect(proofs.get('clone')).toBe('proof2');
    expect(availableProofs(blocks, 'clone')).toEqual(['proof1']);
    expect(availableProofs(blocks, 'drop')).toEqual(['proof1', 'proof2']);
  });

  it('builds proof, assert and comment instructions', () => {
    const blocks = [
      block('comment', { text: 'hola' }),
      block('createProofFromAuthZoneOfAmount', { resource: 'resource_rdx1r', amount: '1' }, 'p1'),
      block('pushToAuthZone', { proof: 'proof1' }),
      block('assertWorktopIsEmpty', {}),
      block('dropAuthZoneRegularProofs', {}),
    ];
    const { manifest, incompleteIds } = buildManifestFromBlocks(blocks);
    expect(incompleteIds).toEqual([]);
    expect(manifest).toContain('# hola');
    expect(manifest).toContain('CREATE_PROOF_FROM_AUTH_ZONE_OF_AMOUNT');
    expect(manifest).toContain('Proof("proof1")');
    expect(manifest).toContain('PUSH_TO_AUTH_ZONE');
    expect(manifest).toContain('ASSERT_WORKTOP_IS_EMPTY;');
    expect(manifest).toContain('DROP_AUTH_ZONE_REGULAR_PROOFS;');
  });

  it('names address reservations and splits comma-separated NFT ids', () => {
    const blocks = [
      block('allocateGlobalAddress', { packageAddress: 'package_rdx1p', blueprint: 'Account' }, 'alloc'),
      block('takeNonFungiblesFromWorktop', { resource: 'resource_rdx1r', nftIds: '#1#, #2#' }, 'take'),
    ];
    const { manifest } = buildManifestFromBlocks(blocks);
    expect(manifest).toContain('AddressReservation("reservation1")');
    expect(manifest).toContain('NamedAddress("address1")');
    expect(manifest).toContain('NonFungibleLocalId("#1#"), NonFungibleLocalId("#2#")');
  });

  it('builds the create-resource snippets with metadata and deposit', () => {
    const fungible = buildManifestFromBlocks([
      block('snippetCreateFungible', {
        account: 'account_rdx1a',
        name: 'Token',
        symbol: 'TKN',
        initialSupply: '100',
      }),
    ]).manifest;
    expect(fungible).toContain('CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY');
    expect(fungible).toContain('18u8');
    expect(fungible).toContain('"try_deposit_batch_or_abort"');

    const nonFungible = buildManifestFromBlocks([
      block('snippetCreateNonFungible', { account: 'account_rdx1a', name: 'Col', nftName: 'First' }),
    ]).manifest;
    expect(nonFungible).toContain('CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY');
    expect(nonFungible).toContain('NonFungibleLocalId("#0#")');
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

// @vitest-environment node
/**
 * ROLA verification against a real Radix Engine ledger (resim).
 *
 * The wallet cannot run inside a test, so the wallet's side is played by keys
 * we hold: resim creates the accounts and keeps their `owner_keys`, the test
 * signs ROLA challenges exactly as the wallet does, and `verifyRolaProofs`
 * reads `owner_keys` straight from the resim ledger.
 *
 * resim runs with HOME pointed at a temporary directory so the developer's own
 * simulator ledger (~/.scrypto) is never touched. Skipped when resim is not
 * installed (CI).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hexToBytes } from '@noble/curves/utils.js';
import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import {
  generateRolaChallenge,
  publicKeyHash,
  rolaSignatureMessage,
  verifyRolaProofs,
  type OwnerKeysLookup,
  type RolaProof,
} from '@/services/rola/verify';

const SIMULATOR = 242;
const XRD = 'resource_sim1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxakj8n3';
const DAPP = 'account_sim1cyvgx33089ukm2pl97pv4max0x40ruvfy4lt60yvya744cve475w0q';
const ORIGIN = 'https://example.com';

const RESIM = [join(homedir(), '.cargo/bin/resim'), 'resim'].find((bin) => {
  try {
    execFileSync(bin, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});

let home = '';
const resim = (...args: string[]) =>
  execFileSync(RESIM!, args, {
    cwd: home,
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const bytesToHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

/** `owner_keys` as resim prints them: PublicKeyHash([86, 252, …]) per key. */
const resimOwnerKeys: OwnerKeysLookup = async (address) => {
  let out: string;
  try {
    out = resim('show', address);
  } catch {
    return []; // never used on-ledger: a virtual entity has no metadata yet
  }
  const line = out.split('\n').find((l) => l.includes('owner_keys:')) ?? '';
  return [...line.matchAll(/PublicKeyHash\(\[([\d,\s]+)\]\)/g)].map((m) =>
    bytesToHex(Uint8Array.from(m[1].split(',').map((n) => Number(n.trim())))),
  );
};

/** Signs a challenge the way the Radix Wallet does. */
function walletProof(
  type: RolaProof['type'],
  address: string,
  key: { curve: 'secp256k1' | 'curve25519'; privateKey: string; publicKey: string },
  challenge: string,
  origin = ORIGIN,
): RolaProof {
  const message = hexToBytes(rolaSignatureMessage(challenge, DAPP, origin));
  const privateKey = hexToBytes(key.privateKey);
  const signature =
    key.curve === 'curve25519'
      ? bytesToHex(ed25519.sign(message, privateKey))
      : // Recovery byte first, then r ‖ s: the wallet's 65-byte format. The
        // message is already a hash, so no sha256 on top of it.
        bytesToHex(secp256k1.sign(message, privateKey, { prehash: false, format: 'recovered' }));
  return { type, address, proof: { curve: key.curve, publicKey: key.publicKey, signature } };
}

const verify = (challenge: string, proofs: RolaProof[]) =>
  verifyRolaProofs({
    networkId: SIMULATOR,
    dAppDefinitionAddress: DAPP,
    origin: ORIGIN,
    challenge,
    proofs,
    ownerKeys: resimOwnerKeys,
  });

describe.skipIf(!RESIM)('ROLA verification on a resim ledger', () => {
  // resim's own account: allocated, owned by a badge, no owner_keys metadata.
  let allocated: { address: string; badge: string; key: { curve: 'secp256k1'; privateKey: string; publicKey: string } };
  // The same secp256k1 key's virtual (preallocated) account, instantiated on-ledger.
  let virtualSecp: string;
  // An Ed25519 key — the curve the Radix Wallet uses for its accounts.
  const edPrivate = ed25519.utils.randomSecretKey();
  const edKey = { curve: 'curve25519' as const, privateKey: bytesToHex(edPrivate), publicKey: bytesToHex(ed25519.getPublicKey(edPrivate)) };
  let virtualEd: string;
  let virtualIdentity: string;

  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), 'rola-resim-'));
    const created = resim('new-account');
    const field = (label: string) => created.match(new RegExp(`${label}: (\\S+)`))![1];
    allocated = {
      address: field('Account component address'),
      badge: field('Owner badge'),
      key: { curve: 'secp256k1', privateKey: field('Private key'), publicKey: field('Public key') },
    };
  }, 120_000);

  afterAll(() => {
    if (home) rmSync(home, { recursive: true, force: true });
  });

  beforeAll(async () => {
    virtualSecp = await RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
      new PublicKey.Secp256k1(allocated.key.publicKey),
      SIMULATOR,
    );
    virtualEd = await RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
      new PublicKey.Ed25519(edKey.publicKey),
      SIMULATOR,
    );
    virtualIdentity = await RadixEngineToolkit.Derive.virtualIdentityAddressFromPublicKey(
      new PublicKey.Ed25519(edKey.publicKey),
      SIMULATOR,
    );
    // A deposit instantiates a virtual account, which sets its owner_keys.
    resim('transfer', `${XRD}:10`, virtualSecp);
    resim('transfer', `${XRD}:10`, virtualEd);
  }, 120_000);

  it('the ledger lists the key hash in owner_keys of an instantiated virtual account', async () => {
    expect(await resimOwnerKeys(virtualEd)).toEqual([publicKeyHash(edKey.publicKey)]);
    expect(await resimOwnerKeys(virtualSecp)).toEqual([publicKeyHash(allocated.key.publicKey)]);
  });

  it('accepts account proofs on both curves through owner_keys', async () => {
    const challenge = generateRolaChallenge();
    const results = await verify(challenge, [
      walletProof('account', virtualEd, edKey, challenge),
      walletProof('account', virtualSecp, allocated.key, challenge),
    ]);
    expect(results.map((r) => [r.verified, r.method])).toEqual([
      [true, 'ownerKeys'],
      [true, 'ownerKeys'],
    ]);
  });

  it('accepts a persona proof with no addresses shared, via the derived identity', async () => {
    const challenge = generateRolaChallenge();
    const [result] = await verify(challenge, [walletProof('persona', virtualIdentity, edKey, challenge)]);
    expect(result).toMatchObject({ verified: true, method: 'derivedAddress', type: 'persona' });
  });

  it('rejects a signature over another challenge, origin or tampered bytes', async () => {
    const challenge = generateRolaChallenge();
    const other = generateRolaChallenge();
    const tampered = walletProof('account', virtualEd, edKey, challenge);
    tampered.proof.signature = tampered.proof.signature.replace(/^./, (c) => (c === '0' ? '1' : '0'));
    const results = await verify(challenge, [
      walletProof('account', virtualEd, edKey, other),
      walletProof('account', virtualEd, edKey, challenge, 'https://evil.example'),
      tampered,
    ]);
    expect(results.map((r) => r.reason)).toEqual(['invalidSignature', 'invalidSignature', 'invalidSignature']);
  });

  it('rejects a valid signature from a key that does not control the account', async () => {
    const challenge = generateRolaChallenge();
    const [stolen] = await verify(challenge, [walletProof('account', virtualSecp, edKey, challenge)]);
    expect(stolen).toMatchObject({ verified: false, reason: 'keyNotInOwnerKeys' });
  });

  it('rejects an allocated account without owner_keys, then accepts it after a key rotation', async () => {
    const before = generateRolaChallenge();
    const [noKeys] = await verify(before, [walletProof('account', allocated.address, allocated.key, before)]);
    expect(noKeys).toMatchObject({ verified: false, reason: 'addressNotDerivedFromKey' });

    // The owner (badge holder) publishes the Ed25519 key as the account's owner key.
    const [badgeResource, badgeId] = allocated.badge.split(':');
    const manifest = join(home, 'rotate.rtm');
    writeFileSync(
      manifest,
      `CALL_METHOD Address("${allocated.address}") "lock_fee" Decimal("10");
CALL_METHOD Address("${allocated.address}") "create_proof_of_non_fungibles" Address("${badgeResource}") Array<NonFungibleLocalId>(NonFungibleLocalId("${badgeId}"));
SET_METADATA Address("${allocated.address}") "owner_keys" Enum<Metadata::PublicKeyHashArray>(Array<Enum>(Enum<PublicKeyHash::Ed25519>(Bytes("${publicKeyHash(edKey.publicKey)}"))));
`,
    );
    resim('run', manifest);

    const after = generateRolaChallenge();
    const results = await verify(after, [
      walletProof('account', allocated.address, edKey, after),
      walletProof('account', allocated.address, allocated.key, after),
    ]);
    expect(results.map((r) => [r.verified, r.reason ?? r.method])).toEqual([
      [true, 'ownerKeys'],
      [false, 'keyNotInOwnerKeys'],
    ]);
  }, 60_000);

  it('rejects a proof whose type does not match the address, and a malformed challenge', async () => {
    const challenge = generateRolaChallenge();
    const [wrongType] = await verify(challenge, [walletProof('persona', virtualEd, edKey, challenge)]);
    expect(wrongType.reason).toBe('typeMismatch');
    const [badChallenge] = await verify('abc', [walletProof('account', virtualEd, edKey, challenge)]);
    expect(badChallenge.reason).toBe('invalidChallenge');
  });
});

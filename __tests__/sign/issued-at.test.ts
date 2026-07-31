import { describe, expect, it } from 'vitest';
import {
  buildCipherReceiptManifest,
  buildSignRequestManifest,
  buildSignatureMintManifest,
} from '@/features/sign/lib/sign-request';

const ACCOUNT =
  'account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw';
const SIGNER_2 =
  'account_rdx1283533slsjtx5r5efdj8c9864vsrg3p3vrw9cr25qyq8f0adlvvuc7';
const SEAL_RESOURCE =
  'resource_rdx1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxxed25sg';
const SEAL_GID = `${SEAL_RESOURCE}:{1111111111111111-2222222222222222-3333333333333333-4444444444444444}`;
const COLLECTION =
  'resource_rdx1nfxxxxxxxxxxsecpsgxxxxxxxxx004638826440xxxxxxxxxsecpsg';
const DOC_HASH =
  '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

/** A time from the ledger, deliberately not "now". */
const LEDGER_TIME = '2026-07-31T20:27:05.000Z';

const signatureArgs = {
  account: ACCOUNT,
  sealGlobalId: SEAL_GID,
  collection: COLLECTION,
  nextId: 4,
  docHash: DOC_HASH,
  networkId: 1,
  request: '',
  imageUrl: '',
  issuedAt: LEDGER_TIME,
};

/**
 * `issued_at` is written before the transaction commits — a mint cannot know
 * the consensus time of its own transaction — so the field is unavoidably a
 * claim. What these tests pin down is WHOSE claim: the builder must not be able
 * to reach for the machine's clock, so the caller (which reads the ledger's) is
 * the only thing that can put a date in an NFT.
 */
describe('issued_at comes from the caller, never from the builder', () => {
  it('writes exactly the time it was given into a signature NFT', () => {
    expect(buildSignatureMintManifest(signatureArgs)).toContain(LEDGER_TIME);
  });

  it('writes it into every invitation of a batch and the bundled signature', () => {
    const manifest = buildSignRequestManifest({
      account: ACCOUNT,
      sealGlobalId: SEAL_GID,
      collection: COLLECTION,
      nextId: 1,
      docHash: DOC_HASH,
      networkId: 1,
      requiredSigners: [ACCOUNT, SIGNER_2],
      alsoSign: true,
      imageUrl: '',
      issuedAt: LEDGER_TIME,
    });
    // Two invitations plus the initiator's own signature.
    expect(manifest.split(LEDGER_TIME).length - 1).toBe(3);
  });

  it('writes it into a cipher receipt too', () => {
    const manifest = buildCipherReceiptManifest({
      account: ACCOUNT,
      sealGlobalId: SEAL_GID,
      collection: COLLECTION,
      nextId: 2,
      headerHash: DOC_HASH,
      networkId: 1,
      inviteCollection: COLLECTION,
      imageUrl: '',
      issuedAt: LEDGER_TIME,
    });
    expect(manifest).toContain(LEDGER_TIME);
  });

  it('is deterministic: the same input always yields the same manifest', () => {
    expect(buildSignatureMintManifest(signatureArgs)).toBe(
      buildSignatureMintManifest(signatureArgs),
    );
  });

  it('never slips today into the manifest on its own', () => {
    const manifest = buildSignatureMintManifest(signatureArgs);
    const today = new Date().toISOString().slice(0, 10);
    // Guards the test itself against being run on the fixture's own date.
    if (today !== LEDGER_TIME.slice(0, 10)) {
      expect(manifest).not.toContain(today);
    }
  });
});

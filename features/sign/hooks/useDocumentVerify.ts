'use client';

import { useState } from 'react';
import { blake2b256Hex } from '../lib/hash';
import { verifyEnvelope } from '../services/signApi';
import type { AttestationEnvelope, VerifyResult } from '../types/sign.types';

export interface VerifyOutcome extends VerifyResult {
  /** The re-hashed file matches the hash committed in the certificate. */
  fileMatches: boolean;
  /** Overall verdict: file matches AND signature valid AND (on-chain ok or absent). */
  ok: boolean;
}

/**
 * Verifies a certificate against its original file. The file is hashed IN THE
 * BROWSER and compared locally; only the (small) certificate is sent to the
 * server for the cryptographic + on-ledger checks. The file never leaves.
 */
export function useDocumentVerify() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);

  const reset = () => {
    setError(null);
    setOutcome(null);
    setIsVerifying(false);
  };

  const verify = async (
    fileBytes: Uint8Array,
    envelope: AttestationEnvelope,
  ): Promise<VerifyOutcome | null> => {
    setIsVerifying(true);
    setError(null);
    setOutcome(null);
    try {
      const fileMatches = blake2b256Hex(fileBytes) === envelope.payload.docHash;
      const server = await verifyEnvelope(envelope);
      const ok =
        fileMatches &&
        server.allValid &&
        server.complete &&
        (server.onChainValid === null || server.onChainValid === true);
      const result: VerifyOutcome = { ...server, fileMatches, ok };
      setOutcome(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
      return null;
    } finally {
      setIsVerifying(false);
    }
  };

  return { verify, isVerifying, error, outcome, reset };
}

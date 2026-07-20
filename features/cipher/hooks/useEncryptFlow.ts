'use client';

import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { NETWORKS } from '@/features/wallet/constants/network';
import { downloadBytes } from '@/features/sign/lib/certificate';
import { findSignCollection } from '@/features/sign/services/sealDiscovery';
import { FILE_EXTENSION } from '../constants/cipher';
import type { CipherErrorCode, CipherHeader } from '../types/cipher.types';
import { buildHeader, encodeContainerHead } from '../lib/container';
import { encryptToSink } from '../lib/encrypt';
import { toCipherErrorCode } from '../lib/errors';
import {
  assembleContainerBlob,
  deleteFile,
  newFileId,
  putChunk,
  putFileMeta,
  updateFileMeta,
} from '../lib/idb';
import { importAesKey, randomBaseIvHex, randomFileSaltHex } from '../lib/keys';
import { useCipherKey } from './useCipherKey';

export type EncryptPhase = 'idle' | 'signing' | 'encrypting' | 'ready' | 'error';

export interface EncryptResult {
  fileId: string;
  header: CipherHeader;
  headerHash: string;
  encryptedName: string;
}

/**
 * Encrypt tab state machine: sign → derive key → stream-encrypt into
 * IndexedDB → offer download / share. The plaintext is read chunk by chunk
 * from the File handle; nothing is uploaded anywhere.
 */
export function useEncryptFlow() {
  const { activeNetworkId } = useRadixWallet();
  const { requestKey } = useCipherKey();
  const [phase, setPhase] = useState<EncryptPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<EncryptResult | null>(null);
  const [error, setError] = useState<CipherErrorCode | null>(null);

  async function encrypt(
    file: File,
    options?: { access: 'rola-ledger' },
  ): Promise<void> {
    if (activeNetworkId == null) return;
    setError(null);
    setProgress(0);
    setPhase('signing');
    const fileId = newFileId();
    try {
      const fileSalt = randomFileSaltHex();
      const grant = await requestKey(fileSalt);

      // ROLA + Ledger: the invitations mint into the SIGNING account's
      // collection, which is only known after the grant (the wallet picks the
      // account). Without a collection the mode cannot work — fail early.
      let ledgerFields: { access: 'rola-ledger'; inviteCollection: string } | undefined;
      if (options?.access === 'rola-ledger') {
        const collection = await findSignCollection(activeNetworkId, grant.account);
        if (!collection) throw new Error('no_collection');
        ledgerFields = {
          access: 'rola-ledger',
          inviteCollection: collection.resourceAddress,
        };
      }

      const header = buildHeader({
        ...ledgerFields,
        fileSalt,
        baseIv: randomBaseIvHex(),
        fileSize: file.size,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        senderAccount: grant.account,
        senderPublicKey: grant.publicKey,
        networkId: activeNetworkId,
        dAppDefinitionAddress: NETWORKS[activeNetworkId].dAppDefinitionAddress,
        origin: window.location.origin,
      });
      const { bytes: headBytes, headerHash } = encodeContainerHead(header);

      setPhase('encrypting');
      const key = await importAesKey(grant.keyBits);
      const encryptedName = `${file.name}${FILE_EXTENSION}`;
      await putFileMeta({
        id: fileId,
        kind: 'encrypted-local',
        fileName: file.name,
        encryptedName,
        headBytes: new Blob([headBytes as Uint8Array<ArrayBuffer>]),
        headerHash,
        chunkCount: header.chunkCount,
        receivedChunks: header.chunkCount,
        complete: false,
        createdAt: Date.now(),
      });
      await encryptToSink(
        file,
        key,
        header,
        headerHash,
        (index, bytes) => putChunk(fileId, index, new Blob([bytes as Uint8Array<ArrayBuffer>])),
        setProgress,
      );
      await updateFileMeta(fileId, { complete: true });

      setResult({ fileId, header, headerHash, encryptedName });
      setPhase('ready');
    } catch (e) {
      await deleteFile(fileId).catch(() => undefined);
      setError(toCipherErrorCode(e));
      setPhase('error');
    }
  }

  async function download(): Promise<void> {
    if (!result) return;
    try {
      downloadBytes(await assembleContainerBlob(result.fileId), result.encryptedName);
    } catch (e) {
      setError(toCipherErrorCode(e));
      setPhase('error');
    }
  }

  async function reset(): Promise<void> {
    if (result) await deleteFile(result.fileId).catch(() => undefined);
    setPhase('idle');
    setProgress(0);
    setResult(null);
    setError(null);
  }

  return { phase, progress, result, error, encrypt, download, reset };
}

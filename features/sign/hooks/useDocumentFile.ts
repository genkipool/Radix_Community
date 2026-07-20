'use client';

import { useState } from 'react';
import { blake2b256Hex } from '../lib/hash';
import { readFileBytes, isPdf } from '../lib/file';
import { extractRequestPointer } from '../lib/pdf-extract';
import type { SignDictionary } from '../types/dictionary';

/** On-ledger request auto-detected inside a dropped (carrier) PDF. */
export interface EmbeddedRequestInfo {
  requestKey: string;
  networkId: number;
}

export interface DocumentFile {
  file: File | null;
  bytes: Uint8Array | null;
  docHash: string;
  hashing: boolean;
  fileError: string;
  pdf: boolean;
  /**
   * Set when the dropped PDF carries an embedded signing-request pointer.
   * `bytes`/`docHash` then refer to the ORIGINAL document recovered from
   * inside the PDF (the request's hash source), not the carrier file.
   */
  embeddedRequest: EmbeddedRequestInfo | null;
  onFile: (picked: File | null) => Promise<void>;
}

/**
 * Shared document file state (hashed in-browser). Lifted to the tool level so it
 * persists across the Sign / Verify tabs instead of resetting on tab switch.
 */
export function useDocumentFile(t: SignDictionary): DocumentFile {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [docHash, setDocHash] = useState('');
  const [hashing, setHashing] = useState(false);
  const [fileError, setFileError] = useState('');
  const [embeddedRequest, setEmbeddedRequest] =
    useState<EmbeddedRequestInfo | null>(null);

  const onFile = async (picked: File | null) => {
    setFileError('');
    setEmbeddedRequest(null);
    if (!picked) {
      setFile(null);
      setBytes(null);
      setDocHash('');
      return;
    }
    setFile(picked);
    setHashing(true);
    try {
      const b = await readFileBytes(picked);
      // A shared PDF may carry the on-ledger request + the original document
      // inside it — sign against the original, and auto-load the request.
      const embedded = isPdf(picked)
        ? await extractRequestPointer(b).catch(() => null)
        : null;
      if (embedded?.originalBytes) {
        setBytes(embedded.originalBytes);
        setDocHash(blake2b256Hex(embedded.originalBytes));
        setEmbeddedRequest({
          requestKey: embedded.pointer.requestKey,
          networkId: embedded.pointer.networkId,
        });
      } else {
        setBytes(b);
        setDocHash(blake2b256Hex(b));
      }
    } catch (e) {
      setFileError(
        e instanceof Error && e.message === 'too_large'
          ? t.file.tooLarge
          : t.file.readError,
      );
      setFile(null);
      setBytes(null);
      setDocHash('');
    } finally {
      setHashing(false);
    }
  };

  return {
    file,
    bytes,
    docHash,
    hashing,
    fileError,
    pdf: file ? isPdf(file) : false,
    embeddedRequest,
    onFile,
  };
}

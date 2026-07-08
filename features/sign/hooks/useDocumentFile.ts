'use client';

import { useState } from 'react';
import { blake2b256Hex } from '../lib/hash';
import { readFileBytes, isPdf } from '../lib/file';
import type { SignDictionary } from '../types/dictionary';

export interface DocumentFile {
  file: File | null;
  bytes: Uint8Array | null;
  docHash: string;
  hashing: boolean;
  fileError: string;
  pdf: boolean;
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

  const onFile = async (picked: File | null) => {
    setFileError('');
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
      setBytes(b);
      setDocHash(blake2b256Hex(b));
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
    onFile,
  };
}

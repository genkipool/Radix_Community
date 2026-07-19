/**
 * Local persistence for encrypted containers, chunk by chunk, in IndexedDB.
 * Chunks are stored as Blobs (disk-backed in Chromium/Firefox) so assembling
 * the final container never copies the ciphertext through JS memory.
 */
import { IDB_NAME, IDB_TTL_MS } from '../constants/cipher';

export interface CipherFileMeta {
  id: string;
  kind: 'encrypted-local' | 'received';
  /** Original (plaintext) file name, from the header. */
  fileName: string;
  /** Container download name (fileName + .radixseal.enc). */
  encryptedName: string;
  headBytes: Blob;
  headerHash: string;
  chunkCount: number;
  receivedChunks: number;
  complete: boolean;
  createdAt: number;
}

interface ChunkRecord {
  fileId: string;
  index: number;
  bytes: Blob;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error('storage_quota'));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openCipherDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open(IDB_NAME, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore('files', { keyPath: 'id' });
        db.createObjectStore('chunks', { keyPath: ['fileId', 'index'] });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => {
        dbPromise = null;
        reject(new Error('storage_quota'));
      };
    });
  }
  return dbPromise;
}

async function store(
  name: 'files' | 'chunks',
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  const db = await openCipherDb();
  return db.transaction(name, mode).objectStore(name);
}

export function newFileId(): string {
  return crypto.randomUUID();
}

export async function putFileMeta(meta: CipherFileMeta): Promise<void> {
  await request((await store('files', 'readwrite')).put(meta));
}

export async function getFileMeta(id: string): Promise<CipherFileMeta | undefined> {
  return request((await store('files', 'readonly')).get(id));
}

export async function updateFileMeta(
  id: string,
  patch: Partial<CipherFileMeta>,
): Promise<void> {
  const meta = await getFileMeta(id);
  if (!meta) return;
  await putFileMeta({ ...meta, ...patch, id });
}

export async function putChunk(
  fileId: string,
  index: number,
  bytes: Blob,
): Promise<void> {
  const record: ChunkRecord = { fileId, index, bytes };
  await request((await store('chunks', 'readwrite')).put(record));
}

export async function getChunk(
  fileId: string,
  index: number,
): Promise<Blob | undefined> {
  const record: ChunkRecord | undefined = await request(
    (await store('chunks', 'readonly')).get([fileId, index]),
  );
  return record?.bytes;
}

function chunkRangeFor(fileId: string): IDBKeyRange {
  return IDBKeyRange.bound([fileId, 0], [fileId, Infinity]);
}

/** All chunk Blobs of a file, ordered by index (IDB key order). */
export async function getChunkBlobs(fileId: string): Promise<Blob[]> {
  const records: ChunkRecord[] = await request(
    (await store('chunks', 'readonly')).getAll(chunkRangeFor(fileId)),
  );
  return records.map((r) => r.bytes);
}

/** Reassemble head + chunks into one container Blob (disk-backed, no copy). */
export async function assembleContainerBlob(fileId: string): Promise<Blob> {
  const meta = await getFileMeta(fileId);
  if (!meta || !meta.complete) throw new Error('unknown');
  const chunks = await getChunkBlobs(fileId);
  if (chunks.length !== meta.chunkCount) throw new Error('invalid_container');
  return new Blob([meta.headBytes, ...chunks], {
    type: 'application/octet-stream',
  });
}

export async function deleteFile(fileId: string): Promise<void> {
  await request((await store('chunks', 'readwrite')).delete(chunkRangeFor(fileId)));
  await request((await store('files', 'readwrite')).delete(fileId));
}

/** Drop expired files and their chunks; call when the tool mounts. */
export async function cleanupExpired(now = Date.now()): Promise<void> {
  const metas: CipherFileMeta[] = await request(
    (await store('files', 'readonly')).getAll(),
  );
  for (const meta of metas) {
    if (now - meta.createdAt > IDB_TTL_MS) await deleteFile(meta.id);
  }
}

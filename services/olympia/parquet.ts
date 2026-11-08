/**
 * services/olympia/parquet.ts
 *
 * Reads the Olympia ledger archive: Parquet files published by the community
 * (Hugging Face dataset `Genkipool/radix-olympia-gateway-export`, mirrored on
 * archive.org). Olympia ended on 28 September 2023, so the data never changes.
 *
 * Every lookup file is sorted by its key and split into small row groups whose
 * min/max statistics sit in the file footer. A lookup reads the footer once
 * (cached per instance), keeps only the row groups whose range can hold the
 * key, and asks for just those bytes with HTTP range requests. A point lookup
 * downloads a few hundred KB at most; nothing is ever read in full.
 *
 * `OLYMPIA_DATA_BASE_URL` points at the dataset (default: the Hugging Face
 * `resolve/main` URL). A local folder path also works, for development.
 */
import 'server-only';
import { asyncBufferFromFile, asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'hyparquet';
import type { AsyncBuffer, FileMetaData } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const DEFAULT_BASE = 'https://huggingface.co/datasets/Genkipool/radix-olympia-gateway-export/resolve/main';

export function olympiaBaseUrl(): string {
    return (process.env.OLYMPIA_DATA_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
}

export type Row = Record<string, unknown>;
type Key = string | bigint;

interface OpenFile {
    file: AsyncBuffer;
    metadata: FileMetaData;
    /** First row index of each row group. */
    starts: number[];
}

const opened = new Map<string, Promise<OpenFile>>();

/** Keeps every byte range already fetched for a file, so a footer is never fetched twice. */
function memo(file: AsyncBuffer): AsyncBuffer {
    const cache = new Map<string, Promise<ArrayBuffer>>();
    return {
        byteLength: file.byteLength,
        slice(start: number, end?: number) {
            const key = `${start}-${end ?? ''}`;
            let hit = cache.get(key);
            if (!hit) {
                hit = Promise.resolve(file.slice(start, end));
                if (cache.size > 256) cache.clear();
                cache.set(key, hit);
                hit.catch(() => cache.delete(key));
            }
            return hit;
        },
    };
}

async function open(path: string): Promise<OpenFile> {
    const base = olympiaBaseUrl();
    const raw = base.startsWith('/') || base.startsWith('file:')
        ? await asyncBufferFromFile(`${base.replace(/^file:\/\//, '')}/${path}`)
        : await asyncBufferFromUrl({ url: `${base}/${path}` });
    const file = memo(raw);
    const metadata = await parquetMetadataAsync(file);
    const starts: number[] = [];
    let at = 0;
    for (const rg of metadata.row_groups) {
        starts.push(at);
        at += Number(rg.num_rows);
    }
    return { file, metadata, starts };
}

function openCached(path: string): Promise<OpenFile> {
    let p = opened.get(path);
    if (!p) {
        p = open(path);
        opened.set(path, p);
        p.catch(() => opened.delete(path));
    }
    return p;
}

function columnIndex(meta: FileMetaData, column: string): number {
    // schema[0] is the root; leaf columns follow in row-group column order (flat files only).
    const idx = meta.schema.slice(1).findIndex((s) => s.name === column);
    if (idx < 0) throw new Error(`olympia: column ${column} not found`);
    return idx;
}

function cmp(a: Key, b: Key): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function asKey(v: unknown): Key | undefined {
    if (typeof v === 'bigint' || typeof v === 'string') return v;
    if (typeof v === 'number') return BigInt(v);
    if (v instanceof Uint8Array) return Buffer.from(v).toString('hex');
    if (v instanceof Date) return BigInt(v.getTime());
    return undefined;
}

/** Row groups whose [min, max] range for `column` overlaps [lo, hi]. */
function groupsInRange(of: OpenFile, column: string, lo: Key, hi: Key): number[] {
    const ci = columnIndex(of.metadata, column);
    const out: number[] = [];
    of.metadata.row_groups.forEach((rg, i) => {
        const st = rg.columns[ci]?.meta_data?.statistics;
        const min = asKey(st?.min_value ?? st?.min);
        const max = asKey(st?.max_value ?? st?.max);
        if (min === undefined || max === undefined) {
            out.push(i);
            return;
        }
        if (cmp(max, lo) >= 0 && cmp(min, hi) <= 0) out.push(i);
    });
    return out;
}

async function readGroups(of: OpenFile, groups: number[], columns?: string[]): Promise<Row[]> {
    const parts = await Promise.all(groups.map((g) => parquetReadObjects({
        file: of.file,
        metadata: of.metadata,
        rowStart: of.starts[g],
        rowEnd: of.starts[g] + Number(of.metadata.row_groups[g].num_rows),
        columns,
        compressors,
        utf8: false,
    })));
    return parts.flat().map(normalizeRow);
}

/** Binary columns become hex strings; everything else is kept (bigint for 64-bit integers). */
function normalizeRow(row: Row): Row {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) out[k] = v instanceof Uint8Array ? Buffer.from(v).toString('hex') : v;
    return out;
}

function keyOf(row: Row, column: string): Key | undefined {
    return asKey(row[column]);
}

/**
 * Rows of a file sorted by `column` whose value lies in [lo, hi] (inclusive).
 * Binary keys are compared as lowercase hex.
 */
export async function readRange(path: string, column: string, lo: Key, hi: Key, columns?: string[]): Promise<Row[]> {
    const of = await openCached(path);
    const lok = typeof lo === 'string' ? lo.toLowerCase() : lo;
    const hik = typeof hi === 'string' ? hi.toLowerCase() : hi;
    const groups = groupsInRange(of, column, lok, hik);
    if (groups.length === 0) return [];
    const wanted = columns && !columns.includes(column) ? [...columns, column] : columns;
    const rows = await readGroups(of, groups, wanted);
    return rows.filter((r) => {
        const k = keyOf(r, column);
        return k !== undefined && cmp(k, lok) >= 0 && cmp(k, hik) <= 0;
    });
}

/** Rows whose `column` equals `value`. */
export function readEq(path: string, column: string, value: Key, columns?: string[]): Promise<Row[]> {
    return readRange(path, column, value, value, columns);
}

/**
 * Rows of a file sorted by (keyColumn, orderColumn) whose key equals `key` and
 * whose order value lies in [lo, hi]. Row groups are pruned on both columns, so
 * a short window of a long history reads one or two groups.
 */
export async function readEqWithin(
    path: string,
    keyColumn: string,
    key: Key,
    orderColumn: string,
    lo: bigint,
    hi: bigint,
): Promise<Row[]> {
    const of = await openCached(path);
    const oi = columnIndex(of.metadata, orderColumn);
    const groups = groupsInRange(of, keyColumn, key, key).filter((g) => {
        const st = of.metadata.row_groups[g].columns[oi]?.meta_data?.statistics;
        const min = asKey(st?.min_value ?? st?.min);
        const max = asKey(st?.max_value ?? st?.max);
        if (min === undefined || max === undefined) return true;
        // The order statistics bound every row of the group, whatever its key.
        return cmp(max, lo) >= 0 && cmp(min, hi) <= 0;
    });
    if (groups.length === 0) return [];
    const rows = await readGroups(of, groups);
    return rows.filter((r) => {
        if (cmp(keyOf(r, keyColumn) ?? '', key) !== 0) return false;
        const o = keyOf(r, orderColumn);
        return o !== undefined && cmp(o, lo) >= 0 && cmp(o, hi) <= 0;
    });
}

/**
 * The newest `limit` rows whose `keyColumn` equals `key`, ordered by
 * `orderColumn` descending and strictly below `before` when given. The file must
 * be sorted by (keyColumn, orderColumn): row groups are read from the last one
 * that can hold the key backwards, and reading stops once enough rows are in.
 */
export async function readPageDesc(
    path: string,
    keyColumn: string,
    key: Key,
    orderColumn: string,
    before: bigint | null,
    limit: number,
): Promise<{ rows: Row[]; more: boolean }> {
    const of = await openCached(path);
    const oi = columnIndex(of.metadata, orderColumn);
    const groups = groupsInRange(of, keyColumn, key, key).filter((g) => {
        if (before === null) return true;
        const st = of.metadata.row_groups[g].columns[oi]?.meta_data?.statistics;
        const min = asKey(st?.min_value ?? st?.min);
        return min === undefined || cmp(min, before) < 0;
    });
    const out: Row[] = [];
    let i = groups.length - 1;
    while (i >= 0 && out.length <= limit) {
        // Two groups at a time keeps the round trips low without over-reading.
        const batch = groups.slice(Math.max(0, i - 1), i + 1);
        i -= batch.length;
        const rows = await readGroups(of, batch);
        for (const r of rows) {
            if (cmp(keyOf(r, keyColumn) ?? '', key) !== 0) continue;
            const o = keyOf(r, orderColumn);
            if (o === undefined || (before !== null && cmp(o, before) >= 0)) continue;
            out.push(r);
        }
    }
    out.sort((a, b) => cmp(keyOf(b, orderColumn) ?? 0n, keyOf(a, orderColumn) ?? 0n));
    return { rows: out.slice(0, limit), more: out.length > limit || i >= 0 };
}

/**
 * The newest `limit` rows whose `filterColumn` lies in [lo, hi], ordered by
 * `orderColumn` descending and strictly below `before` when given. For files
 * sorted by `orderColumn` where `filterColumn` grows with it (a timestamp next
 * to the state version), so row groups are pruned on both and read from the
 * newest backwards until the page is full.
 */
export async function readPageDescWithin(
    path: string,
    filterColumn: string,
    lo: Key,
    hi: Key,
    orderColumn: string,
    before: bigint | null,
    limit: number,
    columns?: string[],
): Promise<{ rows: Row[]; more: boolean }> {
    const of = await openCached(path);
    const oi = columnIndex(of.metadata, orderColumn);
    const groups = groupsInRange(of, filterColumn, lo, hi).filter((g) => {
        if (before === null) return true;
        const st = of.metadata.row_groups[g].columns[oi]?.meta_data?.statistics;
        const min = asKey(st?.min_value ?? st?.min);
        return min === undefined || cmp(min, before) < 0;
    });
    const wanted = columns ? [...new Set([...columns, filterColumn, orderColumn])] : undefined;
    const out: Row[] = [];
    let i = groups.length - 1;
    while (i >= 0 && out.length <= limit) {
        const rows = await readGroups(of, [groups[i]], wanted);
        i -= 1;
        for (const r of rows) {
            const f = keyOf(r, filterColumn);
            if (f === undefined || cmp(f, lo) < 0 || cmp(f, hi) > 0) continue;
            const o = keyOf(r, orderColumn);
            if (o === undefined || (before !== null && cmp(o, before) >= 0)) continue;
            out.push(r);
        }
    }
    out.sort((a, b) => cmp(keyOf(b, orderColumn) ?? 0n, keyOf(a, orderColumn) ?? 0n));
    return { rows: out.slice(0, limit), more: out.length > limit || i >= 0 };
}

/** Every row of a small file. */
export async function readAll(path: string, columns?: string[]): Promise<Row[]> {
    const of = await openCached(path);
    return readGroups(of, of.metadata.row_groups.map((_, i) => i), columns);
}

/* ─── Value helpers ─────────────────────────────────────────────────────── */

const ATTO = 10n ** 18n;

/** A text amount in the smallest unit (10^-18) as a decimal string, exact. */
export function attoToDecimal(value: unknown, maxDecimals = 18): string {
    const s = typeof value === 'bigint' ? value.toString() : String(value ?? '0');
    if (!/^-?\d+$/.test(s)) return '0';
    const neg = s.startsWith('-');
    const n = BigInt(neg ? s.slice(1) : s);
    const int = n / ATTO;
    let frac = (n % ATTO).toString().padStart(18, '0').slice(0, maxDecimals).replace(/0+$/, '');
    if (frac === '') frac = '';
    return `${neg && n !== 0n ? '-' : ''}${int.toString()}${frac ? `.${frac}` : ''}`;
}

/** A text amount in the smallest unit as a JS number of whole tokens (for sums and charts). */
export function attoToNumber(value: unknown): number {
    const s = String(value ?? '0');
    if (!/^-?\d+$/.test(s)) return 0;
    return Number(attoToDecimal(s, 18));
}

export function toNum(v: unknown): number {
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function toIso(v: unknown): string | null {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
}

/** For tests. */
export function _resetOlympiaFiles() {
    opened.clear();
}

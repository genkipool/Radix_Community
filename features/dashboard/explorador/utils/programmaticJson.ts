/**
 * Helpers for the Gateway's "programmatic JSON" (SBOR values with their
 * schema names attached). Every accessor tolerates missing or malformed input
 * and returns null / [] instead of throwing, so callers can read optional
 * fields without guarding each step.
 */

export interface PjValue {
    kind?: string;
    field_name?: string;
    type_name?: string;
    value?: unknown;
    variant_id?: string;
    variant_name?: string;
    fields?: PjValue[];
    elements?: PjValue[];
}

const asPj = (v: unknown): PjValue | null => (v && typeof v === 'object' ? v as PjValue : null);

/** Named field of a Tuple or Enum. */
export function pjField(v: unknown, name: string): PjValue | null {
    return asPj(v)?.fields?.find(f => f?.field_name === name) ?? null;
}

/** Follows a chain of field names: pjPath(v, 'a', 'b') is v.a.b. */
export function pjPath(v: unknown, ...names: string[]): PjValue | null {
    return names.reduce<PjValue | null>((cur, name) => (cur ? pjField(cur, name) : null), asPj(v));
}

/** Scalar value as text (String, Url, Decimal, numbers, addresses…). */
export function pjText(v: unknown): string | null {
    const raw = asPj(v)?.value;
    return raw === undefined || raw === null ? null : String(raw);
}

export function pjNumber(v: unknown): number | null {
    const text = pjText(v);
    if (text === null) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
}

/** Elements of an Array. */
export function pjList(v: unknown): PjValue[] {
    return asPj(v)?.elements ?? [];
}

/** Positional fields of a Tuple or Enum. */
export function pjFields(v: unknown): PjValue[] {
    return asPj(v)?.fields ?? [];
}

/** Unwraps Option<T>: the inner value for Some, null for None. */
export function pjOption(v: unknown): PjValue | null {
    const pj = asPj(v);
    if (!pj || pj.kind !== 'Enum') return pj;
    return pj.variant_name === 'Some' ? pj.fields?.[0] ?? null : null;
}

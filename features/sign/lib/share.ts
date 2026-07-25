/**
 * Share-link helpers for on-ledger signing requests.
 *
 * A request key is the first invitation NFT's global id,
 * `<initiator collection>:#<firstId>#`. Because `:` and `#` are hostile inside
 * URLs, shared links use a clean directory format instead:
 *
 *   /<locale>/console/sign-document/r/<collection>/<id>
 *     ?doc=<name>&out=cert-pdf&wm=seal
 *
 * `doc` names the file to upload; `out`/`wm` carry the initiator's delivery
 * choices so co-signers get the exact same output without re-picking anything.
 * The legacy `?req=` query format keeps working for old links.
 */
import type { OutputFormat } from '../types/sign.types';
import type { WatermarkKind } from './pdf-watermark';

const REQUEST_KEY_RE = /^(resource_[a-z0-9_]+):?#?(\d+)#?$/;

/** Parses a canonical or hand-typed request key into its two URL-safe parts. */
export function parseRequestKey(
  key: string,
): { collection: string; id: string } | null {
  const match = key.trim().match(REQUEST_KEY_RE);
  return match ? { collection: match[1], id: match[2] } : null;
}

/** Reads the `?net=` network id a share link carries, or null. */
export function parseNetworkParam(value: string | null): number | null {
  return value === '1' ? 1 : value === '2' ? 2 : null;
}

/** `resource_rdx1…` → 1 (mainnet), `resource_tdx_2_1…` → 2 (stokenet). */
export function networkIdFromResource(address: string): number | null {
  if (address.startsWith('resource_rdx1')) return 1;
  if (address.startsWith('resource_tdx_2_1')) return 2;
  return null;
}

/* ── Output/watermark choices carried by the link ────────────────────────── */

const OUT_CODES: Record<OutputFormat, string> = {
  detached: 'cert',
  embedded: 'pdf',
};

/** `cert-pdf` → ['detached','embedded']; unknown tokens are dropped. */
export function parseOutputsParam(value: string | null): OutputFormat[] | null {
  if (!value) return null;
  const out = value
    .split('-')
    .map((code) =>
      (Object.keys(OUT_CODES) as OutputFormat[]).find(
        (k) => OUT_CODES[k] === code,
      ),
    )
    .filter((v): v is OutputFormat => !!v);
  return out.length > 0 ? out : null;
}

export interface SharedWatermark {
  kind: WatermarkKind;
  text?: string;
}

export function parseWatermarkParams(
  wm: string | null,
  wmText: string | null,
): SharedWatermark | null {
  if (wm !== 'none' && wm !== 'seal' && wm !== 'own') return null;
  return { kind: wm, text: wmText ?? undefined };
}

/**
 * Builds the shareable co-signer URL for a request. `pathname` may be any page
 * under the sign tool (including an already-directory-shaped one); the tool
 * base is recovered from it so the link never nests. Without a `requestKey`
 * the link is a plain document-delivery URL: it opens the sign tool (on the
 * requested tab) and the P2P room in the fragment serves the file.
 */
export function buildShareUrl(input: {
  origin: string;
  pathname: string;
  /** On-ledger request key; omit for a document-delivery-only link. */
  requestKey?: string;
  docName?: string;
  /** Initiator's delivery formats, applied on the co-signer side too. */
  outputs?: OutputFormat[];
  /** Initiator's watermark choice (custom images cannot travel by URL). */
  watermark?: SharedWatermark;
  /** Tab the link should open on (request links force `sign` by themselves). */
  tab?: 'basic' | 'sign' | 'verify';
  /**
   * Radix network the signature belongs to. Carried so opening the link points
   * the app at the right ledger: without it a Stokenet signature opened on
   * Mainnet (only on-ledger request links could infer it from the resource).
   */
  networkId?: number;
  /**
   * P2P room for direct document delivery. Rides in the URL FRAGMENT so it
   * never reaches server logs or link-preview bots.
   */
  sendRoomId?: string;
}): string {
  const base = input.pathname.replace(
    /(\/console\/sign-document)(\/.*)?$/,
    '$1',
  );
  const params = new URLSearchParams();
  if (input.docName) params.set('doc', input.docName);
  if (input.outputs && input.outputs.length > 0) {
    params.set('out', input.outputs.map((o) => OUT_CODES[o]).join('-'));
  }
  if (input.watermark && input.watermark.kind !== 'none') {
    params.set('wm', input.watermark.kind);
    if (input.watermark.kind === 'own' && input.watermark.text) {
      params.set('wmt', input.watermark.text);
    }
  }
  if (input.tab) params.set('tab', input.tab);
  if (input.networkId != null) params.set('net', String(input.networkId));
  const query = params.toString() ? `?${params.toString()}` : '';
  const fragment = input.sendRoomId ? `#s=${input.sendRoomId}` : '';

  if (!input.requestKey) {
    return `${input.origin}${base}${query}${fragment}`;
  }
  const parsed = parseRequestKey(input.requestKey);
  if (!parsed) {
    // Unrecognized key shape: fall back to the query format, which is opaque.
    const legacy = new URLSearchParams(params);
    legacy.set('req', input.requestKey);
    return `${input.origin}${base}?${legacy.toString()}${fragment}`;
  }
  return `${input.origin}${base}/r/${parsed.collection}/${parsed.id}${query}${fragment}`;
}

/** Reads the P2P send-room id from a share URL fragment, or null. */
export function parseSendRoom(hash: string): string | null {
  const room = new URLSearchParams(hash.replace(/^#/, '')).get('s');
  return room && /^[0-9a-f]{32}$/.test(room) ? room : null;
}

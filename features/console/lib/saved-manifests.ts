/**
 * Local persistence and sharing of transaction manifests.
 */

export interface SavedManifest {
  id: string;
  name: string;
  manifest: string;
  savedAt: number;
}

const STORAGE_KEY_PREFIX = 'console_saved_manifests_';
const MAX_SAVED = 30;
/** Above this size the share URL becomes unreliable across browsers/servers */
export const SHARE_URL_LIMIT = 6000;

export function loadSavedManifests(network: string): SavedManifest[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${network}`);
    return raw ? (JSON.parse(raw) as SavedManifest[]) : [];
  } catch {
    return [];
  }
}

export function saveManifest(name: string, manifest: string, network: string): SavedManifest[] {
  const entry: SavedManifest = {
    id: crypto.randomUUID(),
    name: name.trim(),
    manifest,
    savedAt: Date.now(),
  };
  const next = [entry, ...loadSavedManifests(network)].slice(0, MAX_SAVED);
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${network}`, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function removeSavedManifest(id: string, network: string): SavedManifest[] {
  const next = loadSavedManifests(network).filter((entry) => entry.id !== id);
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${network}`, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

/* ─── Share by URL (base64url) ────────────────────────────────────────────── */

export function encodeManifestParam(manifest: string): string {
  const bytes = new TextEncoder().encode(manifest);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeManifestParam(param: string): string | null {
  try {
    const base64 = param.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/* ─── Export / import .rtm files ──────────────────────────────────────────── */

export function downloadManifestFile(manifest: string, name = 'manifest'): void {
  const blob = new Blob([manifest], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name.replace(/[^\w-]+/g, '_') || 'manifest'}.rtm`;
  anchor.click();
  URL.revokeObjectURL(url);
}

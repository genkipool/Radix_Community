'use client';

import { ShareLinkCard } from '@/features/p2p/components/ShareLinkCard';
import type { CipherDictionary } from '../types/dictionary';

/** Share URL + QR code card, used by both the send and the unlock flows. */
export function SharePanel({
  t,
  url,
  hint,
}: {
  t: CipherDictionary;
  url: string;
  hint: string;
}) {
  return (
    <ShareLinkCard
      title={t.share.title}
      hint={hint}
      url={url}
      qrAlt={t.share.qrAlt}
    />
  );
}

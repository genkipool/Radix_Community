import type { LockerClaim } from '@/features/console/lib/locker-lookup';
import { formatNumber } from '@/utils/formatters';

/** What is waiting in a locker, in one line: "4 XRD · 250 TPA · 2 NFT". */
export const waitingLine = (waiting: LockerClaim[], names: Record<string, string>, locale: string) =>
    waiting
        .map((claim) =>
            claim.nftIds
                ? `${claim.nftIds.length} NFT ${names[claim.resource] ?? ''}`.trim()
                : `${formatNumber(Number(claim.amount ?? 0), 6, locale)} ${names[claim.resource] ?? '?'}`,
        )
        .join(' · ');

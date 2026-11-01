import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Whether a host this server is about to fetch from is on the public
 * internet. A URL taken from outside (an on-ledger logo, say) must never make
 * this server reach its own network: loopback, private ranges, link-local
 * (cloud metadata), carrier-grade NAT, multicast and the like.
 *
 * Names are resolved and every address they resolve to is checked, so a
 * public-looking name pointing at 10.0.0.1 is refused as well.
 */
export async function isPublicHost(hostname: string): Promise<boolean> {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
        return false;
    }
    if (isIP(host)) return isPublicAddress(host);
    try {
        const addresses = await lookup(host, { all: true, verbatim: true });
        return addresses.length > 0 && addresses.every(({ address }) => isPublicAddress(address));
    } catch {
        return false;
    }
}

/** Whether an IPv4 or IPv6 literal is a public unicast address. */
export function isPublicAddress(address: string): boolean {
    const version = isIP(address);
    if (version === 4) return isPublicV4(address);
    if (version === 6) return isPublicV6(address.toLowerCase());
    return false;
}

/** [first octets, prefix length] of the IPv4 ranges that are not public. */
const PRIVATE_V4: ReadonlyArray<[number[], number]> = [
    [[0], 8], // "this" network
    [[10], 8],
    [[100, 64], 10], // carrier-grade NAT
    [[127], 8],
    [[169, 254], 16], // link-local, cloud metadata
    [[172, 16], 12],
    [[192, 0, 0], 24],
    [[192, 0, 2], 24], // documentation
    [[192, 168], 16],
    [[198, 18], 15], // benchmarking
    [[198, 51, 100], 24],
    [[203, 0, 113], 24],
    [[224], 4], // multicast
    [[240], 4], // reserved and broadcast
];

function isPublicV4(address: string): boolean {
    const value = address.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
    return !PRIVATE_V4.some(([octets, prefix]) => {
        const base = octets.concat([0, 0, 0, 0]).slice(0, 4).reduce((acc, o) => (acc << 8) + o, 0) >>> 0;
        const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
        return ((value & mask) >>> 0) === ((base & mask) >>> 0);
    });
}

function isPublicV6(address: string): boolean {
    // IPv4 written as IPv6 (::ffff:10.0.0.1, ::10.0.0.1) is judged as IPv4.
    const embedded = address.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (embedded) return isPublicV4(embedded[1]);
    const mapped = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mapped) {
        const hi = parseInt(mapped[1], 16);
        const lo = parseInt(mapped[2], 16);
        return isPublicV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    if (address === '::' || address === '::1') return false;
    const first = parseInt(address.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
    if ((first & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
    if ((first & 0xff00) === 0xff00) return false; // multicast ff00::/8
    if (address.startsWith('64:ff9b:')) return false; // NAT64, reaches IPv4 behind it
    if (address.startsWith('2001:db8:')) return false; // documentation
    return true;
}

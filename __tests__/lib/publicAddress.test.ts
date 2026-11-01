import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('node:dns/promises', () => {
    const lookup = vi.fn(async (host: string) => {
        const answers: Record<string, string[]> = {
            'logo.example.com': ['93.184.216.34'],
            'sneaky.example.com': ['93.184.216.34', '10.0.0.7'],
            'metadata.example.com': ['169.254.169.254'],
        };
        if (!answers[host]) throw new Error('ENOTFOUND');
        return answers[host].map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
    });
    return { lookup, default: { lookup } };
});

const { isPublicAddress, isPublicHost } = await import('@/lib/publicAddress');

describe('isPublicAddress', () => {
    it.each([
        '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
        '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
        '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1',
        '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '64:ff9b::a00:1',
    ])('refuses %s', (address) => {
        expect(isPublicAddress(address)).toBe(false);
    });

    it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
        'accepts %s',
        (address) => {
            expect(isPublicAddress(address)).toBe(true);
        },
    );
});

describe('isPublicHost', () => {
    it('accepts a name that resolves only to public addresses', async () => {
        expect(await isPublicHost('logo.example.com')).toBe(true);
    });

    it('refuses a name with any private address among its answers', async () => {
        expect(await isPublicHost('sneaky.example.com')).toBe(false);
        expect(await isPublicHost('metadata.example.com')).toBe(false);
    });

    it('refuses names that do not resolve, and local names', async () => {
        expect(await isPublicHost('nowhere.example.com')).toBe(false);
        expect(await isPublicHost('localhost')).toBe(false);
        expect(await isPublicHost('db.internal')).toBe(false);
    });

    it('judges bracketed IPv6 literals as addresses', async () => {
        expect(await isPublicHost('[::1]')).toBe(false);
        expect(await isPublicHost('[2606:4700:4700::1111]')).toBe(true);
    });
});

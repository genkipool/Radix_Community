import { describe, it, expect } from 'vitest';
import {
    validateNetwork,
    validateAddress,
    validateTxHash,
    validateCursor,
    validateLimit,
} from '@/utils/apiValidation';

// ─── validateNetwork ─────────────────────────────────────────────────────────
describe('validateNetwork', () => {
    it('accepts mainnet', () => {
        expect(validateNetwork('mainnet')).toBe('mainnet');
    });

    it('accepts stokenet', () => {
        expect(validateNetwork('stokenet')).toBe('stokenet');
    });

    it('falls back to mainnet for unknown values', () => {
        expect(validateNetwork('testnet')).toBe('mainnet');
        expect(validateNetwork(null)).toBe('mainnet');
        expect(validateNetwork('')).toBe('mainnet');
    });
});

// ─── validateAddress ─────────────────────────────────────────────────────────
describe('validateAddress', () => {
    it('accepts valid account address', () => {
        expect(validateAddress('account_rdx12y4l35lh2543nfa9pyyzvsh64ssu0dv6fq20gg8suslwmjvkylejgj'))
            .toBe('account_rdx12y4l35lh2543nfa9pyyzvsh64ssu0dv6fq20gg8suslwmjvkylejgj');
    });

    it('accepts valid validator address', () => {
        const addr = 'validator_rdx1sd5368vqdmjk0y2w7ymdts02cz9c52858gpyny56xdvzuheepdeyy0';
        expect(validateAddress(addr)).toBe(addr);
    });

    it('accepts valid resource address', () => {
        const addr = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
        expect(validateAddress(addr)).toBe(addr);
    });

    it('rejects null and undefined', () => {
        expect(validateAddress(null)).toBeNull();
        expect(validateAddress(undefined)).toBeNull();
        expect(validateAddress('')).toBeNull();
    });

    it('rejects addresses that are too long', () => {
        expect(validateAddress('account_' + 'a'.repeat(300))).toBeNull();
    });

    it('rejects addresses with invalid characters', () => {
        expect(validateAddress('account_rdx<script>')).toBeNull();
        expect(validateAddress('account_rdx"injection')).toBeNull();
        expect(validateAddress('account_rdx;DROP TABLE')).toBeNull();
    });

    it('rejects unknown prefixes', () => {
        expect(validateAddress('unknown_rdx12345')).toBeNull();
        expect(validateAddress('javascript:alert(1)')).toBeNull();
    });
});

// ─── validateTxHash ──────────────────────────────────────────────────────────
describe('validateTxHash', () => {
    it('accepts valid txid_ hash', () => {
        const hash = 'txid_rdx1frcm6zzyfd08z0deu9x24sh64eccxeux4j2dv3dsqeuh9qsz4y6szznk3k';
        expect(validateTxHash(hash)).toBe(hash);
    });

    it('rejects null and empty', () => {
        expect(validateTxHash(null)).toBeNull();
        expect(validateTxHash('')).toBeNull();
    });

    it('rejects unknown prefixes', () => {
        expect(validateTxHash('account_rdx12345')).toBeNull();
    });

    it('rejects injection attempts', () => {
        expect(validateTxHash('txid_<script>alert(1)</script>')).toBeNull();
    });
});

// ─── validateCursor ──────────────────────────────────────────────────────────
describe('validateCursor', () => {
    it('accepts valid base64url cursors', () => {
        expect(validateCursor('eyJlcG9jaCId')).toBe('eyJlcG9jaCId');
        expect(validateCursor('abc123-_==')).toBe('abc123-_==');
    });

    it('returns undefined for null/empty', () => {
        expect(validateCursor(null)).toBeUndefined();
        expect(validateCursor('')).toBeUndefined();
    });

    it('rejects overly long cursors', () => {
        expect(validateCursor('a'.repeat(600))).toBeUndefined();
    });

    it('rejects cursors with path separators', () => {
        expect(validateCursor('cursor/../etc/passwd')).toBeUndefined();
    });
});

// ─── validateLimit ───────────────────────────────────────────────────────────
describe('validateLimit', () => {
    it('returns the value within bounds', () => {
        expect(validateLimit('15')).toBe(15);
        expect(validateLimit('100')).toBe(100);
        expect(validateLimit('1')).toBe(1);
    });

    it('clamps to min/max', () => {
        expect(validateLimit('0')).toBe(1);
        expect(validateLimit('200')).toBe(100);
        expect(validateLimit('-5')).toBe(1);
    });

    it('returns default for non-numeric', () => {
        expect(validateLimit(null)).toBe(15);
        expect(validateLimit('abc')).toBe(15);
    });

    it('accepts custom min/max/default', () => {
        expect(validateLimit('50', 10, 50, 20)).toBe(50);
        expect(validateLimit('5', 10, 50, 20)).toBe(10);
        expect(validateLimit(null, 10, 50, 20)).toBe(20);
    });
});

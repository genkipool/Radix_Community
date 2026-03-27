import { describe, it, expect } from 'vitest';
import { getStatusColor, getUptimeColor, roundTo } from '@/utils/validators';

// ─── getStatusColor ───────────────────────────────────────────────────────────
describe('getStatusColor', () => {
    it('returns green for active status', () => {
        expect(getStatusColor('active')).toBe('#16a34a');
    });

    it('returns amber for inactive status', () => {
        expect(getStatusColor('inactive')).toBe('#d97706');
    });

    it('returns red for jailed status', () => {
        expect(getStatusColor('jailed')).toBe('#dc2626');
    });
});

// ─── getUptimeColor ───────────────────────────────────────────────────────────
describe('getUptimeColor', () => {
    it('returns green for 99%+ uptime', () => {
        expect(getUptimeColor(99)).toBe('#16a34a');
        expect(getUptimeColor(100)).toBe('#16a34a');
        expect(getUptimeColor(99.5)).toBe('#16a34a');
    });

    it('returns amber for 98-99% uptime', () => {
        expect(getUptimeColor(98)).toBe('#d97706');
        expect(getUptimeColor(98.9)).toBe('#d97706');
    });

    it('returns red for below 98% uptime', () => {
        expect(getUptimeColor(97.9)).toBe('#dc2626');
        expect(getUptimeColor(0)).toBe('#dc2626');
        expect(getUptimeColor(50)).toBe('#dc2626');
    });
});

// ─── roundTo ─────────────────────────────────────────────────────────────────
describe('roundTo', () => {
    it('rounds to specified decimal places', () => {
        expect(roundTo(1.23456, 2)).toBe(1.23);
        expect(roundTo(1.23456, 4)).toBe(1.2346);
        expect(roundTo(1.23456, 0)).toBe(1);
    });

    it('handles exact values without floating-point drift', () => {
        expect(roundTo(1.005, 2)).toBeCloseTo(1.01, 10);
        expect(roundTo(0, 4)).toBe(0);
    });

    it('rounds large numbers correctly', () => {
        expect(roundTo(1234567.89, 2)).toBe(1234567.89);
        expect(roundTo(1234567.891, 2)).toBe(1234567.89);
    });

    it('rounds negative numbers correctly', () => {
        expect(roundTo(-1.235, 2)).toBe(-1.23);
        expect(roundTo(-1.234, 2)).toBe(-1.23);
    });
});

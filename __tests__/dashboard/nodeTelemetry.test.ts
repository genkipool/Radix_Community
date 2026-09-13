import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/redis', () => ({ getRedis: () => null }));
vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import {
    parseNodeTelemetry,
    buildNodeTelemetryMap,
    consensusSignal,
    withNodeHealth,
    TELEMETRY_MAX_AGE_MS,
} from '@/services/nodeTelemetry';
import type { Validator } from '@/types/radix';

const NOW = 1_800_000_000_000;
const KEY = '02ABCDEF';

const entry = (overrides: Record<string, unknown> = {}) => ({
    countryCode: 'es',
    online: true,
    acceptsConnections: true,
    version: 'v1.3.0.2-6a5a9c9',
    commit: '7400951e',
    lastSeen: NOW,
    ...overrides,
});

const epoch = (n: number, completedProposals: number, missedProposals: number, isLive = false) =>
    ({ epoch: n, completedProposals, missedProposals, isLive });

const validator = (overrides: Partial<Validator> = {}) => ({
    publicKey: '02abcdef',
    status: 'inactive',
    epochPerformance: [],
    recentUptime: 99,
    onlineStatus: null,
    acceptsConnect: null,
    country: 'Somewhere',
    countryCode: '',
    version: 'v1.0.0',
    commit: '',
    ...overrides,
}) as Validator;

const telemetry = (overrides: Record<string, unknown> = {}) =>
    buildNodeTelemetryMap({ [KEY]: entry(overrides) }, NOW, NOW);

describe('parseNodeTelemetry', () => {
    it('accepts the JSON string the script writes and normalises it', () => {
        expect(parseNodeTelemetry(JSON.stringify(entry()))).toEqual({
            countryCode: 'ES',
            online: true,
            acceptsConnections: true,
            version: 'v1.3.0.2-6a5a9c9',
            commit: '7400951e',
            lastSeen: NOW,
        });
    });

    it('drops entries with a malformed lastSeen', () => {
        expect(parseNodeTelemetry(entry({ lastSeen: 'yesterday' }))).toBeNull();
        expect(parseNodeTelemetry(entry({ lastSeen: -1 }))).toBeNull();
        expect(parseNodeTelemetry('not json')).toBeNull();
        expect(parseNodeTelemetry(null)).toBeNull();
    });

    it('keeps nodes only known by address: never connected, reachability unknown', () => {
        expect(parseNodeTelemetry(entry({ lastSeen: 0, online: false, acceptsConnections: null }))).toMatchObject({
            lastSeen: 0, online: false, acceptsConnections: null,
        });
    });

    it('never trusts anything but a real boolean, a real code or plain text', () => {
        const parsed = parseNodeTelemetry(entry({
            online: 'yes', acceptsConnections: 1, countryCode: 'Spain', version: '<b>v1</b>',
        }));
        expect(parsed).toMatchObject({ online: false, acceptsConnections: null, countryCode: null, version: 'v1' });
    });
});

describe('buildNodeTelemetryMap', () => {
    it('keys by lower-case public key', () => {
        expect(telemetry().get('02abcdef')?.countryCode).toBe('ES');
    });

    it('ignores the whole view once the script has stopped writing', () => {
        expect(buildNodeTelemetryMap({ [KEY]: entry() }, NOW - TELEMETRY_MAX_AGE_MS - 1, NOW).size).toBe(0);
        expect(buildNodeTelemetryMap({ [KEY]: entry() }, undefined, NOW).size).toBe(0);
    });
});

describe('consensusSignal', () => {
    it('reads a validator making proposals as producing', () => {
        expect(consensusSignal({ status: 'active', recentUptime: 99, epochPerformance: [epoch(10, 0, 0, true), epoch(9, 3, 0), epoch(8, 2, 1)] })).toBe(true);
    });

    it('reads one missing every proposal as not validating', () => {
        // WEFT on 2026-09-13: 0 made, 15/16/14 missed.
        expect(consensusSignal({ status: 'active', recentUptime: 99, epochPerformance: [epoch(10, 0, 15), epoch(9, 0, 16), epoch(8, 0, 14)] })).toBe(false);
    });

    it('only weighs the latest finished epochs', () => {
        expect(consensusSignal({ status: 'active', recentUptime: 99, epochPerformance: [epoch(8, 4, 0), epoch(10, 0, 5), epoch(9, 0, 5)] })).toBe(false);
    });

    it('trusts a proposal in the live epoch over earlier misses', () => {
        expect(consensusSignal({ status: 'active', recentUptime: 99, epochPerformance: [epoch(11, 1, 0, true), epoch(10, 0, 5), epoch(9, 0, 5)] })).toBe(true);
    });

    it('does not call a sound validator down over one unlucky miss', () => {
        expect(consensusSignal({ status: 'active', recentUptime: 99, epochPerformance: [epoch(10, 0, 1), epoch(9, 0, 0)] })).toBeNull();
        expect(consensusSignal({ status: 'active', recentUptime: 0, epochPerformance: [epoch(10, 0, 1), epoch(9, 0, 0)] })).toBe(false);
    });

    it('says nothing outside the active set or without proposals to make', () => {
        expect(consensusSignal({ status: 'inactive', recentUptime: 99, epochPerformance: [epoch(10, 0, 5)] })).toBeNull();
        expect(consensusSignal({ status: 'active', recentUptime: 99, epochPerformance: [epoch(10, 0, 0), epoch(9, 0, 0)] })).toBeNull();
        expect(consensusSignal({ status: 'active', recentUptime: 99, epochPerformance: [] })).toBeNull();
    });
});

describe('withNodeHealth', () => {
    it('lays what our node observed over the Gateway data', () => {
        expect(withNodeHealth(validator(), telemetry())).toMatchObject({
            onlineStatus: true,
            onlineReason: 'connected',
            acceptsConnect: true,
            country: 'Spain',
            countryCode: 'ES',
            version: 'v1.3.0.2-6a5a9c9',
            commit: '7400951e',
        });
    });

    it('lets consensus overrule a node that looks fine but does not validate', () => {
        const weft = validator({ status: 'active', epochPerformance: [epoch(10, 0, 15), epoch(9, 0, 16)] });
        expect(withNodeHealth(weft, telemetry())).toMatchObject({ onlineStatus: false, onlineReason: 'missing_proposals' });
        expect(withNodeHealth(weft, new Map())).toMatchObject({ onlineStatus: false, onlineReason: 'missing_proposals' });
    });

    it('falls back to the port probe for nodes only known by address', () => {
        expect(withNodeHealth(validator(), telemetry({ online: false, lastSeen: 0, acceptsConnections: true })))
            .toMatchObject({ onlineStatus: true, onlineReason: 'reachable' });
        expect(withNodeHealth(validator(), telemetry({ online: false, lastSeen: 0, acceptsConnections: false })))
            .toMatchObject({ onlineStatus: false, onlineReason: 'unreachable', acceptsConnect: false });
    });

    it('answers unknown instead of guessing when there is no evidence', () => {
        expect(withNodeHealth(validator(), new Map())).toMatchObject({
            onlineStatus: null, onlineReason: 'no_data', acceptsConnect: null, country: 'Somewhere', version: 'v1.0.0', node: null,
        });
    });

    it('keeps the published version when the node reports none', () => {
        expect(withNodeHealth(validator(), telemetry({ version: null, commit: null })).version).toBe('v1.0.0');
    });
});

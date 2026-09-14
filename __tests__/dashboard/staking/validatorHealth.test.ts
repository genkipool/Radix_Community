import { describe, it, expect } from 'vitest';
import {
    onlineDisplay, connectDisplay, toneStyle, TONES,
} from '@/features/dashboard/staking/lib/validatorHealth';
import type { Validator } from '@/types/radix';

const details = {
    online: 'En línea',
    offline: 'Fuera de línea',
    accepts_connect: 'Acepta Conexión',
    no_accepts_connect: 'No Acepta Conexión',
    health_producing: 'produce',
    health_missing_proposals: 'no valida',
    health_connected: 'conectado',
    health_reachable: 'responde',
    health_unreachable: 'no responde',
    health_no_data: 'sin datos de nodo',
    health_online_unknown: 'Sin datos',
    health_connect_yes: 'acepta',
    health_connect_no: 'no acepta',
    health_connect_unknown: 'Sin comprobar',
    health_connect_none: 'sin dirección',
    health_version_unobserved: 'no visto',
} as never;

const validator = (overrides: Partial<Validator>) => overrides as Validator;

describe('onlineDisplay', () => {
    it('explains a validator that is not validating in the danger colour', () => {
        expect(onlineDisplay(validator({ onlineStatus: false, onlineReason: 'missing_proposals' }), details))
            .toEqual({ label: 'Fuera de línea', title: 'no valida', color: TONES.danger });
    });

    it('shows no evidence as its own neutral state, not as online', () => {
        expect(onlineDisplay(validator({ onlineStatus: null, onlineReason: 'no_data' }), details))
            .toEqual({ label: 'Sin datos', title: 'sin datos de nodo', color: TONES.neutral });
    });

    it('reads a closed port as a warning, not as a failure to validate', () => {
        expect(onlineDisplay(validator({ onlineStatus: false, onlineReason: 'unreachable' }), details).color).toBe(TONES.warning);
    });
});

describe('connectDisplay', () => {
    it('has three states', () => {
        expect(connectDisplay(validator({ acceptsConnect: true }), details).label).toBe('Acepta Conexión');
        expect(connectDisplay(validator({ acceptsConnect: false }), details).label).toBe('No Acepta Conexión');
        expect(connectDisplay(validator({ acceptsConnect: null }), details)).toMatchObject({ label: 'Sin comprobar', color: TONES.neutral });
    });
});

describe('toneStyle', () => {
    it('builds valid CSS from theme variables, not an alpha suffix on var()', () => {
        expect(toneStyle('var(--color-primary)').borderColor).toBe('color-mix(in srgb, var(--color-primary) 27%, transparent)');
    });
});

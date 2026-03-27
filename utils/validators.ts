/* ═══════ VALIDATOR HELPER FUNCTIONS ═══════ */
import type { Validator } from '@/types/radix';

export function getStatusColor(status: Validator['status']): string {
    switch (status) {
        case 'active': return '#16a34a'; // Green 600 for better contrast
        case 'inactive': return '#d97706'; // Amber 600
        case 'jailed': return '#dc2626'; // Red 600
    }
}

export function getUptimeColor(uptime: number): string {
    if (uptime >= 99) return '#16a34a'; // Green 600
    if (uptime >= 98) return '#d97706'; // Amber 600
    return '#dc2626'; // Red 600
}

export function roundTo(val: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round((val + Number.EPSILON) * factor) / factor;
}

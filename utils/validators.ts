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

export function getUptimeTooltipText(uptime: number, isRecent: boolean, dt: Record<string, string> | undefined): string {
    if (!dt) return '';
    
    let status = dt.uptime_status_excellent;
    let msg = dt.uptime_msg_excellent;
    
    if (uptime < 98) {
        status = dt.uptime_status_critical;
        msg = dt.uptime_msg_critical;
    } else if (uptime < 99) {
        status = dt.uptime_status_warning;
        msg = dt.uptime_msg_warning;
    }
    
    const period = isRecent ? dt.period_14d : dt.period_total;
    
    return `${status} (${period}). ${msg}`;
}


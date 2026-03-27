export function formatNumber(n: number, decimals: number = 8): string {
    return Number(n.toFixed(decimals)).toLocaleString(undefined, {
        maximumFractionDigits: decimals
    });
}

export function formatXRD(n: number): string {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    // Limit decimals to ensure total digits don't get crazy, but keep 8 max as per user request
    return formatNumber(n, 8);
}

export function formatShortXRD(n: number): string {
    if (n === 0) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return Number(n.toFixed(2)).toLocaleString();
}

export function truncateAddress(address: string, start: number = 12, end: number = 6): string {
    if (!address) return '';
    if (address.length <= (start + end + 2)) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
}

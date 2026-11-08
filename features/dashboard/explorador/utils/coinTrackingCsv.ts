/*
 * The CoinTracking CSV format the explorer's reward exports use (Babylon and
 * Olympia alike). Pure: rows in, text out.
 */

export const CT_HEADER = [
    'Type', 'Buy Amount', 'Buy Currency', 'Sell Amount', 'Sell Currency',
    'Fee Amount', 'Fee Currency', 'Exchange', 'Trade-Group', 'Comment', 'Date', 'Tx-ID',
];

export function csvRow(
    ctType: string, buyAmt: number, buyCur: string, sellAmt: number, sellCur: string,
    feeAmt: number, feeCur: string, group: string, comment: string, dateTime: string, txId = '',
): string[] {
    return [
        ctType,
        buyAmt > 0 ? buyAmt.toFixed(8) : '',
        buyAmt > 0 ? buyCur : '',
        sellAmt > 0 ? sellAmt.toFixed(8) : '',
        sellAmt > 0 ? sellCur : '',
        feeAmt > 0 ? feeAmt.toFixed(8) : '',
        feeAmt > 0 ? feeCur : '',
        'Radix Network',
        group,
        comment,
        dateTime,
        txId,
    ];
}

export function rowsToCsv(rows: string[][], header: string[] = CT_HEADER): string {
    const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [header.map(quote).join(','), ...rows.map((row) => row.map(quote).join(','))].join('\n');
}

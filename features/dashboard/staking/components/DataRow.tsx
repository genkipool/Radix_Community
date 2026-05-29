'use client';
import React from 'react';
import type { DataRowProps } from '../types/components.types';

export const DataRow = ({
    label, value, sub, hi, vertical, tooltip,
}: DataRowProps) => (
    <div className={`veb-dr ${vertical ? 'veb-dr-v' : ''}`} title={tooltip}>
        <span className="veb-dr-label">{label}</span>
        <div className="veb-dr-right">
            <span className="veb-dr-val" style={hi ? { color: hi } : undefined}>{value}</span>
            {sub && <span className="veb-dr-sub">{sub}</span>}
        </div>
    </div>
);

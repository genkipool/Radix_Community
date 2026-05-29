'use client';

import { ExternalLink } from 'lucide-react';
import { ExplorerTarget } from '../../types/data.types';

interface ExplorerButtonProps {
    target: ExplorerTarget;
    label: string;
    size?: 'xs' | 'sm';
    onClick?: (t: ExplorerTarget) => void;
}

export function ExplorerButton({ target, label, size = 'sm', onClick }: ExplorerButtonProps) {
    const px = size === 'xs' ? 'px-2 py-1' : 'px-3 py-1.5';
    const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs';

    return (
        <button
            type="button"
            onClick={() => onClick?.(target)}
            className={`inline-flex items-center gap-1.5 ${px} rounded-lg font-semibold ${textSize} transition-all duration-200 shrink-0`}
            style={{
                background: 'rgba(99,102,241,0.08)',
                color: 'var(--color-primary)',
                border: '1px solid rgba(99,102,241,0.2)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.16)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.08)'; }}
        >
            <ExternalLink className="size-3" />
            {label}
        </button>
    );
}

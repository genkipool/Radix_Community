'use client';

import { useEffect, useId, useState } from 'react';

interface MermaidDiagramProps {
    chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
    const rawId = useId().replace(/:/g, '');
    const [svg, setSvg] = useState('');

    useEffect(() => {
        let cancelled = false;
        async function render() {
            try {
                const m = (await import('mermaid')).default;
                m.initialize({
                    startOnLoad: false,
                    theme: 'base',
                    themeVariables: {
                        darkMode: true,
                        background: 'transparent',
                        primaryColor: 'transparent',
                        primaryBorderColor: '#94a3b8',
                        lineColor: '#94a3b8',
                        textColor: 'transparent',
                        fontFamily: 'inherit',
                    },
                    flowchart: { curve: 'basis', nodeSpacing: 50, rankSpacing: 100 },
                });
                const { svg: s } = await m.render(`mc${rawId}${Date.now()}`, chart);
                if (!cancelled) setSvg(s);
            } catch (err) {
                console.error("Mermaid render error:", err);
                if (!cancelled) setSvg('<div class="text-red-500 text-[10px]">Error rendering diagram</div>');
            }
        }
        render();
        return () => { cancelled = true; };
    }, [chart, rawId]);

    if (!svg) {
        return (
            <div className="flex justify-center py-6">
                <span className="text-[10px] text-[var(--color-text-muted)] animate-pulse">Loading diagram…</span>
            </div>
        );
    }

    return (
        <div
            className="flex justify-center overflow-x-auto 
                [&_svg]:max-w-full 
                [&_.nodeLabel]:!text-[var(--color-text-main)] 
                [&_.edgeLabel]:!text-[var(--color-text-main)] 
                [&_.edgeLabel_span]:!text-[var(--color-text-main)]
                [&_.edgeLabel_rect]:!fill-[var(--color-bg)]
                [&_.edgeLabel_rect]:!opacity-90
                [&_.cluster-label]:!text-[var(--color-text-main)] 
                [&_text]:!fill-[var(--color-text-main)] 
                [&_.edgeLabel]:!bg-[var(--color-bg)]
                [&_.node.user_rect]:!stroke-[var(--color-primary)] 
                [&_.node.fee_rect]:!stroke-[#F43F5E] 
                [&_.node.vault_rect]:!stroke-[var(--color-secondary)] 
                [&_.node.asset_rect]:!stroke-[var(--color-accent)]
                [&_path.flowchart-link]:!stroke-[var(--color-text-muted)]
                [&_path.flowchart-link]:!opacity-40"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

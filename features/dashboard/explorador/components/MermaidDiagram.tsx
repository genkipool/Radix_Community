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
                        fontSize: '20px',
                    },
                    flowchart: { curve: 'basis', nodeSpacing: 80, rankSpacing: 140, padding: 40 },
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
            className="flex justify-start overflow-x-auto w-full px-2 py-10
                [&_svg]:max-w-none
                [&_svg]:!-ml-4
                [&_svg]:!w-auto
                [&_svg]:!h-auto
                [&_svg]:!overflow-visible
                [&_svg_text]:!overflow-visible
                [&_svg_foreignObject]:!overflow-visible
                [&_.nodeLabel]:!text-[var(--color-text-main)] 
                [&_.edgeLabel]:!text-[var(--color-text-main)] 
                [&_.edgeLabel_span]:!text-[var(--color-text-main)]
                [&_.edgeLabel_rect]:!fill-[var(--color-bg)]
                [&_.edgeLabel_rect]:!opacity-90
                [&_.cluster-label]:!text-[20px]
                [&_.cluster-label]:!font-bold
                [&_.cluster-label]:!fill-[var(--color-text-main)] 
                [&_text]:!fill-[var(--color-text-main)] 
                [&_.edgeLabel]:!bg-[var(--color-bg)]
                [&_.node.user_rect]:!stroke-[var(--color-primary)] 
                [&_.node.fee_rect]:!stroke-[#F43F5E] 
                [&_.node.vault_rect]:!stroke-[var(--color-secondary)] 
                [&_.node.asset_rect]:!stroke-[var(--color-accent)]
                [&_.node.spacer_rect]:!fill-none
                [&_.node.spacer_rect]:!stroke-none
                [&_.node.spacer_rect]:!opacity-0
                [&_.node.spacer_rect]:!pointer-events-none
                [&_.node.spacer_.nodeLabel]:!opacity-0
                [&_path.flowchart-link]:!stroke-[var(--color-text-muted)]
                [&_path.flowchart-link]:!opacity-40"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

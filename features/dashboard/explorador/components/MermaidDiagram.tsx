'use client';

import { useEffect, useId, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

interface MermaidDiagramProps {
    chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
    const rawId = useId().replace(/:/g, '');
    const [svg, setSvg] = useState('');
    const { theme } = useTheme();

    useEffect(() => {
        let cancelled = false;
        async function render() {
            try {
                const computed = getComputedStyle(document.documentElement);
                const labelBg = computed.getPropertyValue('--color-surface').trim() || '#ffffff';
                const labelText = computed.getPropertyValue('--color-text-main').trim() || '#171717';

                // Determinamos si es oscuro basándonos en el brillo del fondo o la clase
                const isDark = labelBg !== '#ffffff' && labelBg !== 'white';

                const m = (await import('mermaid')).default;
                m.initialize({
                    startOnLoad: false,
                    theme: 'base',
                    themeVariables: {
                        darkMode: isDark,
                        background: 'transparent',
                        primaryColor: 'transparent',
                        primaryBorderColor: '#94a3b8',
                        lineColor: '#94a3b8',
                        textColor: labelText,
                        fontFamily: 'inherit',
                        edgeLabelBackground: labelBg,
                    },
                    flowchart: { curve: 'basis', nodeSpacing: 80, rankSpacing: 140, padding: 40 },
                });
                const { svg: s } = await m.render(`mc${rawId}${Date.now()}`, chart);

                // Extraemos el tamaño de fuente del bloque de inicialización del chart
                const sizeMatch = chart.match(/'clusterFontSize':\s*'(\d+)px'/);
                const clusterSize = sizeMatch ? `${sizeMatch[1]}px` : '20px';

                // Inyectamos el estilo al FINAL del bloque <style> para máxima prioridad, 
                // siendo muy específicos para NO afectar a los subgrafos (clusters)
                const scaledSvg = s.replace(
                    '</style>',
                    `
                    .cluster-label, .cluster-label span { font-size: ${clusterSize} !important; font-weight: bold !important; }
                    
                    /* Hacemos transparente el rectángulo SVG de fondo para evitar el efecto de "doble capa" */
                    .edgeLabel rect, .labelBkg { fill: none !important; stroke: none !important; }
                    
                    /* Aplicamos el fondo sólido de la TARJETA y el color de texto a la etiqueta HTML y sus hijos */
                    .edgeLabel, .edgeLabel span, .edgeLabel div, .edgeLabel text { 
                        background-color: var(--color-surface) !important; 
                        color: var(--color-text-main) !important; 
                        fill: var(--color-text-main) !important;
                        opacity: 1 !important;
                        padding: 1px 4px !important;
                        border-radius: 4px !important;
                    }
                    
                    .cluster rect { fill: transparent !important; }
                    </style>`
                );

                if (!cancelled) setSvg(scaledSvg);
            } catch (err) {
                console.error("Mermaid render error:", err);
                if (!cancelled) setSvg('<div class="text-red-500 text-[10px]">Error rendering diagram</div>');
            }
        }
        render();
        return () => { cancelled = true; };
    }, [chart, rawId, theme]);

    if (!svg) {
        return (
            <div className="flex justify-center py-6">
                <span className="text-[10px] text-[var(--color-text-muted)] animate-pulse">Loading diagram…</span>
            </div>
        );
    }

    return (
        <div
            data-testid="mermaid-container"
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
                [&_.edgeLabel_rect]:!opacity-100
                [&_.labelBkg]:!fill-[var(--color-bg)]
                [&_.labelBkg]:!opacity-100
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

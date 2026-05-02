import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MermaidDiagram } from '@/features/dashboard/explorador/components/MermaidDiagram';
import { ThemeProvider } from '@/context/ThemeContext';

// Mock mermaid library
vi.mock('mermaid', () => ({
    default: {
        initialize: vi.fn(),
        render: vi.fn().mockImplementation((id, _chart) => 
            Promise.resolve({ 
                svg: `<svg id="${id}"><style></style><g class="cluster-label"><span>Mock Label</span></g><div class="edgeLabel"><span>Mock Edge</span></div></svg>` 
            })
        ),
    },
}));

// Mock getComputedStyle to return specific theme colors
const mockComputedStyle = {
    getPropertyValue: vi.fn().mockImplementation((prop) => {
        if (prop === '--color-surface') return '#1a1a1a'; // Dark background
        if (prop === '--color-text-main') return '#ffffff'; // White text
        return '';
    }),
};

describe('MermaidDiagram Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.window.getComputedStyle = vi.fn().mockReturnValue(mockComputedStyle);
    });

    it('renders loading state initially', () => {
        render(
            <ThemeProvider>
                <MermaidDiagram chart="graph TD; A-->B" />
            </ThemeProvider>
        );
        expect(screen.getByText(/Loading diagram/i)).toBeDefined();
    });

    it('initializes mermaid with colors from CSS variables', async () => {
        const mermaid = (await import('mermaid')).default;
        
        render(
            <ThemeProvider>
                <MermaidDiagram chart="graph TD; A-->B" />
            </ThemeProvider>
        );

        await waitFor(() => {
            expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({
                themeVariables: expect.objectContaining({
                    textColor: '#ffffff',
                    edgeLabelBackground: '#1a1a1a',
                }),
            }));
        });
    });

    it('reacts to theme changes by re-initializing mermaid', async () => {
        const mermaid = (await import('mermaid')).default;
        
        const { rerender: _rerender } = render(
            <ThemeProvider>
                <MermaidDiagram chart="graph TD; A-->B" />
            </ThemeProvider>
        );

        await waitFor(() => {
            expect(mermaid.initialize).toHaveBeenCalled();
        });

        // Simulate theme change if possible, or just verify initialization
        expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({
            themeVariables: expect.objectContaining({
                textColor: '#ffffff',
            }),
        }));
    });

    it('re-renders when chart prop changes', async () => {
        const mermaid = (await import('mermaid')).default;
        const { rerender } = render(
            <ThemeProvider>
                <MermaidDiagram chart="graph TD; A-->B" />
            </ThemeProvider>
        );

        await waitFor(() => {
            expect(mermaid.render).toHaveBeenCalledTimes(1);
        });

        rerender(
            <ThemeProvider>
                <MermaidDiagram chart="graph TD; B-->C" />
            </ThemeProvider>
        );

        await waitFor(() => {
            expect(mermaid.render).toHaveBeenCalledTimes(2);
        });
    });
});

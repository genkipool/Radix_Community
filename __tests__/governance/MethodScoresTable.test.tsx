import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import esDict from '@/features/governance/locales/es.json';
import { MethodScoresTable, type MethodScoreTableEntry } from '@/features/governance/components/MethodScoresTable';
import {
    ElectionConsensusKpiGrid,
    ElectionMethodCandidatesGrid,
} from '@/features/governance/components/ElectionConsensusKpiGrid';
import type { CompareDict } from '@/features/governance/components/ComparisonParts';
import type { G } from '@/features/governance/components/GovernanceBadges';
import {
    compareMethods,
    computeElectionConsensus,
    computeMethodScoreRows,
    type MethodKey,
} from '@/features/governance/lib/votingMethods';
import { itemChoices, type GovernanceItem } from '@/features/governance/lib/governanceVotes';

const esCompare = esDict.governance.compare as unknown as CompareDict;
const esG = esDict.governance as unknown as G;

const SAMPLE_ROWS: MethodScoreTableEntry[] = [
    {
        key: 'linear',
        family: 'wealth',
        current: true,
        label: '1 XRD = 1 voto',
        resistance: 'high',
        resistanceScore: 9.1,
        minDifficulty: 6.0,
        avgMaxShare: 0.57,
        decentralisationScore: 2.0,
        finalScore: 4.3,
        nakamoto: 3,
        top1: 0.42,
        effective: 4.2,
    },
    {
        key: 'one_address',
        family: 'address',
        label: '1 dirección = 1 voto',
        resistance: 'very_low',
        resistanceScore: 2.1,
        minDifficulty: 0.1,
        avgMaxShare: 0.85,
        decentralisationScore: 9.6,
        finalScore: 4.5,
        nakamoto: 15,
        top1: 0.04,
        effective: 28.0,
    },
    {
        key: 'capped_veterans',
        family: 'hybrid',
        label: 'Tope + veteranos',
        resistance: 'high',
        resistanceScore: 8.4,
        minDifficulty: 8.2,
        avgMaxShare: 0.21,
        decentralisationScore: 7.5,
        finalScore: 7.9,
        nakamoto: 10,
        top1: 0.12,
        effective: 19.5,
    },
    {
        key: 'consensus',
        family: 'consensus',
        isConsensus: true,
        label: 'Consenso ponderado (50 métodos)',
        resistance: 'high',
        resistanceScore: 7.6,
        minDifficulty: 6.1,
        avgMaxShare: 0.34,
        decentralisationScore: 6.5,
        finalScore: 7.0,
        nakamoto: 8,
        top1: 0.18,
        effective: 14.0,
    },
];

function renderedMethodOrder(): string[] {
    return screen
        .getAllByRole('row')
        .slice(1)
        .filter(row => row.querySelector('th'))
        .map(row => row.querySelector('th button, th span span')?.textContent ?? '');
}

describe('MethodScoresTable', () => {
    it('sorts by best Final score initially, cycles 3 clicks on headers, jumps on name click, opens guide on (i), renders expanded rows lazily, and bulk toggles all rows', () => {
        const onJumpToMethod = vi.fn();
        const onOpenGuide = vi.fn();
        const renderExpandedRow = vi.fn((row: MethodScoreTableEntry) => (
            <div data-testid={`candidates-${row.key}`}>Candidatos {row.label}</div>
        ));
        render(
            <MethodScoresTable
                rows={SAMPLE_ROWS}
                onJumpToMethod={onJumpToMethod}
                onOpenGuide={onOpenGuide}
                renderExpandedRow={renderExpandedRow}
                c={esCompare}
                language="es"
            />,
        );

        // Lazy rendering: collapsed rows never invoke renderExpandedRow.
        expect(renderExpandedRow).not.toHaveBeenCalled();

        // Default sort is best Final score descending.
        expect(renderedMethodOrder()).toEqual([
            'Tope + veteranos',
            'Consenso ponderado (50 métodos)',
            '1 dirección = 1 voto',
            '1 XRD = 1 voto',
        ]);

        // Only current method row has background tint; consensus row has none; no Actual pill badge.
        const rows = screen.getAllByRole('row').slice(1);
        expect(rows[3].className).toContain('bg-[var(--color-primary)]/8');
        expect(rows[1].className).not.toContain('bg-[var(--color-primary)]');
        expect(rows[3].textContent).not.toContain('Actual');

        // Header & cell tooltips explain weakest link, Nakamoto, scores, and values.
        const weakestHeader = screen.getByRole('button', { name: 'Eslabón débil' });
        const nakamotoHeader = screen.getByRole('button', { name: 'Nakamoto' });
        expect(weakestHeader.getAttribute('title')).toContain('Dificultad mínima');
        expect(nakamotoHeader.getAttribute('title')).toContain('Nakamoto');
        expect(rows[0].querySelector('td[title*="Eslabón más débil"]')).not.toBeNull();
        expect(rows[0].querySelector('td[title*="carteras"]')).not.toBeNull();

        // 3-click cycle on Resisencia: desc -> asc -> null.
        const resistanceBtn = screen.getByRole('button', { name: 'Resistencia' });
        fireEvent.click(resistanceBtn);
        expect(resistanceBtn.closest('th')?.getAttribute('aria-sort')).toBe('descending');
        expect(renderedMethodOrder()).toEqual([
            '1 XRD = 1 voto',
            'Tope + veteranos',
            'Consenso ponderado (50 métodos)',
            '1 dirección = 1 voto',
        ]);

        fireEvent.click(resistanceBtn);
        expect(resistanceBtn.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
        expect(renderedMethodOrder()).toEqual([
            '1 dirección = 1 voto',
            'Consenso ponderado (50 métodos)',
            'Tope + veteranos',
            '1 XRD = 1 voto',
        ]);

        fireEvent.click(resistanceBtn);
        expect(resistanceBtn.closest('th')?.getAttribute('aria-sort')).toBe('none');
        expect(renderedMethodOrder()).toEqual([
            '1 XRD = 1 voto',
            '1 dirección = 1 voto',
            'Tope + veteranos',
            'Consenso ponderado (50 métodos)',
        ]);

        // Clicking the method name jumps to the method without expanding or opening the side panel.
        const nameBtn = screen.getByRole('button', { name: 'Tope + veteranos' });
        fireEvent.click(nameBtn);
        expect(onJumpToMethod).toHaveBeenCalledWith('capped_veterans');
        expect(onOpenGuide).not.toHaveBeenCalled();
        expect(screen.queryByTestId('candidates-capped_veterans')).toBeNull();

        // Clicking (i) opens the side panel without expanding the row.
        const guideBtn = screen.getByRole('button', {
            name: 'Abrir panel lateral (guía, conclusiones y auditoría) de Tope + veteranos',
        });
        fireEvent.click(guideBtn);
        expect(onOpenGuide).toHaveBeenCalledWith('capped_veterans');
        expect(screen.queryByTestId('candidates-capped_veterans')).toBeNull();

        // Clicking the table row (outside the name/(i) buttons) expands and collapses candidate boxes.
        fireEvent.click(nameBtn.closest('tr')!.querySelector('td')!);
        expect(screen.getByTestId('candidates-capped_veterans')).toBeInTheDocument();
        fireEvent.click(nameBtn.closest('tr')!.querySelector('td')!);
        expect(screen.queryByTestId('candidates-capped_veterans')).toBeNull();

        // Bulk "Desplegar todas" expands all rows; clicking "Colapsar todas" collapses them.
        const expandAllBtn = screen.getByRole('button', { name: 'Desplegar todas' });
        fireEvent.click(expandAllBtn);
        for (const r of SAMPLE_ROWS) {
            expect(screen.getByTestId(`candidates-${r.key}`)).toBeInTheDocument();
        }
        const collapseAllBtn = screen.getByRole('button', { name: 'Colapsar todas' });
        fireEvent.click(collapseAllBtn);
        for (const r of SAMPLE_ROWS) {
            expect(screen.queryByTestId(`candidates-${r.key}`)).toBeNull();
        }
    });
});

describe('ElectionConsensusKpiGrid method picker', () => {
    it('opens the searchable SelectPopup on click and switches candidate standings to the picked method', () => {
        const electionItem: GovernanceItem = {
            title: 'Council',
            shortDescription: null,
            description: null,
            options: [],
            links: [],
            quorum: 100,
            approvalThreshold: null,
            start: 1_750_000_000,
            deadline: null,
            author: null,
            voteCount: null,
            revoteCount: null,
            parameterLabel: null,
            elevatedProposalId: null,
            temperatureCheckId: null,
            maxSelections: 1,
            hidden: false,
            votersStore: null,
            election: {
                roleId: null,
                seatCount: 1,
                minimumMedianGrade: 1,
                candidates: [
                    { id: 1, displayName: 'Alice', reference: null, description: null, links: [], displayOrder: 0 },
                    { id: 2, displayName: 'Bob', reference: null, description: null, links: [], displayOrder: 1 },
                ],
            },
        };
        const voters = [
            { account: 'a1', choices: [], grades: { '1': 4, '2': 2 }, power: 600, ageDays: 900, stakedXrd: 600, twab90Xrd: 600, min90Xrd: 600 },
            { account: 'a2', choices: [], grades: { '1': 2, '2': 4 }, power: 200, ageDays: 900, stakedXrd: 200, twab90Xrd: 200, min90Xrd: 200 },
        ];
        const results = compareMethods(voters, itemChoices('election', electionItem), electionItem, { gradeQuantile: '3/5' });
        const consensus = computeElectionConsensus(results, null)!;
        const scoreRows = computeMethodScoreRows(results).map(r => ({ ...r, label: r.key }));
        const onOpenGuide = vi.fn();

        function Harness() {
            const [selected, setSelected] = useState<MethodKey | 'consensus'>('consensus');
            return (
                <ElectionConsensusKpiGrid
                    consensus={consensus}
                    methods={results}
                    scoreRows={scoreRows}
                    selectedKey={selected}
                    onSelectKey={setSelected}
                    gradeQuantile="3/5"
                    c={esCompare}
                    g={esG}
                    language="es"
                    onOpenGuide={onOpenGuide}
                />
            );
        }

        render(<Harness />);

        const pickerTrigger = screen.getByRole('button', { name: /^Clasificación ponderada/i });
        fireEvent.click(pickerTrigger);

        const searchInput = screen.getByPlaceholderText(esCompare.search_placeholder!);
        fireEvent.change(searchInput, { target: { value: '1 XRD = 1 voto' } });

        const linearChoice = screen.getByRole('button', { name: /^1 XRD = 1 voto.*Cada XRD es un voto/i });
        fireEvent.click(linearChoice);

        // Heading now displays the selected method and renders candidate cards for it.
        expect(screen.getByRole('button', { name: /1 XRD = 1 voto/i })).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();

        // Guide trigger opens the guide for the selected method rather than consensus.
        fireEvent.click(screen.getByRole('button', { name: esCompare.election_consensus_guide_open! }));
        expect(onOpenGuide).toHaveBeenCalledWith('linear');
    });
});

describe('ElectionMethodCandidatesGrid status distinction', () => {
    it('visually distinguishes tied-at-cutoff, below-minimum-grade, and outranked candidates', () => {
        render(
            <ElectionMethodCandidatesGrid
                summary={{
                    seatCount: 2,
                    minimumMedianGrade: 2,
                    standings: [
                        {
                            id: 1,
                            label: 'Alice',
                            qualifyingGrade: 4,
                            band: 'A',
                            p: 0.4,
                            q: 0,
                            qualifyingXrd: 1000,
                            histogram: [0, 0, 0, 0, 1000],
                            electableShare: 1,
                            electable: true,
                            rank: 1,
                            tied: false,
                            outcome: 'elected',
                        },
                        {
                            id: 2,
                            label: 'Linuxx',
                            qualifyingGrade: 3,
                            band: 'B',
                            p: 0,
                            q: 0,
                            qualifyingXrd: 500,
                            histogram: [0, 0, 0, 500, 0],
                            electableShare: 1,
                            electable: true,
                            rank: 2,
                            tied: true,
                            outcome: 'tied',
                        },
                        {
                            id: 3,
                            label: 'Dave',
                            qualifyingGrade: 2,
                            band: 'C',
                            p: 0,
                            q: 0.2,
                            qualifyingXrd: 300,
                            histogram: [0, 0, 300, 0, 0],
                            electableShare: 0.8,
                            electable: true,
                            rank: 4,
                            tied: false,
                            outcome: 'reserve',
                        },
                        {
                            id: 4,
                            label: 'Eve',
                            qualifyingGrade: 1,
                            band: 'B',
                            p: 0,
                            q: 0.3,
                            qualifyingXrd: 100,
                            histogram: [0, 100, 0, 0, 0],
                            electableShare: 0.3,
                            electable: false,
                            rank: 5,
                            tied: false,
                            outcome: 'not_elected',
                        },
                    ],
                    elected: [],
                    tiedAtCutoff: [],
                    seatsChanged: 1,
                    entered: [],
                    left: ['Linuxx', 'Dave'],
                }}
                gradeQuantile="3/5"
                c={esCompare}
                g={esG}
                language="es"
            />,
        );

        const tiedBadge = screen.getByText(esG.mj!.outcome_tied!);
        const tiedCard = tiedBadge.closest('div.rounded-2xl')!;
        expect(tiedCard.className).toContain('border-dashed');
        expect(tiedCard.className).toContain('border-sky-500/60');
        expect(tiedBadge.getAttribute('title')).toBe(esCompare.election_card_tied_tip);

        const belowMinBadge = screen.getByText(esCompare.election_card_below_min_badge!);
        expect(belowMinBadge.getAttribute('title')).toContain('Bien');

        const droppedCard = screen.getByText('Dave').closest('div.rounded-2xl')!;
        expect(droppedCard.className).toContain('border-amber-500/50');
        expect(droppedCard.getAttribute('title')).toContain('Fuera de las 2 plazas');
    });
});

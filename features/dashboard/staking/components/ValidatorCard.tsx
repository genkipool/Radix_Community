'use client';

import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { usePrefetchValidatorEntity } from '../hooks/usePrefetchValidator';
import {
    Layout1Col,
    Layout2Col,
    Layout4Col,
    Layout6Col,
} from './ValidatorLayouts';
/* ==============================═══════════
   Main export
   Note: Modal logic is now centrally 
   handled by DashboardModals.
==============================═══════════ */
import { RewardsCsvModal } from './RewardsCsvModal';
import { type ValidatorCardProps } from '../types/components.types';

export const ValidatorCard: React.FC<ValidatorCardProps> = ({
    validator,
    index: _index,
    searchQuery,
    isExpanded,
    columns,
    onExpand,
    onCopy,
    copiedAddress,
    t,
    network = 'mainnet',
    isModalMode = false,
    marketData,
    locale,
}: ValidatorCardProps & { isModalMode?: boolean }) => {
    const downTimeRef = useRef(0);
    const [csvModalOpen, setCsvModalOpen] = useState(false);

    const { prefetchValidator } = usePrefetchValidatorEntity();

    const handleExpand = () => {
        onExpand(validator.id);
    };

    const handleCardClick = () => {
        if (window.getSelection()?.toString().length) return;
        if (Date.now() - downTimeRef.current > 500) return;
        handleExpand();
    };

    const handleDownloadCsv = (address: string) => {
        // We ensure it's the validator address, though the button only appears there
        if (address === validator.address) {
            setCsvModalOpen(true);
        }
    };

    const handlePointerDown = () => { downTimeRef.current = Date.now(); };

    const sharedProps = {
        validator,
        searchQuery,
        isExpanded,
        t,
        onExpand: handleExpand,
        onCopy,
        copiedAddress,
        network,
        marketData,
        locale,
        onDownloadCsv: network !== 'stokenet' ? handleDownloadCsv : undefined,
    };

    return (
        <>
            <Card
                onPointerEnter={() => prefetchValidator(validator.address, network)}
                onPointerDown={handlePointerDown}
                onClick={handleCardClick}
                className={`p-0 overflow-hidden group cursor-pointer transition-[border-color,box-shadow,transform] duration-300 ${isExpanded && !isModalMode
                    ? 'h-full border-[var(--color-primary)]/40 shadow-lg'
                    : 'self-start'
                    }`}
                innerClassName={`${isExpanded ? 'h-full' : ''} flex flex-col`}
            >
                <div className="block sm:hidden flex-1 flex-col h-full w-full">
                    <Layout4Col {...sharedProps} columns={4} />
                </div>
                <div className="hidden sm:flex flex-col flex-1 h-full w-full">
                    {columns === 1 && <Layout1Col {...sharedProps} columns={columns} />}
                    {(columns === 2 || columns === 3) && <Layout2Col {...sharedProps} columns={columns} />}
                    {(columns === 4 || columns === 5) && <Layout4Col {...sharedProps} columns={columns} />}
                    {columns >= 6 && <Layout6Col {...sharedProps} columns={columns} />}
                </div>
            </Card>

            {csvModalOpen && (
                <RewardsCsvModal
                    isOpen={csvModalOpen}
                    onClose={() => setCsvModalOpen(false)}
                    validatorAddress={validator.address}
                    dt={t?.dashboard}
                    marketData={marketData}
                    locale={locale}
                />
            )}
        </>
    );
};

ValidatorCard.displayName = 'ValidatorCard';
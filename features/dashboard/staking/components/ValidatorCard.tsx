'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { usePrefetchValidatorEntity } from '../hooks/usePrefetchValidator';
import {
    Layout1Col,
    Layout2Col,
    Layout4Col,
    Layout6Col,
} from './ValidatorLayouts';
/* ═════════════════════════════════════════
   Main export
   Note: Modal logic is now centrally 
   handled by DashboardModals.
═════════════════════════════════════════ */
import type { ValidatorCardProps } from '../types';

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
}: ValidatorCardProps & { isModalMode?: boolean }) => {
    const [downTime, setDownTime] = useState(0);

    const { prefetchValidator } = usePrefetchValidatorEntity();

    const handleExpand = () => {
        onExpand(validator.id);
    };

    const handleCardClick = () => {
        if (window.getSelection()?.toString().length) return;
        if (Date.now() - downTime > 500) return;
        handleExpand();
    };

    const sharedProps = {
        validator,
        searchQuery,
        isExpanded,
        t,
        onExpand: handleExpand,
        onCopy,
        copiedAddress,
        network,
    };

    return (
        <Card
            onPointerEnter={() => prefetchValidator(validator.address, network)}
            onPointerDown={() => setDownTime(Date.now())}
            onClick={handleCardClick}
            className={`p-0 overflow-hidden group cursor-pointer transition-[border-color,box-shadow,transform] duration-300 ${isExpanded && !isModalMode
                ? 'h-full border-[var(--color-primary)]/40 shadow-lg'
                : 'self-start'
                }`}
            innerClassName={`${isExpanded ? 'h-full' : ''} flex flex-col`}
        >
            {columns === 1 && <Layout1Col {...sharedProps} columns={columns} />}
            {(columns === 2 || columns === 3) && <Layout2Col {...sharedProps} columns={columns} />}
            {(columns === 4 || columns === 5) && <Layout4Col {...sharedProps} columns={columns} />}
            {columns >= 6 && <Layout6Col {...sharedProps} columns={columns} />}
        </Card>
    );
};

ValidatorCard.displayName = 'ValidatorCard';
'use client';
import React, { createContext, use, useMemo, useState, ReactNode } from 'react';

interface LayoutContextType {
    showFooter: boolean;
    setShowFooter: (show: boolean) => void;
    theaterMode: boolean;
    setTheaterMode: (v: boolean | ((prev: boolean) => boolean)) => void;
    showUnderConstruction: boolean;
    setShowUnderConstruction: (v: boolean) => void;
    showInstitutionalPilot: boolean;
    setShowInstitutionalPilot: (v: boolean) => void;
    deleteDocModal: { isOpen: boolean; docTitle: string; onConfirm: () => void };
    openDeleteDocModal: (docTitle: string, onConfirm: () => void) => void;
    closeDeleteDocModal: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
    const [showFooter, setShowFooter] = useState(true);
    const [theaterMode, setTheaterMode] = useState(false);
    const [showUnderConstruction, setShowUnderConstruction] = useState(false);
    const [showInstitutionalPilot, setShowInstitutionalPilot] = useState(false);
    const [deleteDocModal, setDeleteDocModal] = useState<{ isOpen: boolean; docTitle: string; onConfirm: () => void }>({
        isOpen: false,
        docTitle: '',
        onConfirm: () => { },
    });

    const openDeleteDocModal = (docTitle: string, onConfirm: () => void) => {
        setDeleteDocModal({ isOpen: true, docTitle, onConfirm });
    };

    const closeDeleteDocModal = () => {
        setDeleteDocModal(prev => ({ ...prev, isOpen: false }));
    };

    const value = useMemo(() => ({
        showFooter,
        setShowFooter,
        theaterMode,
        setTheaterMode,
        showUnderConstruction,
        setShowUnderConstruction,
        showInstitutionalPilot,
        setShowInstitutionalPilot,
        deleteDocModal,
        openDeleteDocModal,
        closeDeleteDocModal
    }), [
        showFooter,
        theaterMode,
        showUnderConstruction,
        showInstitutionalPilot,
        deleteDocModal,
        openDeleteDocModal,
        closeDeleteDocModal
    ]);

    return (
        <LayoutContext.Provider value={value}>
            {children}
        </LayoutContext.Provider>
    );
}

export function useLayout() {
    const context = use(LayoutContext);
    if (context === undefined) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
}

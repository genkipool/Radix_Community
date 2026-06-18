'use client';

import { useState } from 'react';
import { useCommunityURLState } from './hooks/useCommunityURLState';
import CommunitySidebar from './components/CommunitySidebar';
import { CommunityHero } from './components/CommunityHero';
import { CommunityAreaView } from './components/CommunityAreaView';
import { AdminPanel } from './areas/admin/components/AdminPanel';
import { ExplorerModal } from './components/ExplorerModal';
import { AREAS } from './data/communityData';
import {
    Area,
    AdminView,
    ExplorerTarget
} from './types/data.types';
import { useLanguage } from '@/context/LanguageContext';
import { CommunityDictionary } from './types/i18n.types';

export default function CommunityClient() {
    const { t: dict } = useLanguage();
    const t = dict.community_transparency as unknown as CommunityDictionary;

    // Single atomic URL state for both params — one router.push per event.
    // Replaces two separate useSpeedSyncURL calls that were causing the second
    // push (clearing the other param) to overwrite the first push with a bare
    // pathname, making query params never appear in the URL bar.
    const [urlState, setURLState] = useCommunityURLState();

    const selectedAreaId = urlState.area;
    const adminView = urlState.admin as AdminView;

    const [areas, setAreas] = useState<Area[]>(AREAS);
    const [explorerTarget, setExplorerTarget] = useState<ExplorerTarget | null>(null);

    const handleSelectArea = (id: string | null) => {
        if (id) window.scrollTo({ top: 0, behavior: 'instant' });
        setURLState({ area: id, admin: null });
    };

    const handleAdminViewChange = (view: AdminView) => {
        if (view) window.scrollTo({ top: 0, behavior: 'instant' });
        setURLState({ area: null, admin: view });
    };

    const selectedArea = selectedAreaId
        ? areas.find(a => a.id === selectedAreaId) ?? null
        : null;

    const showHero = selectedAreaId === null && adminView === null;

    return (
        <div
            className="flex flex-col md:flex-row w-full flex-1"
            style={{ background: 'var(--color-bg)', paddingTop: '80px' }}
        >
            <CommunitySidebar
                t={t}
                selectedAreaId={selectedAreaId}
                onSelectArea={handleSelectArea}
                areas={areas}
                adminView={adminView}
                onAdminViewChange={handleAdminViewChange}
            />

            <main className="flex-1 relative min-w-0" style={{ overflowX: 'clip' }}>
                <ExplorerModal t={t} target={explorerTarget} onClose={() => setExplorerTarget(null)} />
                <CommunityHero
                    collapsed={!showHero}
                    onSelectArea={handleSelectArea}
                    areas={areas}
                    onShowExplorer={setExplorerTarget}
                />
                {selectedArea && adminView === null && (
                    <CommunityAreaView
                        t={t}
                        area={selectedArea}
                        onShowExplorer={setExplorerTarget}
                    />
                )}
                {adminView !== null && (
                    <AdminPanel
                        areas={areas}
                        onUpdateAreas={setAreas}
                        initialView={adminView}
                        onViewChange={handleAdminViewChange}
                        onClose={() => handleAdminViewChange(null)}
                    />
                )}
            </main>
        </div>
    );
}

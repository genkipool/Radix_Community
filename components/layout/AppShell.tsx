'use client';

import { useLayout } from '@/context/LayoutContext';
import { useLanguage } from '@/context/LanguageContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import dynamic from 'next/dynamic';
import { ReactNode } from 'react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';

const UnderConstructionModal = dynamic(() => import('@/components/shared/UnderConstructionModal').then(mod => mod.UnderConstructionModal), { ssr: false });
const DeleteDocModal = dynamic(() => import('@/components/shared/DeleteDocModal').then(mod => mod.DeleteDocModal), { ssr: false });
const InstitutionalPilotModal = dynamic(() => import('@/features/home/components/InstitutionalPilotModal'), { ssr: false });


export function AppShell({ children }: { children: ReactNode }) {
  const {
    showFooter,
    showUnderConstruction,
    setShowUnderConstruction,
    showInstitutionalPilot,
    setShowInstitutionalPilot
  } = useLayout();
  const { t, language } = useLanguage();

  useScrollRestoration();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-main)] font-sans selection:bg-[var(--color-primary)]/30 relative" style={{ overflowX: 'clip' }}>
      {/* Background depth layers — will-change-transform promotes to GPU compositor */}
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none z-0 will-change-transform" />
      <div className="ambient-glow z-0 will-change-transform" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navbar no longer uses useSearchParams() so no Suspense boundary needed */}
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        {showFooter && <Footer />}

        <UnderConstructionModal
          isOpen={showUnderConstruction}
          onClose={() => setShowUnderConstruction(false)}
          t={t}
        />

        <InstitutionalPilotModal
          key={String(showInstitutionalPilot)}
          isOpen={showInstitutionalPilot}
          onClose={() => setShowInstitutionalPilot(false)}
          t={t}
          lang={language}
        />

        <DeleteDocModal />
      </div>
    </div>
  );
}

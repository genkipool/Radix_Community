import React from 'react';
import { X, Info, CheckCircle2 } from 'lucide-react';
import { SidePanelModal } from '@/components/shared/SidePanelModal';
import { SidePanelControls } from '@/components/shared/SidePanelControls';
import { useSidePanelControls } from '@/components/shared/hooks/useSidePanelControls';
import { ConsoleToolSlug } from '@/features/console/types/console.types';
import type { Dictionary } from '@/types/i18n';

interface ToolInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: ConsoleToolSlug | null;
  t: Dictionary;
}

export function ToolInfoModal({ isOpen, onClose, slug, t }: ToolInfoModalProps) {
  const toolT = slug ? (t.console?.tools as Record<string, Record<string, unknown>>)?.[slug] : null;
  const guide = toolT?.guide as Record<string, unknown> | undefined;

  const {
    isPinned,
    togglePin,
    handlePiP,
    handlePopupWindow,
    externalWindow,
    closeExternalWindow,
    resetPin,
  } = useSidePanelControls('toolInfoPinned');

  const handleClose = () => {
    resetPin();
    closeExternalWindow();
    onClose();
  };

  const isStandaloneMode = !!externalWindow;

  return (
    <SidePanelModal
        isOpen={isOpen && !!slug}
        onClose={handleClose}
        isStandalone={isStandaloneMode}
        isPinned={isPinned}
        portalTarget={externalWindow ? externalWindow.document.body : undefined}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 bg-[var(--color-surface)]/85 mb-2">
          <div className="flex items-center gap-4 min-w-0">
            <div className="size-10 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center shrink-0 shadow-lg shadow-[var(--color-primary)]/20">
              <Info className="size-5 text-white" strokeWidth={2} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-text-main)] truncate">
              {(guide?.guideTitle as string) || (toolT?.title as string)}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <SidePanelControls
                isPinned={isPinned}
                togglePin={togglePin}
                handlePiP={handlePiP}
                handlePopupWindow={handlePopupWindow}
                pinText={t.nav?.wallet_pin_sidebar || 'Anclar como barra lateral'}
                unpinText={t.nav?.wallet_pin_sidebar_remove || 'Desanclar barra lateral'}
                pipText={t.nav?.wallet_picture_in_picture || 'Convertir a ventana picture in picture'}
                popupText={t.nav?.wallet_popup_window || 'Convertir en ventana emergente'}
            />
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg)] transition-colors opacity-80 hover:opacity-100 duration-300"
            >
              <X strokeWidth={2} className="size-5" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          <div className="space-y-10">
            
            <p className="text-[15px] leading-relaxed text-[var(--color-text-muted)]">
              {(guide?.guideDescription as string) || (toolT?.description as string)}
            </p>

            {Array.isArray(guide?.guideSteps) && guide.guideSteps.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2 flex items-center gap-2">
                Instrucciones de uso
              </h3>

              <div className="space-y-6 mt-6">
                {guide.guideSteps.map((step: string, idx: number) => {
                  const match = step.match(/^(\d+)\.\s+(.*)$/);
                  const isNumberFirst = !!match;
                  const content = isNumberFirst ? match[2] : step;

                  return (
                    <div key={idx} className="flex gap-4 items-start group">
                      <div className="shrink-0 mt-0.5">
                        {isNumberFirst ? (
                          <div className="text-[var(--color-primary)] text-sm font-black w-6 flex justify-end">
                            {match[1]}.
                          </div>
                        ) : (
                          <CheckCircle2 className="size-5 text-[var(--color-primary)] opacity-80" strokeWidth={2} />
                        )}
                      </div>
                      <p className="text-[14px] leading-relaxed text-[var(--color-text-main)]">
                        {content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {Array.isArray(guide?.example) && guide.example.length > 0 && (
              <div className="space-y-6 pt-4">
                <h3 className="text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2 flex items-center gap-2">
                  Ejemplo Práctico
                </h3>

                <div className="mt-6 flex flex-col gap-5 max-w-sm">
                  {guide.example.map((item: { type: 'button-group' | 'dropdown' | 'textarea' | 'input'; field: string; value?: string; options?: string[]; selected?: string | string[]; isAddress?: boolean; isNumeric?: boolean }, idx: number) => {
                    if (item.type === 'button-group') {
                      const isMulti = Array.isArray(item.selected);
                      return (
                        <div key={idx} className="flex flex-col gap-2">
                          {item.field && (
                            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] ml-1">
                              {item.field}
                            </label>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {(item.options || []).map((opt: string, i: number) => {
                              const selected = isMulti && Array.isArray(item.selected) ? item.selected.includes(opt) : item.selected === opt;
                              return (
                                <div key={i} className={`flex-1 min-w-fit px-3 py-2 text-[12px] font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${selected ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-inner' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-card-border)] opacity-70'}`}>
                                  {selected && <div className="size-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />}
                                  {opt}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    if (item.type === 'dropdown') {
                      return (
                        <div key={idx} className="flex flex-col gap-2">
                          {item.field && (
                            <label className="text-[12px] font-bold text-[var(--color-text-main)] ml-1">
                              {item.field}
                            </label>
                          )}
                          <div className="w-full bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl px-4 py-3 flex items-center justify-between cursor-not-allowed">
                            <span className={`text-[13px] truncate ${typeof item.selected === 'string' && item.selected.startsWith('account_') ? 'font-mono text-[var(--color-text-main)]' : 'text-[var(--color-text-main)] font-medium'}`}>
                              {item.selected}
                            </span>
                            <svg className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
                      );
                    }

                    if (item.type === 'textarea') {
                      return (
                        <div key={idx} className="flex flex-col gap-2">
                          {item.field && (
                            <label className="text-[12px] font-bold text-[var(--color-text-main)] ml-1">
                              {item.field}
                            </label>
                          )}
                          <div className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-xl px-4 py-3 h-24 opacity-80 overflow-hidden">
                            <span className="text-[12px] font-mono text-[var(--color-text-muted)] break-all leading-relaxed">
                              {item.value}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // type === 'input'
                    const isAddress = item.isAddress || (typeof item.value === 'string' && (item.value.startsWith('account_') || item.value.startsWith('resource_') || item.value.startsWith('component_') || item.value.startsWith('package_') || item.value.startsWith('rdx1')));
                    return (
                      <div key={idx} className="flex flex-col gap-2">
                        {item.field && (
                          <label className="text-[12px] font-bold text-[var(--color-text-main)] ml-1">
                            {item.field}
                          </label>
                        )}
                        <div className={`w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-xl px-4 py-3 flex items-center justify-between ${isAddress ? 'opacity-80' : ''}`}>
                          <span className={`text-[13px] truncate ${isAddress ? 'font-mono text-[var(--color-text-muted)]' : item.isNumeric ? 'font-mono text-[var(--color-text-main)] font-bold' : 'text-[var(--color-text-main)]'}`}>
                            {item.value}
                          </span>
                          {isAddress && (
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <div className="h-4 w-px bg-[var(--color-card-border)]" />
                              <div className="size-4 rounded-sm bg-[var(--color-surface)] border border-[var(--color-card-border)]" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Array.isArray(guide?.glossary) && guide.glossary.length > 0 && (
              <div className="space-y-6 pt-4">
                <h3 className="text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2 flex items-center gap-2">
                  Glosario de Términos
                </h3>

                <div className="grid grid-cols-1 gap-4 mt-6">
                  {guide.glossary.map((item: { term: string; definition: string }, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)]/50 hover:border-[var(--color-primary)]/30 transition-colors">
                      <p className="text-sm font-bold text-[var(--color-primary)] mb-1.5">{item.term}</p>
                      <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">{item.definition}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidePanelModal>
  );
}

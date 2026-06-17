import React from 'react';
import { MoreVertical, LayoutPanelLeft, PictureInPicture2, AppWindow } from 'lucide-react';

export interface SidePanelControlsProps {
  isPinned: boolean;
  togglePin: () => void;
  handlePiP: () => void;
  handlePopupWindow: () => void;
  pinText?: string;
  unpinText?: string;
  pipText?: string;
  popupText?: string;
}

export function SidePanelControls({
  isPinned,
  togglePin,
  handlePiP,
  handlePopupWindow,
  pinText = 'Anclar como barra lateral',
  unpinText = 'Desanclar barra lateral',
  pipText = 'Convertir a ventana picture in picture',
  popupText = 'Convertir en ventana emergente',
}: SidePanelControlsProps) {
  return (
    <div className="relative group/menu">
      <button
        type="button"
        className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg)] transition-colors opacity-80 hover:opacity-100 duration-300"
        aria-label="Más opciones"
      >
        <MoreVertical strokeWidth={2} className="size-5" />
      </button>
      <div className="absolute top-full right-0 mt-1 w-64 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl z-[9999] opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 overflow-hidden transform origin-top-right scale-95 group-hover/menu:scale-100">
        <div className="flex flex-col p-1.5 space-y-0.5">
          <button
            type="button"
            onClick={togglePin}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)] rounded-lg transition-colors text-left group/item"
          >
            <LayoutPanelLeft className="size-4 text-[var(--color-text-muted)] group-hover/item:text-[var(--color-primary)] transition-colors" />
            <span>{isPinned ? unpinText : pinText}</span>
          </button>
          <button
            type="button"
            onClick={handlePiP}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)] rounded-lg transition-colors text-left group/item"
          >
            <PictureInPicture2 className="size-4 text-[var(--color-text-muted)] group-hover/item:text-[var(--color-primary)] transition-colors" />
            <span>{pipText}</span>
          </button>
          <button
            type="button"
            onClick={handlePopupWindow}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)] rounded-lg transition-colors text-left group/item"
          >
            <AppWindow className="size-4 text-[var(--color-text-muted)] group-hover/item:text-[var(--color-primary)] transition-colors" />
            <span>{popupText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

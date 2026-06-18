import { X } from 'lucide-react';
import AlchemyPayWidget from './AlchemyPayWidget';
import { useEffect, useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface BuyXRDModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyTitle?: string;
  fallbackText?: string;
}

export function BuyXRDModal({ isOpen, onClose, buyTitle = 'Comprar XRD', fallbackText = 'pulsa aqui sino carga alchemy' }: BuyXRDModalProps) {
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-[500px] bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-card-border)]/50 bg-[var(--color-surface)] relative z-30">
          <div className="flex flex-col items-center sm:items-start w-full">
            <h3 className="text-lg font-bold text-[var(--color-text-main)] flex items-center gap-2">
              {buyTitle}
            </h3>
            <a 
              href="https://ramp.alchemypay.org/?crypto=XRD&fiat=EUR&amount=100&alpha2=DE&network=XRD&type=officialWebsite#/index"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto text-sm sm:text-xs text-[var(--color-primary)] hover:underline opacity-90 mt-1"
            >
              {fallbackText}
            </a>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>
        
        <div className="p-0 bg-[var(--color-bg)]">
          <AlchemyPayWidget />
        </div>
      </div>
    </div>
  );
}

import { SafeImage } from '@/components/ui/SafeImage';
import { CopyButton } from '@/components/ui/CopyButton';

export interface ResourceCardProps {
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
  name: string;
  address: string;
  fullAddress?: string;
  iconUrl?: string;
  title?: string;
}

export function ResourceCard({
  isActive,
  disabled,
  onClick,
  name,
  address,
  fullAddress,
  iconUrl,
  title,
}: ResourceCardProps) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group flex items-center justify-start rounded-xl border text-left transition-all duration-150 ${
        disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer hover:opacity-90 hover:shadow-sm active:scale-95'
      }`}
      style={{
        background: isActive ? 'rgba(var(--color-primary-rgb), 0.08)' : 'var(--color-surface)',
        borderColor: isActive ? 'var(--color-primary)' : 'var(--color-card-border)',
      }}
      title={title || name}
    >
      <div className="grid grid-cols-[auto_1fr] grid-rows-2 gap-x-2.5 gap-y-0.5 w-full p-2">
        <div className="col-start-1 row-span-2 flex items-center justify-center">
          <SafeImage
            src={iconUrl}
            alt={name}
            fallbackName={name}
            className="size-9 rounded-full object-cover shadow-sm bg-white/10"
          />
        </div>
        <div
          className="col-start-2 row-start-1 truncate font-bold text-xs leading-tight self-end"
          style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-main)' }}
        >
          {name}
        </div>
        <div
          className="col-start-2 row-start-2 flex items-center gap-1.5 mb-0.5 min-w-0"
          style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
        >
          <span className="truncate text-[11px] font-medium opacity-70">{address}</span>
          {fullAddress && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0 opacity-80 hover:opacity-100">
              <CopyButton value={fullAddress} variant="minimal" size="xs" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

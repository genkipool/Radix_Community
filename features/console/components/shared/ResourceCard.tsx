import { SafeImage } from '@/components/ui/SafeImage';

export interface ResourceCardProps {
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
  name: string;
  address: string;
  iconUrl?: string;
  title?: string;
}

export function ResourceCard({
  isActive,
  disabled,
  onClick,
  name,
  address,
  iconUrl,
  title,
}: ResourceCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex items-center justify-start rounded-xl border text-left transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-sm active:scale-95"
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
          className="col-start-2 row-start-1 truncate font-bold text-xs leading-tight mt-0.5"
          style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-main)' }}
        >
          {name}
        </div>
        <div
          className="col-start-2 row-start-2 truncate text-[11px] font-medium opacity-70 mb-0.5"
          style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
        >
          {address}
        </div>
      </div>
    </button>
  );
}

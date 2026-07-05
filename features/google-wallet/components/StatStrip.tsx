import { FadeIn } from '@/components/ui/FadeIn';

interface StatStripItem {
  value: string;
  label: string;
}

interface StatStripProps {
  items: StatStripItem[];
  /** Tailwind grid columns for md+ screens; defaults to one column per item. */
  columnsClass?: string;
}

/**
 * StatStrip — RSC
 *
 * Horizontal band of large stat values with muted labels, mirroring the
 * metrics bar of the home hero. Same pattern as the Hyperscale StatStrip.
 */
export function StatStrip({ items, columnsClass }: StatStripProps) {
  const gridCols = columnsClass ?? (items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4');

  return (
    <div className={`grid grid-cols-2 ${gridCols} gap-8 pt-12 border-t border-[var(--color-card-border)]`}>
      {items.map((item, i) => (
        <FadeIn key={item.label} delay={i * 0.05}>
          <div
            className={`text-3xl font-bold mb-2 ${
              i % 2 === 0
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]'
                : 'text-[var(--color-text-main)]'
            }`}
          >
            {item.value}
          </div>
          <div className="text-sm text-[var(--color-text-muted)] font-medium">{item.label}</div>
        </FadeIn>
      ))}
    </div>
  );
}

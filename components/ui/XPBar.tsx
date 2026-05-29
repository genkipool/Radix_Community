
interface XPBarProps {
    progress: number;
    color: string;
    label?: string | number;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    showDots?: boolean;
    title?: string;
}

export function XPBar({
    progress,
    color,
    label,
    className = '',
    size = 'md',
    showDots = true,
    title,
}: XPBarProps) {
    const trackH = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-8' : 'h-6';
    const dotSize = size === 'sm' ? 'w-0.5 h-0.5' : 'size-1';
    const dotCount = size === 'sm' ? 4 : 5;

    return (
        <div className={`relative w-full ${className}`} title={title || label?.toString()}>
            <div className={`relative w-full rounded-full bg-[var(--color-card-border)] overflow-hidden shadow-inner flex items-center justify-center border border-white/10 ${trackH}`}>
                {/* Glow background */}
                <div
                    className="absolute left-0 top-0 bottom-0 rounded-full opacity-10 transition-all duration-700 ease-out"
                    style={{ width: `${progress}%`, backgroundColor: color }}
                />
                {/* Fill bar */}
                <div
                    className="absolute left-0 top-0 bottom-0 rounded-full opacity-70 transition-all duration-700 ease-out shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                    style={{ width: `${progress}%`, background: `linear-gradient(90deg, transparent, ${color})` }}
                />

                {showDots && (
                    <div className="absolute inset-x-0 flex justify-between px-3 pointer-events-none opacity-50">
                        {Array.from({ length: dotCount }).map((_, i) => (
                            <div key={i} className={`${dotSize} rounded-full bg-white/40`} />
                        ))}
                    </div>
                )}

                {size !== 'sm' && label !== undefined && (
                    <div className="relative z-10 px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-sm border border-white/10 shadow-sm flex items-center justify-center">
                        <span className="text-[9px] font-black tracking-widest text-white uppercase leading-none">
                            {label}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

interface GlowBlobProps {
    color: string;
    size?: number;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity?: number;
    blur?: number;
}

const POSITIONS: Record<string, string> = {
    'top-left': 'top-1/4 -left-32',
    'top-right': 'top-1/4 -right-32',
    'bottom-left': 'bottom-1/4 -left-32',
    'bottom-right': 'bottom-1/4 -right-32',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
};

export function GlowBlob({
    color,
    size = 400,
    position = 'top-left',
    opacity = 0.2,
    blur = 120,
}: GlowBlobProps) {
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ opacity }}>
            <div
                className={`absolute ${POSITIONS[position]} rounded-full`}
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    background: color,
                    filter: `blur(${blur}px)`,
                }}
            />
        </div>
    );
}

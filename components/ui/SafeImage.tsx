'use client';
import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { buildFallbackAvatar } from '@/utils/sanitize';

interface SafeImageProps {
    src?: string;
    alt: string;
    fallbackName: string;
    className?: string;
    style?: CSSProperties;
    title?: string;
    loading?: 'lazy' | 'eager';
    zoomable?: boolean;
    /**
     * What the zoom shows, when `src` is a version cut down for its place on
     * the page. Blowing a card-sized image up to fill the screen is what the
     * zoom is there to avoid.
     */
    zoomSrc?: string;
}

function resolveSrc(src: string | undefined, fallback: string): string {
    return src && src.trim() ? src.trim() : fallback;
}

export function SafeImage({
    src,
    alt,
    fallbackName,
    className = '',
    style,
    title,
    loading = 'lazy',
    zoomable = true,
    zoomSrc,
}: SafeImageProps) {
    const fallback = buildFallbackAvatar(fallbackName);
    const [errored, setErrored] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);
    const imgSrc = errored ? fallback : resolveSrc(src, fallback);
    /**
     * Whether the initials avatar IS the image, rather than something shown
     * while the real one arrives. It is a data URL, so it paints immediately
     * and never flickers.
     */
    const showingInitials = errored || !(src && src.trim());
    const imgRef = useRef<HTMLImageElement>(null);

    useLayoutEffect(() => {
        const img = imgRef.current;
        if (img?.complete) {
            if (img.naturalWidth === 0) setErrored(true);
            else setLoaded(true);
        }
    }, [fallback]);

    useEffect(() => {
        if (!isZoomed) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsZoomed(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [isZoomed]);

    const handleError = () => {
        setErrored(true);
        setLoaded(true);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (zoomable && loaded && !errored) {
            e.preventDefault();
            e.stopPropagation();
            setIsZoomed(true);
        }
    };

    return (
        <>
            <Image
                ref={imgRef}
                src={imgSrc}
                alt={alt}
                className={`${className} ${zoomable && loaded && !errored ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
            style={{
                ...style,
                color: 'transparent', // Hide alt text while loading
                /*
                 * A quiet surface while a real logo is on its way, not the
                 * initials avatar.
                 *
                 * Painting the initials first meant every load of the grid
                 * flashed a coloured letter into each card and then replaced it
                 * with the logo a moment later — the same information twice,
                 * announced as a change. The placeholder now matches the card
                 * it sits in, so what the reader sees is an image arriving,
                 * which is what is actually happening.
                 */
                backgroundColor:
                    loaded || showingInitials ? undefined : 'var(--color-surface)',
            }}
            title={title}
            onLoad={() => setLoaded(true)}
            onError={handleError}
            loading={loading}
            // These come from any domain the ledger happens to name, so Next's
            // optimiser is not involved: the ones that needed shrinking are
            // already served shrunk (see /api/validator-icon).
            unoptimized={true}
            width={100} // Default placeholder resolution
            height={100}
            onClick={zoomable ? handleClick : undefined}
        />
            {isZoomed && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
                >
                    <button 
                        className="absolute top-4 right-4 p-2 text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors z-50"
                        onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
                        aria-label="Close modal"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <div 
                        className="relative w-[90vw] h-[90vh] animate-in zoom-in-95 duration-200" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Image
                            src={errored ? imgSrc : (zoomSrc?.trim() || imgSrc)}
                            alt={alt}
                            fill
                            className="object-contain drop-shadow-2xl rounded-lg"
                            unoptimized={true}
                        />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

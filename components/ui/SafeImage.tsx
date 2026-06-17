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
}: SafeImageProps) {
    const fallback = buildFallbackAvatar(fallbackName);
    const [errored, setErrored] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);
    const imgSrc = errored ? fallback : resolveSrc(src, fallback);
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
                backgroundImage: !loaded && !errored ? `url('${fallback}')` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
            title={title}
            onLoad={() => setLoaded(true)}
            onError={handleError}
            loading={loading}
            unoptimized={true} // External avatars can be from any domain
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
                            src={imgSrc}
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

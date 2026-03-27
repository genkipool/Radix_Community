/* eslint-disable @next/next/no-img-element */
'use client';
import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { buildFallbackAvatar } from '@/utils/sanitize';

interface SafeImageProps {
    src?: string;
    alt: string;
    fallbackName: string;
    className?: string;
    style?: CSSProperties;
    title?: string;
    loading?: 'lazy' | 'eager';
}

/** Returns src only if it is a non-empty string, otherwise the fallback. */
function resolveSrc(src: string | undefined, fallback: string): string {
    return src && src.trim() ? src : fallback;
}

export function SafeImage({
    src,
    alt,
    fallbackName,
    className = '',
    style,
    title,
    loading = 'lazy',
}: SafeImageProps) {
    const fallback = buildFallbackAvatar(fallbackName);
    const [imgSrc, setImgSrc] = useState(() => resolveSrc(src, fallback));
    const imgRef = useRef<HTMLImageElement>(null);

    // Sync when src prop changes (e.g. list re-renders with different data)
    useEffect(() => {
        setImgSrc(resolveSrc(src, fallback));
    }, [src, fallback]);

    // Catch cached 404s that resolve before React's onError attaches
    useLayoutEffect(() => {
        const img = imgRef.current;
        if (img?.complete && img.naturalWidth === 0) setImgSrc(fallback);
    }, [fallback]);

    const handleError = () => setImgSrc(fallback);

    return (
        <img
            ref={imgRef}
            src={imgSrc}
            alt={alt}
            className={className}
            style={style}
            title={title}
            onError={handleError}
            loading={loading}
        />
    );
}

'use client';
import { useRef, useLayoutEffect, useState } from 'react';
import Image from 'next/image';
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
    const [errored, setErrored] = useState(false);
    const imgSrc = errored ? fallback : resolveSrc(src, fallback);
    const imgRef = useRef<HTMLImageElement>(null);

    // Catch cached 404s that resolve before React's onError attaches
    useLayoutEffect(() => {
        const img = imgRef.current;
        if (img?.complete && img.naturalWidth === 0) setErrored(true);
    }, [fallback]);

    const handleError = () => setErrored(true);

    return (
        <Image
            ref={imgRef}
            src={imgSrc}
            alt={alt}
            className={className}
            style={style}
            title={title}
            onError={handleError}
            loading={loading}
            unoptimized={true} // External avatars can be from any domain
            width={100} // Default placeholder resolution
            height={100}
        />
    );
}

'use client';

import { MANIFEST_TOKEN_STYLES, tokenizeManifest } from '../../lib/manifest-syntax';

interface ManifestCodeProps {
  code: string;
  className?: string;
}

/** Read-only, theme-aware syntax-highlighted manifest. */
export function ManifestCode({ code, className = '' }: ManifestCodeProps) {
  return (
    <pre className={`m-0 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words ${className}`}>
      <code>
        {tokenizeManifest(code).map((token, index) => (
          <span key={index} style={MANIFEST_TOKEN_STYLES[token.type]}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

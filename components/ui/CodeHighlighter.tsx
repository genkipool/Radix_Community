'use client';

import React, { useState, useEffect } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { createHighlighter, type Highlighter } from 'shiki';
import { useTheme } from '@/context/ThemeContext';

interface CodeHighlighterProps {
  html: string;
  className?: string;
}

const langs = [
  'typescript', 'javascript', 'rust', 'css', 'html', 'bash', 'json', 'markdown',
  'python', 'go', 'yaml', 'sql', 'toml', 'cpp', 'c', 'jsonc'
] as const;
type Lang = typeof langs[number];

const themes = [
  'dracula',
  'vitesse-light',
  'vitesse-dark',
  'min-dark',
  'catppuccin-latte',
  'min-light',
  'nord'
] as const;
type ShikiTheme = typeof themes[number];

let highlighterInstance: Highlighter | null = null;
let initializationPromise: Promise<Highlighter> | null = null;

async function getShikiHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) return highlighterInstance;
  if (initializationPromise) return initializationPromise;

  initializationPromise = createHighlighter({
    themes: [...themes],
    langs: [...langs],
  }).then((h: Highlighter) => {
    highlighterInstance = h;
    return h;
  });

  return initializationPromise;
}

export function CodeHighlighter({ html, className = '' }: CodeHighlighterProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string>(html);
  const [isLoaded, setIsLoaded] = useState(false);
  const { theme } = useTheme();
  const mounted = useMounted();

  const getActiveTheme = (): ShikiTheme => {
    if (!mounted) return 'dracula';

    switch (theme) {
      case 'radix-light': return 'min-light';
      case 'radix-dark': return 'min-dark';
      case 'oro-light': return 'vitesse-light';
      case 'oro-dark': return 'vitesse-dark';
      case 'radix-original-light': return 'catppuccin-latte';
      case 'radix-original-dark': return 'dracula';
      default: return 'dracula';
    }
  };

  const activeTheme = getActiveTheme();

  useEffect(() => {
    let isMounted = true;

    async function processHighlighting() {
      try {
        const parser = new DOMParser();

        // Multi-line paste normalization (handling multi-code tag artifacts)
        const normalizedHtml = html.replace(/<\/code><code[^>]*>/gi, '\n');
        const doc = parser.parseFromString(normalizedHtml, 'text/html');

        // Target top-level blocks correctly
        const blocks = Array.from(doc.querySelectorAll('pre, [class*="language-"]'))
          .filter(el => !el.parentElement?.closest('pre'));

        if (blocks.length === 0) {
          if (isMounted) {
            setHighlightedHtml(html);
            setIsLoaded(true);
          }
          return;
        }

        const shiki = await getShikiHighlighter();
        if (!isMounted) return;

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.whiteSpace = 'pre-wrap';
        document.body.appendChild(tempContainer);

        blocks.forEach((block) => {
          let rawCode = "";
          const nestedCodes = block.querySelectorAll('code');

          if (nestedCodes.length > 1) {
            // If the block has multiple code lines as separate tags, join with \n
            rawCode = Array.from(nestedCodes).map(c => c.textContent).join('\n');
          } else {
            // Otherwise use innerText for standard formatted blocks
            tempContainer.innerHTML = block.innerHTML;
            rawCode = tempContainer.innerText;
          }

          if (!rawCode.trim()) return;

          // Detect language
          let lang = 'typescript';
          const combinedClasses = (block as HTMLElement).className + " " + (block.querySelector('code')?.className || "");
          const langMatch = combinedClasses.match(/language-(\w+)/);

          if (langMatch) {
            lang = langMatch[1];
          } else if (rawCode.includes('fn ') || rawCode.includes('let mut')) {
            lang = 'rust';
          } else if (rawCode.includes('{') && rawCode.includes('}')) {
            lang = 'javascript';
          }

          if (lang === 'js') lang = 'javascript';
          if (lang === 'ts') lang = 'typescript';
          if (!langs.includes(lang as Lang)) lang = 'typescript';

          try {
            const hResult = shiki.codeToHtml(rawCode, {
              lang,
              theme: activeTheme,
            });

            const hDoc = parser.parseFromString(hResult, 'text/html');
            const hPre = hDoc.querySelector('pre');

            if (hPre) {
              hPre.setAttribute('style', `
                background-color: transparent !important; 
                padding: 1.25rem !important;
                margin: 1.5rem 0 !important;
                border: 1px solid var(--color-card-border) !important;
                border-radius: 12px !important;
                white-space: pre-wrap !important; 
                word-break: break-all !important;
                overflow-x: auto !important;
                font-family: 'JetBrains Mono', monospace !important;
                font-size: 0.85rem !important;
                line-height: 1.7 !important;
                display: block !important;
                width: 100% !important;
              `.trim().replace(/\n/g, ' '));

              block.replaceWith(hPre);
            }
          } catch (e) {
            console.warn('Highlight failed for block', e);
          }
        });

        document.body.removeChild(tempContainer);

        if (isMounted) {
          setHighlightedHtml(doc.body.innerHTML);
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Highlighter fatal error', error);
        if (isMounted) {
          setHighlightedHtml(html);
          setIsLoaded(true);
        }
      }
    }

    processHighlighting();
    return () => { isMounted = false; };
  }, [html, activeTheme, mounted, theme]);

  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      style={{
        opacity: isLoaded ? 1 : 0.8,
        transition: 'opacity 0.2s',
        width: '100%',
        position: 'relative'
      }}
    />
  );
}

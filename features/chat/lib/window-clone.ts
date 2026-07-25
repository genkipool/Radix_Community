'use client';

/**
 * Helpers for rendering live React DOM into ANOTHER window (a Document
 * Picture-in-Picture window or a detached popup).
 *
 * Such a window starts with a completely empty document, so nothing of the
 * app's styling exists there: without cloning the stylesheets and the theme
 * markers from `<html>`, every CSS variable the design relies on resolves to
 * nothing and the portalled UI renders unstyled.
 */

/** Clones the page's stylesheets into `target`. */
export function cloneStyles(target: Window): void {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('');
      const style = target.document.createElement('style');
      style.textContent = css;
      target.document.head.appendChild(style);
    } catch {
      // Cross-origin sheets cannot be read; re-link them instead.
      if (sheet.href) {
        const link = target.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
}

/** Mirrors <html>/<body> class and theme attributes so variables resolve. */
export function cloneThemeMarkers(target: Window): void {
  const root = document.documentElement;
  target.document.documentElement.className = root.className;
  for (const name of root.getAttributeNames()) {
    if (name === 'class') continue;
    const value = root.getAttribute(name);
    if (value !== null) target.document.documentElement.setAttribute(name, value);
  }
  target.document.body.className = document.body.className;
  target.document.body.style.margin = '0';
  target.document.body.style.background = 'var(--color-card-bg)';
}

/** Prepares a freshly opened window: styles + theme, ready to portal into. */
export function prepareWindow(target: Window, title?: string): void {
  cloneStyles(target);
  cloneThemeMarkers(target);
  if (title) target.document.title = title;
}

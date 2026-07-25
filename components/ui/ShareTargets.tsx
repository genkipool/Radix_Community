'use client';

/**
 * Send a link straight to WhatsApp or Telegram, next to the copy control.
 *
 * Both are plain share URLs opened in a new tab: no SDK, no tracking script and
 * no third-party code running on the page. On phones the OS hands them to the
 * installed app; on desktop they open the web client.
 */
const WhatsappIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.26-4.37c0-4.54 3.7-8.25 8.24-8.25Z"
      fill="currentColor"
    />
    <path
      d="M9.31 7.13c-.19-.42-.38-.43-.56-.44l-.48-.01c-.16 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.6c.13.17 1.74 2.79 4.3 3.8 2.13.84 2.56.67 3.02.63.46-.04 1.5-.61 1.71-1.2.21-.59.21-1.1.15-1.2-.06-.11-.23-.17-.48-.29-.25-.13-1.5-.74-1.73-.82-.23-.09-.4-.13-.57.12-.17.25-.65.82-.8.99-.14.17-.29.19-.54.06-.25-.13-1.07-.4-2.04-1.26-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.38.11-.51.11-.11.25-.29.38-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.55-1.38-.77-1.88Z"
      fill="currentColor"
    />
  </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M23.112 4.494c.318-1.55-1.205-2.837-2.68-2.267L2.342 9.216c-1.647.637-1.72 2.941-.117 3.682l3.94 1.818 1.873 6.559a1 1 0 0 0 1.67.432l2.886-2.887 4.044 3.033a2 2 0 0 0 3.159-1.198zM3.063 11.082l18.09-6.99-3.315 16.161L13.1 16.7a1 1 0 0 0-1.307.093l-1.236 1.236.371-2.043 7.28-7.279a1 1 0 0 0-1.204-1.575L6.95 12.876zm5.114 3.397.606 2.123.233-1.281a1 1 0 0 1 .277-.528l2.22-2.22z"
      fill="currentColor"
    />
  </svg>
);

export function ShareTargets({
  url,
  /** Optional line sent before the link (WhatsApp) or as its caption (Telegram). */
  text,
  className = '',
}: {
  url: string;
  text?: string;
  className?: string;
}) {
  if (!url) return null;

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text ? `${text} ${url}` : url)}`;
  const telegram = `https://t.me/share/url?url=${encodeURIComponent(url)}${
    text ? `&text=${encodeURIComponent(text)}` : ''
  }`;

  const style =
    'flex size-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--color-text-muted)] opacity-60 transition-all hover:opacity-100 hover:text-[var(--color-primary)]';

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
        title="WhatsApp"
        className={style}
      >
        <WhatsappIcon className="size-4" />
      </a>
      <a
        href={telegram}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Telegram"
        title="Telegram"
        className={style}
      >
        <TelegramIcon className="size-4" />
      </a>
    </div>
  );
}

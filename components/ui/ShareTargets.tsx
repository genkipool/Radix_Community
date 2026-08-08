'use client';

/**
 * Send a link straight to WhatsApp or Telegram, plus a third target that hands
 * it to whatever the device can share with.
 *
 * WhatsApp and Telegram are plain share URLs opened in a new tab: no SDK, no
 * tracking script and no third-party code running on the page. On phones the OS
 * hands them to the installed app; on desktop they open the web client.
 *
 * The third one adapts. On a touch device it calls the Web Share API, so the
 * phone opens its own sheet and the user picks from every app they have
 * installed rather than from the two we thought to list. Everywhere else it
 * copies the link, which is what a pointer-driven browser can actually do.
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, MoreVertical, QrCode as QrIcon, Share2, X } from 'lucide-react';
import { useMounted } from '@/hooks/useMounted';
import { Portal } from '@/components/ui/Portal';
import { QrCode } from '@/components/ui/QrCode';
import { useAnchoredPosition } from '@/hooks/useAnchoredPosition';

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

const whatsappUrl = (url: string, text?: string) =>
  `https://wa.me/?text=${encodeURIComponent(text ? `${text} ${url}` : url)}`;

const telegramUrl = (url: string, text?: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}${
    text ? `&text=${encodeURIComponent(text)}` : ''
  }`;

/**
 * Whether this device shares through the system rather than the clipboard: it
 * has the Web Share API AND a coarse pointer, i.e. a finger. Resolved after
 * mount, never during render, so the server and the client agree on the first
 * paint.
 *
 * The pointer check is deliberate. Some desktop browsers expose `navigator.
 * share` too, and there a share sheet is a surprise where a copied link is the
 * expected outcome; on a phone it is the opposite.
 */
function useSystemShare(): boolean {
  const mounted = useMounted();
  return (
    mounted &&
    typeof navigator.share === 'function' &&
    window.matchMedia?.('(pointer: coarse)').matches === true
  );
}

/**
 * Hands the link to the system sheet, or to the clipboard. Reports which of
 * the two happened so the caller can confirm a copy (a share sheet needs no
 * confirmation: the user watched it open).
 */
async function shareOrCopy(
  url: string,
  text: string | undefined,
  useSystem: boolean,
): Promise<'shared' | 'copied' | 'failed'> {
  if (useSystem) {
    try {
      await navigator.share({ title: text, text, url });
      return 'shared';
    } catch {
      // Cancelled or refused: fall through to the clipboard rather than
      // leaving the button dead.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * The glyph of the third target names the act, not the intention: the share
 * mark when the device will open its own sheet, the clipboard when the link is
 * going to be copied, and the tick once it has been. A share mark on a button
 * that copies is a small lie, and the user finds out by pressing it.
 */
const ThirdIcon = ({
  copied,
  systemShare,
  className,
}: {
  copied: boolean;
  systemShare: boolean;
  className: string;
}) => {
  if (copied) return <Check className={className} />;
  return systemShare ? <Share2 className={className} /> : <Copy className={className} />;
};

/**
 * `inline` keeps the glyph the weight of the controls it sits beside. The card
 * sizes drop the box instead and let the glyph be the button: they go under a
 * validator's photo, in a column narrow enough that the padding was all that
 * stood between the three icons.
 */
const SIZES = {
  inline: { box: 'size-9', icon: 'size-4', row: 'gap-0.5' },
  /** Beside a button in a panel or a modal: no box, but real space between. */
  panel: { box: '', icon: 'size-5', row: 'gap-3' },
  /** The same row where a finger is doing the pressing: bigger, further apart. */
  touch: { box: '', icon: 'size-6', row: 'gap-4' },
  // Spread rather than spaced by a fixed gap: given the width of the photo
  // above them, the outer two icons line up with its edges and the gap is
  // whatever the width leaves over.
  cardSmall: { box: '', icon: 'size-4', row: 'w-full justify-between' },
  card: { box: '', icon: 'size-6', row: 'w-full justify-between' },
} as const;

export function ShareTargets({
  url,
  /** Optional line sent before the link (WhatsApp) or as its caption (Telegram). */
  text,
  /** Adds a third target: the system sheet on a phone, the clipboard elsewhere. */
  copyLabel,
  copiedLabel,
  /** What that third target is called when it opens the system sheet. */
  shareLabel,
  size = 'inline',
  className = '',
}: {
  url: string;
  text?: string;
  copyLabel?: string;
  copiedLabel?: string;
  shareLabel?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const systemShare = useSystemShare();

  if (!url) return null;

  const { box, icon, row } = SIZES[size];
  const style = `flex ${box} shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--color-text-muted)] opacity-60 transition-all hover:opacity-100 hover:text-[var(--color-primary)]`;
  const thirdLabel = (systemShare ? shareLabel : undefined) ?? copyLabel ?? '';

  const onShare = async () => {
    if ((await shareOrCopy(url, text, systemShare)) !== 'copied') return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex items-center ${row} ${className}`}>
      <a
        href={whatsappUrl(url, text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
        title="WhatsApp"
        className={style}
      >
        <WhatsappIcon className={icon} />
      </a>
      <a
        href={telegramUrl(url, text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Telegram"
        title="Telegram"
        className={style}
      >
        <TelegramIcon className={icon} />
      </a>
      {copyLabel && (
        <button
          type="button"
          onClick={onShare}
          aria-label={thirdLabel}
          title={copied ? (copiedLabel ?? thirdLabel) : thirdLabel}
          className={`${style} ${copied ? 'text-green-500 opacity-100' : ''}`}
        >
          <ThirdIcon copied={copied} systemShare={systemShare} className={icon} />
        </button>
      )}
    </div>
  );
}

/**
 * The same three targets behind a menu button, for cards with no room for a row
 * of them.
 *
 * The menu lists them as full rows — icon on the left, name on the right —
 * rather than as three bare glyphs. Bare glyphs are a fingertip apart on a
 * phone, where hitting the wrong one is the default outcome, and a name is also
 * the only thing that says what the third target will do on this device.
 *
 * Opening: hover with a mouse, tap with a finger, and closing on the next tap
 * outside for the finger, which has no pointer to leave with. Leaving the
 * button does not close it at once — the pointer may be on its way to the rows,
 * which cancels the timer when it arrives — so there is no dead gap to cross.
 *
 * It is drawn through a portal in coordinates worked out from the button (see
 * useAnchoredPosition): the cards it hangs off clip their own overflow, and a
 * menu that opens downward from a header would be cut in half by the bottom of
 * its own card. It opens upward instead whenever that is where the room is.
 */
export function ShareMenu({
  url,
  text,
  copyLabel,
  copiedLabel,
  shareLabel,
  qrLabel,
  qrHint,
  closeLabel,
  label,
  className = '',
}: {
  url: string;
  text?: string;
  copyLabel?: string;
  copiedLabel?: string;
  shareLabel?: string;
  /** Adds a row that shows the link as a QR for a phone to scan. */
  qrLabel?: string;
  /** Line under the QR saying what it is for. */
  qrHint?: string;
  closeLabel?: string;
  /** Accessible name of the button (and its tooltip). */
  label: string;
  className?: string;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const systemShare = useSystemShare();
  const menu = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rows are 48px on a phone and 40px on a desktop; the menu is sized for the
  // taller of the two, so a wrong guess only ever leaves it lower than needed
  // and never off the screen.
  const rowCount = 2 + (copyLabel ? 1 : 0) + (qrLabel ? 1 : 0);
  const {
    anchorRef,
    position,
    open,
    place,
    close: closeMenu,
  } = useAnchoredPosition({ width: 216, height: rowCount * 48 + 12 });

  // A tap opens the menu and there is no pointer to leave it with, so the next
  // one anywhere else closes it. Bound only while open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !anchorRef.current?.contains(target)) {
        closeMenu();
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, anchorRef, closeMenu]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (!url) return null;

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(closeMenu, 120);
  };

  const rowStyle =
    'flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold text-[var(--color-text-main)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] sm:rounded-lg sm:px-3 sm:py-2.5 sm:text-[13px]';
  const thirdLabel = (systemShare ? shareLabel : undefined) ?? copyLabel ?? '';

  const onShare = async () => {
    const outcome = await shareOrCopy(url, text, systemShare);
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    if (outcome !== 'copied') closeMenu();
  };

  return (
    <div className={className}>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onMouseEnter={() => {
          cancelClose();
          place();
        }}
        onMouseLeave={scheduleClose}
        onClick={() => (open ? closeMenu() : place())}
        onKeyDown={(e) => e.key === 'Escape' && closeMenu()}
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] sm:size-8 sm:rounded-lg ${
          open ? 'text-[var(--color-primary)]' : 'opacity-70'
        }`}
      >
        <MoreVertical className="size-6 sm:size-4" />
      </button>
      {open && position && (
        <Portal>
          <div
            ref={menu}
            role="menu"
            className="fixed z-[100] min-w-[216px] rounded-2xl border p-1.5 shadow-lg sm:min-w-[168px] sm:rounded-xl sm:p-1"
            style={{
              top: position.top,
              left: position.left,
              background: 'var(--color-card-bg, var(--color-surface))',
              borderColor: 'var(--color-card-border)',
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <a
              role="menuitem"
              href={whatsappUrl(url, text)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className={rowStyle}
            >
              <WhatsappIcon className="size-5 shrink-0 sm:size-4" />
              WhatsApp
            </a>
            <a
              role="menuitem"
              href={telegramUrl(url, text)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className={rowStyle}
            >
              <TelegramIcon className="size-5 shrink-0 sm:size-4" />
              Telegram
            </a>
            {copyLabel && (
              <button
                role="menuitem"
                type="button"
                onClick={onShare}
                className={`${rowStyle} ${copied ? 'text-green-500' : ''}`}
              >
                <ThirdIcon
                  copied={copied}
                  systemShare={systemShare}
                  className="size-5 shrink-0 sm:size-4"
                />
                {copied ? (copiedLabel ?? thirdLabel) : thirdLabel}
              </button>
            )}
            {qrLabel && (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setQrOpen(true);
                  closeMenu();
                }}
                className={rowStyle}
              >
                <QrIcon className="size-5 shrink-0 sm:size-4" />
                {qrLabel}
              </button>
            )}
          </div>
        </Portal>
      )}
      {qrOpen && qrLabel && (
        // Through a portal: the card that holds this menu clips its own
        // overflow, and a code meant to be read by a camera cannot be the one
        // thing on the page that gets cut off.
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setQrOpen(false)}
          >
            <div
              className="relative flex flex-col items-center gap-4 rounded-2xl border p-6 shadow-2xl"
              style={{
                background: 'var(--color-card-bg, var(--color-surface))',
                borderColor: 'var(--color-card-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                aria-label={closeLabel ?? 'Close'}
                title={closeLabel ?? 'Close'}
                className="absolute right-3 top-3 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-main)]"
              >
                <X className="size-4" />
              </button>
              {text && (
                <p
                  className="max-w-[240px] truncate text-sm font-bold"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  {text}
                </p>
              )}
              <QrCode value={url} alt={qrLabel} size={200} framed={false} />
              {qrHint && (
                <p
                  className="max-w-[240px] text-center text-[11px] leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {qrHint}
                </p>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

import { useMounted } from '@/hooks/useMounted';
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useLayout } from "@/context/LayoutContext";
import { Github, HeartHandshake } from "lucide-react";
import { FOOTER_LINKS, SOCIAL_LINKS } from "@/constants/navigation";
import { RadixLogo } from "@/components/shared/RadixLogo";

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.134l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M23.112 4.494c.318-1.55-1.205-2.837-2.68-2.267L2.342 9.216c-1.647.637-1.72 2.941-.117 3.682l3.94 1.818 1.873 6.559a1 1 0 0 0 1.67.432l2.886-2.887 4.044 3.033a2 2 0 0 0 3.159-1.198zM3.063 11.082l18.09-6.99-3.315 16.161L13.1 16.7a1 1 0 0 0-1.307.093l-1.236 1.236.371-2.043 7.28-7.279a1 1 0 0 0-1.204-1.575L6.95 12.876zm5.114 3.397.606 2.123.233-1.281a1 1 0 0 1 .277-.528l2.22-2.22z" fill="currentColor" />
  </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      d="M 8 17.929 l -1.143 2.286 c -1.456 -0.607 -2.963 -1.213 -4.566 -2.257 c -0.559 -0.364 -0.898 -0.983 -0.911 -1.65 c -0.07 -3.423 0.733 -6.865 2.767 -10.504 c 0.266 -0.476 0.71 -0.825 1.224 -1.008 C 6.598 4.36 7.431 4.023 8.857 3.786 l 0.857 1.571 s 0.857 -0.286 2.286 -0.286 s 2.286 0.286 2.286 0.286 l 0.857 -1.571 c 1.426 0.238 2.259 0.574 3.486 1.01 c 0.514 0.183 0.958 0.532 1.224 1.008 c 2.034 3.639 2.837 7.081 2.767 10.504 c -0.014 0.667 -0.352 1.286 -0.911 1.65 c -1.603 1.044 -3.11 1.651 -4.566 2.257 l -1.143 -2.286 m -9.714 -1.143 s 2.857 1.429 5.714 1.429 s 5.714 -1.429 5.714 -1.429"
    />
    <ellipse cx="8.429" cy="12.643" fill="currentColor" rx="1.857" ry="2.143" />
    <ellipse cx="15.571" cy="12.643" fill="currentColor" rx="1.857" ry="2.143" />
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="1" y="3" width="22" height="18" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
    <polygon points="10,8.5 15.5,12 10,15.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const iconMap = {
  X: <XIcon className="size-5" />,
  Github: <Github className="size-5" />,
  Discord: <DiscordIcon className="size-5" />,
  Telegram: <TelegramIcon className="size-5" />,
  Youtube: <YoutubeIcon className="size-5" />,
};

export default function Footer() {
  const { t, language } = useLanguage();
  const { setShowUnderConstruction, setShowInstitutionalPilot } = useLayout();
  const isMounted = useMounted();

  const localize = (href: string) => {
    if (href.startsWith('http') || href === '#' || href.startsWith('#')) return href;
    const path = href.startsWith('/') ? href : `/${href}`;
    return `/${language}${path === '/' ? '' : path}`;
  };

  const handleLinkClick = (e: React.MouseEvent, path: string) => {
    if (path === '#under-construction') {
      e.preventDefault();
      setShowUnderConstruction(true);
    } else if (path === '#pilot') {
      e.preventDefault();
      setShowInstitutionalPilot(true);
    }
  };

  return (
    <footer className="footer-premium pt-24 pb-12 border-t border-[var(--color-card-border)] relative overflow-hidden">
      {/* Dynamic background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent opacity-30" />
      <div className="absolute -top-24 left-1/4 size-96 bg-[var(--color-primary)]/5 blur-[80px] rounded-full pointer-events-none will-change-transform" />
      <div className="absolute -bottom-24 right-1/4 size-96 bg-[var(--color-accent)]/5 blur-[80px] rounded-full pointer-events-none will-change-transform" />

      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
          <div className="col-span-2 lg:col-span-2">
            <Link href={`/${language}`} aria-label="Home" className="flex items-center group cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 bg-[var(--color-primary)] blur-lg opacity-0 group-hover:opacity-20 transition-opacity" />
                <RadixLogo
                  className="relative"
                  label={t.svg?.radix ?? 'RADIX'}
                  betaLabel={t.svg?.beta ?? 'BETA'}
                />
              </div>
            </Link>
            <p className="text-[var(--color-text-muted)] max-w-sm mb-10 leading-relaxed text-[15px] font-medium opacity-80">
              {t.footer?.desc}
            </p>
            <div className="flex gap-5">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.icon}
                  href={link.href}
                  aria-label={link.icon}
                  title={link.icon}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="size-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors duration-300 shadow-sm"
                >
                  {iconMap[link.icon as keyof typeof iconMap]}
                </a>
              ))}
              <Link
                href="#donate"
                aria-label={t.community?.donate || 'Donate'}
                title={t.community?.donate || 'Donate'}
                onClick={(e) => handleLinkClick(e, '#under-construction')}
                className="size-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors duration-300 shadow-sm"
              >
                <HeartHandshake size={20} />
              </Link>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([sectionKey, links]) => {
            const section = (t.footer?.[sectionKey as keyof typeof t.footer] || {}) as { title?: string } & Record<string, string>;
            return (
              <div key={sectionKey} className="flex flex-col">
                <h3 className="text-[var(--color-text-main)] font-black mb-8 text-[11px] uppercase tracking-[0.2em] opacity-50">
                  {section?.title}
                </h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={link.key}>
                      <Link
                        href={localize(link.path)}
                        onClick={(e) => handleLinkClick(e, link.path)}
                        className="text-[var(--color-text-main)] hover:text-[var(--color-primary)] text-[14px] font-semibold transition-colors duration-200 flex items-center group/link"
                      >
                        <span className="opacity-70 group-hover/link:opacity-100 transition-opacity">{section?.[link.key]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[var(--color-card-border)] pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            {isMounted ? (
              <p className="text-[var(--color-text-muted)] text-[13px] font-medium opacity-60 italic">
                {t.footer?.copyright}
              </p>
            ) : (
              /* Reserve space to avoid layout shift */
              <div className="h-5 w-64" />
            )}
          </div>
          <div className="flex gap-8">
            <Link
              href="#under-construction"
              onClick={(e) => handleLinkClick(e, '#under-construction')}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] text-[13px] font-semibold transition-colors opacity-70 hover:opacity-100"
            >
              {t.footer?.privacy}
            </Link>
            <Link
              href="#under-construction"
              onClick={(e) => handleLinkClick(e, '#under-construction')}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] text-[13px] font-semibold transition-colors opacity-70 hover:opacity-100"
            >
              {t.footer?.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>

  );
}

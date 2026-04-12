import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useLayout } from "@/context/LayoutContext";
import { Twitter, Github, Linkedin, MessageCircle } from "lucide-react";
import { FOOTER_LINKS, SOCIAL_LINKS } from "@/constants/navigation";
import { RadixLogo } from "@/components/shared/RadixLogo";

export default function Footer() {
  const { t, language } = useLanguage();
  const { setShowUnderConstruction, setShowInstitutionalPilot } = useLayout();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const localize = (href: string) => {
    if (href.startsWith('http') || href === '#' || href.startsWith('#')) return href;
    const path = href.startsWith('/') ? href : `/${href}`;
    return `/${language}${path === '/' ? '' : path}`;
  };

  const iconMap = {
    Twitter: <Twitter className="w-5 h-5" />,
    Github: <Github className="w-5 h-5" />,
    Linkedin: <Linkedin className="w-5 h-5" />,
    MessageCircle: <MessageCircle className="w-5 h-5" />,
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
      <div className="absolute -top-24 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 blur-[80px] rounded-full pointer-events-none will-change-transform" />
      <div className="absolute -bottom-24 right-1/4 w-96 h-96 bg-[var(--color-accent)]/5 blur-[80px] rounded-full pointer-events-none will-change-transform" />

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
              {t.footer.desc}
            </p>
            <div className="flex gap-5">
              {SOCIAL_LINKS.map((link, index) => (
                <a
                  key={index}
                  href={link.href}
                  aria-label={link.icon}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors duration-300 shadow-sm"
                >
                  {iconMap[link.icon as keyof typeof iconMap]}
                </a>
              ))}
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([sectionKey, links]) => {
            const section = t.footer[sectionKey as keyof typeof t.footer] as { title?: string } & Record<string, string>;
            return (
              <div key={sectionKey} className="flex flex-col">
                <h3 className="text-[var(--color-text-main)] font-black mb-8 text-[11px] uppercase tracking-[0.2em] opacity-50">
                  {section.title}
                </h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={link.key}>
                      <Link
                        href={localize(link.path)}
                        onClick={(e) => handleLinkClick(e, link.path)}
                        className="text-[var(--color-text-main)] hover:text-[var(--color-primary)] text-[14px] font-semibold transition-colors duration-200 flex items-center group/link"
                      >
                        <span className="opacity-70 group-hover/link:opacity-100 transition-opacity">{section[link.key]}</span>
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
                {t.footer.copyright}
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
              {t.footer.privacy}
            </Link>
            <Link
              href="#under-construction"
              onClick={(e) => handleLinkClick(e, '#under-construction')}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] text-[13px] font-semibold transition-colors opacity-70 hover:opacity-100"
            >
              {t.footer.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>

  );
}

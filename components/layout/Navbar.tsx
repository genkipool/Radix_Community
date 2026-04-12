'use client';
import {
  Menu, X, Sun, Moon, Globe,
  Server, Layers, BarChart2, BookOpen, GraduationCap, Gamepad2,
  Smartphone, FileText, MessageSquare, Eye, Check, Route, Sparkles
} from 'lucide-react';
import { useState, useEffect, useTransition, useRef, ReactNode } from 'react';
import { useTheme, Theme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { setCookie } from '@/utils/cookies';
import { useLayout } from '@/context/LayoutContext';
import { NAV_LINKS } from '@/constants/navigation';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import NavPopup from '@/components/layout/NavPopup';
import { usePrefetchDashboard } from '@/features/dashboard/hooks/usePrefetchDashboard';
import { GoldPlatinumIcon } from '@/components/ui/GoldPlatinumIcon';
import { RadixCircleIcon } from '@/components/ui/RadixCircleIcon';
import { RadixLogo } from '@/components/shared/RadixLogo';

// ─── Types ──────────────────────────────────────────────────────────────────
interface PopupItem {
  key: string;
  href: string;
  icon: ReactNode;
  descKey: string;
  isHashLink?: boolean;
}

// ─── Nav popup items per section ────────────────────────────────────────────
const NAV_POPUP_ITEMS: Record<string, PopupItem[]> = {
  ecosystem: [
    { key: 'infrastructure', href: '/infrastructure', icon: <Server className="w-4 h-4" />, descKey: 'popup_eco_infra_desc' },
    { key: 'dapps', href: '/dapps', icon: <Layers className="w-4 h-4" />, descKey: 'popup_eco_dapps_desc' },
    { key: 'games', href: '/games', icon: <Gamepad2 className="w-4 h-4" />, descKey: 'popup_dev_games_desc' },
    { key: 'dashboard', href: '/dashboard', icon: <BarChart2 className="w-4 h-4" />, descKey: 'popup_eco_dashboard_desc' },
    { key: 'astrolescent', href: 'https://astrolescent.com/', icon: <Route className="w-4 h-4" />, descKey: 'popup_eco_astro_desc' },
  ],
  developers: [
    { key: 'doc', href: '/docs', icon: <BookOpen className="w-4 h-4" />, descKey: 'popup_dev_docs_desc' },
    { key: 'academy', href: '/academy', icon: <GraduationCap className="w-4 h-4" />, descKey: 'popup_dev_academy_desc' },
  ],
  wallet: [
    { key: 'wallet_ios', href: 'https://apps.apple.com/us/app/radix-wallet/id6448950995', icon: <Smartphone className="w-4 h-4" />, descKey: 'popup_wallet_ios_desc' },
    { key: 'wallet_android', href: 'https://play.google.com/store/apps/details?id=com.radixpublishing.radixwallet.android', icon: <Smartphone className="w-4 h-4" />, descKey: 'popup_wallet_android_desc' },
    { key: 'wallet_chrome', href: 'https://chrome.google.com/webstore/detail/radix-wallet-connector/bfeplaecgkoeckiidkgkmlllfbaeplgm', icon: <Globe className="w-4 h-4" />, descKey: 'popup_wallet_chrome_desc' },
    { key: 'radquest', href: 'https://radquest.io/home/basic', icon: <Sparkles className="w-4 h-4" />, descKey: 'popup_wallet_radquest_desc' },
    { key: 'gumball_club', href: 'https://gumball-club.radixdlt.com/', icon: <Gamepad2 className="w-4 h-4" />, descKey: 'popup_wallet_gumball_desc' },
  ],
  community: [
    { key: 'blog', href: '/blog', icon: <FileText className="w-4 h-4" />, descKey: 'popup_com_blog_desc' },
    { key: 'forum', href: '/forum', icon: <MessageSquare className="w-4 h-4" />, descKey: 'popup_com_forum_desc' },
    { key: 'community_transparency', href: '/community', icon: <Eye className="w-4 h-4" />, descKey: 'popup_com_transparency_desc' },
  ],
};

// ─── Theme configuration ─────────────────────────────────────────────────────
interface ThemeOption {
  key: Theme;
  labelKey: string;
  isDark: boolean;
  colors: { bg: string; text: string; accent: string; icon: string };
  preview: string[];
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    key: 'radix-light',
    labelKey: 'theme_radix_light',
    isDark: false,
    colors: {
      bg: 'var(--color-bg)',
      text: 'var(--color-text-main)',
      accent: 'var(--color-accent)',
      icon: 'var(--color-accent)'
    },
    preview: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)'],
  },
  {
    key: 'radix-dark',
    labelKey: 'theme_radix_dark',
    isDark: true,
    colors: {
      bg: 'var(--color-bg)',
      text: 'var(--color-text-main)',
      accent: 'var(--color-accent)',
      icon: 'var(--color-accent)'
    },
    preview: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)'],
  },
  {
    key: 'oro-light',
    labelKey: 'theme_gold_light',
    isDark: false,
    colors: {
      bg: 'var(--color-bg)',
      text: 'var(--color-text-main)',
      accent: 'var(--color-accent)',
      icon: 'var(--color-accent)'
    },
    preview: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)'],
  },
  {
    key: 'oro-dark',
    labelKey: 'theme_gold_dark',
    isDark: true,
    colors: {
      bg: 'var(--color-bg)',
      text: 'var(--color-text-main)',
      accent: 'var(--color-accent)',
      icon: 'var(--color-accent)'
    },
    preview: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)'],
  },
  {
    key: 'radix-original-light',
    labelKey: 'theme_radix_original_light',
    isDark: false,
    colors: {
      bg: 'var(--color-bg)',
      text: 'var(--color-text-main)',
      accent: 'var(--color-accent)',
      icon: 'var(--color-accent)'
    },
    preview: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)'],
  },
  {
    key: 'radix-original-dark',
    labelKey: 'theme_radix_original_dark',
    isDark: true,
    colors: {
      bg: 'var(--color-bg)',
      text: 'var(--color-text-main)',
      accent: 'var(--color-accent)',
      icon: 'var(--color-accent)'
    },
    preview: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)'],
  },
];

// ─── Language options ────────────────────────────────────────────────────────
const LANG_OPTIONS = [
  { code: 'es', label: 'Español', flag: '🇪🇸', region: 'ES' },
  { code: 'en', label: 'English', flag: '🇬🇧', region: 'EN' },
];

// ─── Shared: Theme card ───────────────────────────────────────────────────────
function ThemeCard({
  opt,
  isActive,
  onClick,
  nav,
}: {
  opt: ThemeOption;
  isActive: boolean;
  onClick: () => void;
  nav: Record<string, string>;
}) {
  return (
    <div className={opt.key}>
      <button
        onClick={onClick}
        className={[
          'relative flex flex-col gap-2.5 p-3 rounded-xl text-left transition-[transform,box-shadow] duration-150 cursor-pointer overflow-hidden w-full',
          isActive
            ? 'ring-2 ring-[var(--color-primary)] shadow-md'
            : 'hover:scale-[1.02] hover:shadow-md active:scale-95',
        ].join(' ')}
        style={{ backgroundColor: opt.colors.bg }}
      >
        {/* Mini preview window */}
        <div
          className="w-full h-10 rounded-lg overflow-hidden relative"
          style={{ background: `linear-gradient(135deg, ${opt.preview[0]}55, ${opt.preview[1]}44)` }}
        >
          <div className="absolute top-2 left-2 flex gap-1">
            {opt.preview.map((c, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="absolute bottom-1.5 left-2 right-2 h-1.5 rounded-full opacity-40" style={{ backgroundColor: opt.preview[0] }} />
        </div>

        {/* Label row */}
        <div className="flex items-center gap-1.5">
          {opt.key === 'oro-light' || opt.key === 'oro-dark' ? (
            <GoldPlatinumIcon className="w-3 h-3 flex-shrink-0" />
          ) : opt.key === 'radix-original-light' || opt.key === 'radix-original-dark' ? (
            <RadixCircleIcon className="w-3.5 h-3.5 flex-shrink-0" />
          ) : opt.isDark ? (
            <Moon className="w-3 h-3 flex-shrink-0" style={{ color: opt.colors.icon }} />
          ) : (
            <Sun className="w-3 h-3 flex-shrink-0" style={{ color: opt.colors.icon }} />
          )}
          <span className="text-[10px] font-bold leading-tight" style={{ color: opt.colors.text }}>
            {nav[opt.labelKey]}
          </span>
        </div>
      </button>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NavLinkList({
  items,
  t,
  onNavigate,
  onPrefetch,
  language,
}: {
  items: PopupItem[];
  t: ReturnType<typeof useLanguage>['t'];
  onNavigate?: () => void;
  onPrefetch?: (href: string) => void;
  language: string;
}) {
  const localize = (href: string) => {
    if (href.startsWith('http') || href === '#') return href;
    const path = href.startsWith('/') ? href : `/${href}`;
    return `/${language}${path === '/' ? '' : path}`;
  };

  return (
    <div className="p-2 flex flex-col gap-0.5">
      {items.map((item) => {
        const label = (t.nav as Record<string, string>)[item.key] ?? item.key;
        const desc = (t.nav as Record<string, string>)[item.descKey] ?? '';
        const href = localize(item.href);

        const inner = (
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--color-surface)] transition-colors group/item cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center flex-shrink-0 mt-0.5 text-[var(--color-accent)] group-hover/item:bg-[var(--color-accent)] group-hover/item:text-white group-hover/item:border-transparent transition-colors duration-150">
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-main)] leading-tight">{label}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-snug">{desc}</p>
            </div>
          </div>
        );

        if (item.href === '#' || item.isHashLink) {
          return (
            <Link
              key={item.key}
              href={href}
              onClick={(e) => {
                if (item.href.startsWith('#')) {
                  e.preventDefault();
                  const id = item.href.slice(1);
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                  history.replaceState(null, '', item.href);
                }
                onNavigate?.();
              }}
            >
              {inner}
            </Link>
          );
        }
        return (
          <Link
            key={item.key}
            href={href}
            onClick={onNavigate}
            onMouseEnter={() => onPrefetch?.(href)}
            onFocus={() => onPrefetch?.(href)}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

function ThemePopupContent({
  currentTheme,
  onSelect,
  t,
}: {
  currentTheme: Theme;
  onSelect: (t: Theme) => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const nav = t.nav as Record<string, string>;

  return (
    <div className="p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 px-1">
        {nav.theme_select}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((opt) => (
          <ThemeCard
            key={opt.key}
            opt={opt}
            isActive={currentTheme === opt.key}
            onClick={() => onSelect(opt.key)}
            nav={nav}
          />
        ))}
      </div>
    </div>
  );
}

function LanguagePopupContent({
  currentLang,
  onSwitch,
  t,
}: {
  currentLang: string;
  onSwitch: (lang: string) => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const nav = t.nav as Record<string, string>;
  return (
    <div className="p-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] px-3 py-1.5 mb-0.5">
        {nav.lang_select}
      </p>
      {LANG_OPTIONS.map(({ code, label, flag }) => {
        const isActive = currentLang === code;
        return (
          <button
            key={code}
            onClick={() => onSwitch(code)}
            className={[
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer',
              isActive
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-main)]',
            ].join(' ')}
          >
            <span className="text-lg leading-none">{flag}</span>
            <span className="flex-1 text-left">{label}</span>
            {isActive && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Mobile sub-link item ─────────────────────────────────────────────────────
function _MobileSubLink({
  item,
  language,
  onClose,
}: {
  item: PopupItem;
  language: string;
  onClose: () => void;
}) {
  const subHref = item.href.startsWith('/')
    ? `/${language}${item.href === '/' ? '' : item.href}`
    : item.href;

  const inner = (
    <div className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] border-l-2 border-[var(--color-card-border)] ml-1 rounded-r-lg hover:bg-[var(--color-surface)] transition-colors cursor-pointer">
      <span className="opacity-60">{item.icon}</span>
      {item.key}
    </div>
  );

  if (item.href === '#' || item.isHashLink) {
    return (
      <Link
        href={subHref}
        onClick={(e) => {
          if (item.href.startsWith('#')) {
            e.preventDefault();
            document.getElementById(item.href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
            history.replaceState(null, '', item.href);
          }
          onClose();
        }}
      >
        {inner}
      </Link>
    );
  }
  return <Link href={subHref} onClick={onClose}>{inner}</Link>;
}

// ─── Main Navbar ─────────────────────────────────────────────────────────────
export default function Navbar() {
  const { theaterMode, setShowUnderConstruction } = useLayout();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<'theme' | 'lang' | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme, setTheme } = useTheme();
  const { language, t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  // NOTE: useSearchParams() has been intentionally removed from this component.
  // It caused the entire Navbar to suspend on every hard-reload (especially
  // noticeable on the explorer view where the URL has search params like
  // ?view=transactions&network=mainnet), making the header content flash/disappear
  // until the params resolved. Both usages now read window.location.search
  // directly inside effects and event handlers, which are client-only and
  // therefore never run during SSR — no Suspense needed.
  const { prefetch: prefetchDashboard } = usePrefetchDashboard();
  const [optimisticLang, setOptimisticLang] = useState<string | null>(null);
  const [, startLangTransition] = useTransition();

  useEffect(() => { setOptimisticLang(null); }, [language]);

  // Prefetch the alternate language path so language switches feel instant.
  // Uses window.location.search instead of useSearchParams() to avoid Suspense.
  useEffect(() => {
    const altLang = language === 'en' ? 'es' : 'en';
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const altPath = (pathname.startsWith(`/${language}/`) || pathname === `/${language}`)
      ? pathname.replace(`/${language}`, `/${altLang}`) + search
      : `/${altLang}${search}`;
    router.prefetch(altPath);
  }, [language, pathname, router]);

  const handleHashClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const hash = href.includes('#') ? '#' + href.split('#')[1] : '';
    const id = hash.slice(1);
    const isHome = [`/${language}`, `/${language}/`].includes(pathname) || pathname === '/';
    if (isHome) {
      // Scroll to the section without triggering a Next.js navigation (avoids
      // double-transition flash). Then update the URL hash via history API so
      // the address bar reflects the current section and back/forward work.
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (hash) {
        history.replaceState(null, '', `/${language}${hash}`);
      }
    } else {
      router.push(`/${language}${hash}`);
    }
    setIsOpen(false);
  };

  const switchToLanguage = (targetLang: string) => {
    if (targetLang === language) return;
    setOptimisticLang(targetLang);
    setCookie('lang', targetLang);
    const timeout = setTimeout(() => { setOptimisticLang(null); }, 5000);
    // Read current search string directly — this handler only runs on user
    // interaction (client-side), so window is always available here.
    const search = window.location.search;
    try {
      const nextPath = (pathname.startsWith(`/${language}/`) || pathname === `/${language}`)
        ? pathname.replace(`/${language}`, `/${targetLang}`) + search
        : `/${targetLang}${search}`;
      startLangTransition(() => { router.replace(nextPath, { scroll: false }); });
    } catch { clearTimeout(timeout); setOptimisticLang(null); }
  };

  const cycleTheme = () => {
    const themes: Theme[] = ['radix-light', 'radix-dark', 'oro-light', 'oro-dark', 'radix-original-light', 'radix-original-dark'];
    setTheme(themes[(themes.indexOf(theme) + 1) % themes.length]);
  };

  const toggleLanguage = () => { switchToLanguage(language === 'en' ? 'es' : 'en'); };

  const currentLangDisplay = optimisticLang || language;
  const isLightTheme = theme === 'radix-light' || theme === 'oro-light' || theme === 'radix-original-light';

  const linkClass = 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors text-sm font-semibold py-6 block';
  const iconBtnClass = 'hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)] text-[var(--color-text-muted)] transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold';

  // Build localized href for a nav link
  const localizeNavHref = (path: string, isHashLink: boolean) =>
    isHashLink
      ? `/${language}${path.slice(1)}`
      : path.startsWith('/') ? `/${language}${path === '/' ? '' : path}` : path;

  // Collect internal hrefs from a popup group for prefetching
  const getPopupPrefetchHrefs = (items: PopupItem[], lang: string) =>
    items
      .filter((item) => !item.href.startsWith('http') && item.href !== '#')
      .map((item) => `/${lang}${item.href}`);

  const ThemeIcon = () => {
    if (theme === 'oro-light' || theme === 'oro-dark') return <GoldPlatinumIcon className="w-4 h-4" />;
    if (theme === 'radix-original-light' || theme === 'radix-original-dark') return <RadixCircleIcon className="w-[18px] h-[18px]" />;
    return isLightTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />;
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    // Check if we are already on the home page (with or without locale prefix)
    const isHome = pathname === `/${language}` || pathname === `/${language}/` || pathname === '/';
    if (isHome) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav
        className="fixed top-0 w-full z-50 bg-[var(--color-bg)]/95 border-b border-[var(--color-card-border)] transition-transform duration-300"
        style={{ transform: theaterMode ? 'translateY(-100%)' : 'translateY(0)', pointerEvents: theaterMode ? 'none' : undefined }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">

            <Link href={`/${language}`} aria-label="Home" className="flex-shrink-0" onClick={handleLogoClick}>
              <RadixLogo
                label={t.svg?.radix ?? 'RADIX'}
                betaLabel={t.svg?.beta ?? 'BETA'}
              />
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-stretch">
              {NAV_LINKS.map((link) => {
                const popupItems = NAV_POPUP_ITEMS[link.key];
                const label = (t.nav as Record<string, string>)[link.key] ?? link.key;
                const isHashLink = link.path.startsWith('/#');
                const linkHref = localizeNavHref(link.path, isHashLink);

                const triggerText = <span className={`${linkClass} px-3`}>{label}</span>;

                const trigger = isHashLink ? (
                  <Link href={linkHref} onClick={(e) => handleHashClick(e, linkHref)} className="block">
                    {triggerText}
                  </Link>
                ) : (
                  <Link href={linkHref} className="block">{triggerText}</Link>
                );

                if (!popupItems) return <div key={link.key}>{trigger}</div>;

                return (
                  <NavPopup
                    key={link.key}
                    trigger={trigger}
                    align="center"
                    width="w-72"
                    prefetchHrefs={getPopupPrefetchHrefs(popupItems, language)}
                  >
                    <NavLinkList
                      items={popupItems}
                      t={t}
                      language={language}
                      onPrefetch={(href) => {
                        if (href.includes('dashboard')) prefetchDashboard();
                      }}
                    />
                  </NavPopup>
                );
              })}
            </div>

            {/* Desktop controls */}
            <div className="hidden md:flex items-stretch gap-1">

              {/* Language: click = toggle, hover = popup */}
              <NavPopup align="right" width="w-44" keepOpenOnTriggerClick trigger={
                <button onClick={toggleLanguage} className={iconBtnClass} aria-label="Select language">
                  <Globe className="w-4 h-4" />
                  {currentLangDisplay.toUpperCase()}
                </button>
              }>
                <LanguagePopupContent currentLang={currentLangDisplay} onSwitch={switchToLanguage} t={t} />
              </NavPopup>

              {/* Theme: click = cycle, hover = popup */}
              <NavPopup align="right" width="w-[440px]" trigger={
                <button onClick={cycleTheme} className={iconBtnClass} aria-label="Select theme" suppressHydrationWarning>
                  <ThemeIcon />
                </button>
              }>
                <ThemePopupContent currentTheme={theme} onSelect={setTheme} t={t} />
              </NavPopup>

              {/* CTA */}
              <div className="self-center ml-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setShowUnderConstruction(true);
                  }}
                  aria-label={t.nav.connectWallet as string}
                  className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] h-[44px] rounded-full font-bold text-sm hover:opacity-90 transition-opacity shrink-0 px-4 shadow-sm"
                >
                  <RadixLogo
                    label={t.nav.connectWallet}
                    showBeta={false}
                    width="160"
                    height="32"
                    viewBox="0 0 210 40"
                    fontSize={18}
                    textX={32}
                    logoScale={0.38}
                    logoTranslateY={0}
                    strokeColor="white"
                    textColor="white"
                  />
                </button>
              </div>
            </div>

            {/* Mobile controls */}
            <div className="md:hidden flex items-center gap-1">
              <button
                onClick={toggleLanguage}
                onTouchStart={(e) => {
                  longPressRef.current = setTimeout(() => {
                    e.preventDefault();
                    setMobileSheet('lang');
                  }, 450);
                }}
                onTouchEnd={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
                onTouchMove={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
                className={`${iconBtnClass} px-2`} aria-label="Toggle language"
              >
                <Globe className="w-4 h-4" />
                {currentLangDisplay.toUpperCase()}
              </button>
              <button
                onClick={cycleTheme}
                onTouchStart={(e) => {
                  longPressRef.current = setTimeout(() => {
                    e.preventDefault();
                    setMobileSheet('theme');
                  }, 450);
                }}
                onTouchEnd={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
                onTouchMove={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
                className={`${iconBtnClass} px-2`} aria-label="Toggle theme" suppressHydrationWarning
              >
                <ThemeIcon />
              </button>
              <button onClick={() => setIsOpen(!isOpen)} className="text-[var(--color-text-main)] p-1 ml-1" aria-label={isOpen ? 'Close menu' : 'Open menu'}>
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="md:hidden bg-[var(--color-bg)] border-b border-[var(--color-card-border)] shadow-lg">
            <div className="px-4 py-3 space-y-0.5">
              {NAV_LINKS.map((link) => {
                const label = (t.nav as Record<string, string>)[link.key] ?? link.key;
                const popupItems = NAV_POPUP_ITEMS[link.key];
                const isHashLink = link.path.startsWith('/#');
                const linkHref = localizeNavHref(link.path, isHashLink);

                return (
                  <div key={link.key}>
                    <Link
                      href={linkHref}
                      className="block px-3 py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-accent)] rounded-lg hover:bg-[var(--color-surface)] transition-colors"
                      onClick={(e) => {
                        if (isHashLink) handleHashClick(e, linkHref);
                        else if (!popupItems) setIsOpen(false);
                      }}
                    >
                      {label}
                    </Link>
                    {popupItems && (
                      <div className="pl-4 mt-0.5 space-y-0.5 mb-1.5">
                        {popupItems.map((sub) => {
                          const subLabel = (t.nav as Record<string, string>)[sub.key] ?? sub.key;
                          const subHref = sub.href.startsWith('/')
                            ? `/${language}${sub.href === '/' ? '' : sub.href}`
                            : sub.href;

                          const inner = (
                            <div className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] border-l-2 border-[var(--color-card-border)] ml-1 rounded-r-lg hover:bg-[var(--color-surface)] transition-colors cursor-pointer">
                              <span className="opacity-60">{sub.icon}</span>
                              {subLabel}
                            </div>
                          );

                          if (sub.href === '#' || sub.isHashLink) {
                            return (
                              <Link
                                key={sub.key}
                                href={subHref}
                                onClick={(e) => {
                                  if (sub.href.startsWith('#')) {
                                    e.preventDefault();
                                    document.getElementById(sub.href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
                                    history.replaceState(null, '', sub.href);
                                  }
                                  setIsOpen(false);
                                }}
                              >
                                {inner}
                              </Link>
                            );
                          }
                          return <Link key={sub.key} href={subHref} onClick={() => setIsOpen(false)}>{inner}</Link>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="pt-3 pb-1">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setShowUnderConstruction(true);
                    setIsOpen(false);
                  }}
                  aria-label={t.nav.connectWallet as string}
                  className="flex items-center justify-center w-full h-12 text-sm font-bold bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl px-4"
                >
                  <RadixLogo
                    label={t.nav.connectWallet}
                    showBeta={false}
                    width="170"
                    height="32"
                    viewBox="0 0 210 40"
                    fontSize={18}
                    textX={36}
                    logoScale={0.36}
                    logoTranslateY={0}
                    strokeColor="white"
                    textColor="white"
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile bottom sheet — theme or language selector on long-press */}
      {mobileSheet && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-start md:hidden" onClick={() => setMobileSheet(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-3xl shadow-2xl mt-[20vh] mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--color-card-border)]" />
            </div>

            {mobileSheet === 'theme' && (
              <div className="px-4 pb-6 pt-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 px-1">
                  {(t.nav as Record<string, string>).theme_select}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {THEME_OPTIONS.map((opt) => (
                    <ThemeCard
                      key={opt.key}
                      opt={opt}
                      isActive={theme === opt.key}
                      onClick={() => { setTheme(opt.key); setMobileSheet(null); }}
                      nav={t.nav as Record<string, string>}
                    />
                  ))}
                </div>
              </div>
            )}

            {mobileSheet === 'lang' && (
              <div className="px-4 pb-6 pt-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1 px-1">
                  {(t.nav as Record<string, string>).lang_select}
                </p>
                {LANG_OPTIONS.map(({ code, label, flag }) => {
                  const isActive = currentLangDisplay === code;
                  return (
                    <button
                      key={code}
                      onClick={() => { switchToLanguage(code); setMobileSheet(null); }}
                      className={[
                        'w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-colors mb-1',
                        isActive
                          ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'text-[var(--color-text-muted)] active:bg-[var(--color-surface)]',
                      ].join(' ')}
                    >
                      <span className="text-2xl leading-none">{flag}</span>
                      <span className="flex-1 text-left text-base">{label}</span>
                      {isActive && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

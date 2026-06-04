'use client';
import {
  Menu, X, Sun, Moon, Globe,
  Server, Layers, BarChart2, BookOpen, GraduationCap, Gamepad2,
  Smartphone, FileText, MessageSquare, Eye, Check, Route, Sparkles,
  User, RefreshCcw, LogOut
} from 'lucide-react';
import { useEffect, useTransition, useRef, ReactNode, useReducer } from 'react';
import { useTheme, Theme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { UnderConstructionModal } from '@/components/shared/UnderConstructionModal';
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
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { WalletProfileModal } from '@/features/wallet/components/WalletProfileModal';
import type { Dictionary } from '@/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────
interface PopupItem {
  key: string;
  href: string;
  icon: ReactNode;
  descKey: string;
  isHashLink?: boolean;
}

// ─── ThemeIcon component ──────────────────────────────────────────────────
function ThemeIcon({ theme, isLightTheme }: { theme: Theme; isLightTheme: boolean }) {
    if (theme === 'oro-light' || theme === 'oro-dark') return <GoldPlatinumIcon className="size-4" />;
    if (theme === 'radix-original-light' || theme === 'radix-original-dark') return <RadixCircleIcon className="size-[18px]" />;
    return isLightTheme ? <Sun className="size-4" /> : <Moon className="size-4" />;
}

// ─── Nav popup items per section ────────────────────────────────────────────
const NAV_POPUP_ITEMS: Record<string, PopupItem[]> = {
  ecosystem: [
    { key: 'infrastructure', href: '/infrastructure', icon: <Server className="size-4" />, descKey: 'popup_eco_infra_desc' },
    { key: 'dapps', href: '/dapps', icon: <Layers className="size-4" />, descKey: 'popup_eco_dapps_desc' },
    { key: 'games', href: '/games', icon: <Gamepad2 className="size-4" />, descKey: 'popup_dev_games_desc' },
    { key: 'dashboard', href: '/dashboard', icon: <BarChart2 className="size-4" />, descKey: 'popup_eco_dashboard_desc' },
    { key: 'astrolescent', href: 'https://astrolescent.com/', icon: <Route className="size-4" />, descKey: 'popup_eco_astro_desc' },
  ],
  developers: [
    { key: 'doc', href: '/docs', icon: <BookOpen className="size-4" />, descKey: 'popup_dev_docs_desc' },
    { key: 'academy', href: '/academy', icon: <GraduationCap className="size-4" />, descKey: 'popup_dev_academy_desc' },
  ],
  wallet: [
    { key: 'wallet_ios', href: 'https://apps.apple.com/us/app/radix-wallet/id6448950995', icon: <Smartphone className="size-4" />, descKey: 'popup_wallet_ios_desc' },
    { key: 'wallet_android', href: 'https://play.google.com/store/apps/details?id=com.radixpublishing.radixwallet.android', icon: <Smartphone className="size-4" />, descKey: 'popup_wallet_android_desc' },
    { key: 'wallet_chrome', href: 'https://chrome.google.com/webstore/detail/radix-wallet-connector/bfeplaecgkoeckiidkgkmlllfbaeplgm', icon: <Globe className="size-4" />, descKey: 'popup_wallet_chrome_desc' },
    { key: 'radquest', href: 'https://radquest.io/home/basic', icon: <Sparkles className="size-4" />, descKey: 'popup_wallet_radquest_desc' },
    { key: 'gumball_club', href: 'https://gumball-club.radixdlt.com/', icon: <Gamepad2 className="size-4" />, descKey: 'popup_wallet_gumball_desc' },
  ],
  community: [
    { key: 'blog', href: '/blog', icon: <FileText className="size-4" />, descKey: 'popup_com_blog_desc' },
    { key: 'forum', href: '/forum', icon: <MessageSquare className="size-4" />, descKey: 'popup_com_forum_desc' },
    { key: 'community_transparency', href: '/community', icon: <Eye className="size-4" />, descKey: 'popup_com_transparency_desc' },
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
        type="button"
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
              <div key={i} className="size-2.5 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="absolute bottom-1.5 left-2 right-2 h-1.5 rounded-full opacity-40" style={{ backgroundColor: opt.preview[0] }} />
        </div>

        {/* Label row */}
        <div className="flex items-center gap-1.5">
          {opt.key === 'oro-light' || opt.key === 'oro-dark' ? (
            <GoldPlatinumIcon className="size-3 flex-shrink-0" />
          ) : opt.key === 'radix-original-light' || opt.key === 'radix-original-dark' ? (
            <RadixCircleIcon className="size-3.5 flex-shrink-0" />
          ) : opt.isDark ? (
            <Moon className="size-3 flex-shrink-0" style={{ color: opt.colors.icon }} />
          ) : (
            <Sun className="size-3 flex-shrink-0" style={{ color: opt.colors.icon }} />
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
            <div className="size-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center flex-shrink-0 mt-0.5 text-[var(--color-accent)] group-hover/item:bg-[var(--color-accent)] group-hover/item:text-white group-hover/item:border-transparent transition-colors duration-150">
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
            type="button"
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
            {isActive && <Check className="size-3.5 flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function WalletPopupContent({
  connect,
  t,
  sessions,
  switchNetwork,
  isLoading,
  disconnect
}: {
  connect: (networkId: RadixNetworkId) => void,
  t: Dictionary,
  sessions: Record<'mainnet' | 'stokenet', unknown>,
  switchNetwork: (network: 'mainnet' | 'stokenet') => void,
  isLoading: boolean,
  disconnect: () => void
}) {
  const onNetworkClick = (netName: 'mainnet' | 'stokenet', netId: RadixNetworkId) => {
    if (sessions[netName]) {
      switchNetwork(netName);
    } else {
      connect(netId);
    }
  };

  return (
    <div className="p-4 w-[280px]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 px-1">
        {t.nav?.wallet_select_network ?? 'Select Network'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onNetworkClick('mainnet', RadixNetworkId.Mainnet)}
          className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl hover:bg-[var(--color-surface)] active:scale-95 transition-all cursor-pointer border border-[var(--color-card-border)] hover:border-[var(--color-accent)] group"
          disabled={isLoading}
        >
          <Globe className="size-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-text-main)]">{t.nav?.wallet_mainnet ?? 'Mainnet'}</span>
        </button>
        <button
          type="button"
          onClick={() => onNetworkClick('stokenet', RadixNetworkId.Stokenet)}
          className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl hover:bg-[var(--color-surface)] active:scale-95 transition-all cursor-pointer border border-[var(--color-card-border)] hover:border-[var(--color-accent)] group"
          disabled={isLoading}
        >
          <Server className="size-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-text-main)]">{t.nav?.wallet_stokenet ?? 'Stokenet'}</span>
        </button>
      </div>
      {isLoading && (
        <button
          type="button"
          onClick={() => disconnect()}
          className="mt-4 w-full py-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:text-red-500 transition-colors text-center"
        >
          {t.nav?.wallet_cancel_connection ?? 'Cancelar conexión'}
        </button>
      )}
    </div>
  );
}

interface ConnectedWalletPopupContentProps {
  t: Dictionary;
  activeNetwork: 'mainnet' | 'stokenet';
  personaName?: string;
  onOpenProfileModal: () => void;
  onOpenUnderConstruction?: () => void;
  networkId: RadixNetworkId | null;
  connect: (networkId: RadixNetworkId) => void;
  disconnect: () => void;
  sessions: Record<'mainnet' | 'stokenet', unknown>;
  switchNetwork: (network: 'mainnet' | 'stokenet') => void;
}

function ConnectedWalletPopupContent({
  t,
  activeNetwork,
  personaName,
  onOpenProfileModal,
  onOpenUnderConstruction,
  networkId,
  connect,
  disconnect,
  sessions,
  switchNetwork
}: ConnectedWalletPopupContentProps) {
  const onNetworkClick = (netName: 'mainnet' | 'stokenet', netId: RadixNetworkId) => {
    if (sessions[netName]) {
      switchNetwork(netName);
    } else {
      connect(netId);
    }
  };
  return (
    <div className="p-4 w-[280px]">
      {/* Network Tabs Header */}
      <div className="flex items-center justify-around mb-4 border-b border-[var(--color-card-border)]/50">
        <button
          type="button"
          onClick={() => onNetworkClick('mainnet', RadixNetworkId.Mainnet)}
          className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors relative ${activeNetwork === 'mainnet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
        >
          {t.nav?.wallet_mainnet ?? 'Mainnet'}
          {activeNetwork === 'mainnet' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full" />}
        </button>
        <button
          type="button"
          onClick={() => onNetworkClick('stokenet', RadixNetworkId.Stokenet)}
          className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors relative ${activeNetwork === 'stokenet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
        >
          {t.nav?.wallet_stokenet ?? 'Stokenet'}
          {activeNetwork === 'stokenet' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full" />}
        </button>
        <button
          type="button"
          onClick={onOpenProfileModal}
          className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors relative text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]`}
        >
          {((t.nav || {}) as Record<string, string>).profile ?? 'Perfil'}
        </button>
      </div>

      {/* Row 1: Photo and Name (Clickable) */}
      <button
        type="button"
        onClick={() => onOpenUnderConstruction?.()}
        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface)] transition-colors text-left mb-4 group border border-transparent hover:border-[var(--color-card-border)]"
      >
        <div className="size-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] p-0.5 shrink-0">
          <div className="w-full h-full bg-[var(--color-surface)] rounded-full flex items-center justify-center overflow-hidden">
            <User className="size-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--color-text-main)] truncate group-hover:text-[var(--color-primary)] transition-colors">
            {personaName || t.nav?.wallet_connected || 'Persona'}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] truncate">
            {((t.nav || {}) as Record<string, string>).view_profile ?? 'Ver perfil completo'}
          </p>
        </div>
      </button>

      {/* Row 2: Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => networkId && connect(networkId)}
          className="flex items-center justify-center gap-1.5 p-2 text-xs font-bold text-[var(--color-text-main)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-xl transition-colors"
        >
          <RefreshCcw className="size-3.5 text-[var(--color-text-muted)]" />
          <span className="truncate">{((t.nav || {}) as Record<string, string>).update_wallet ?? 'Actualizar'}</span>
        </button>
        <button
          type="button"
          onClick={() => disconnect()}
          className="flex items-center justify-center gap-1.5 p-2 text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
        >
          <LogOut className="size-3.5" />
          <span className="truncate">{t.nav?.wallet_disconnect ?? 'Desconectar'}</span>
        </button>
      </div>
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
    <div className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] border-l border-[var(--color-card-border)] ml-1 rounded-r-lg hover:bg-[var(--color-surface)] transition-colors cursor-pointer">
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

// ─── UI State Reducer ──────────────────────────────────────────────
type UiState = {
  isOpen: boolean;
  isWalletProfileModalOpen: boolean;
  isUnderConstructionModalOpen: boolean;
  mobileSheet: 'theme' | 'lang' | null;
  optimisticLang: string | null;
};

type UiAction =
  | { type: 'TOGGLE_MENU' }
  | { type: 'SET_MENU'; value: boolean }
  | { type: 'SET_PROFILE_MODAL'; value: boolean }
  | { type: 'SET_UNDER_CONSTRUCTION_MODAL'; value: boolean }
  | { type: 'SET_MOBILE_SHEET'; value: 'theme' | 'lang' | null }
  | { type: 'SET_OPTIMISTIC_LANG'; value: string | null };

function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'TOGGLE_MENU': return { ...state, isOpen: !state.isOpen };
    case 'SET_MENU': return { ...state, isOpen: action.value };
    case 'SET_PROFILE_MODAL': return { ...state, isWalletProfileModalOpen: action.value };
    case 'SET_UNDER_CONSTRUCTION_MODAL': return { ...state, isUnderConstructionModalOpen: action.value };
    case 'SET_MOBILE_SHEET': return { ...state, mobileSheet: action.value };
    case 'SET_OPTIMISTIC_LANG': return { ...state, optimisticLang: action.value };
    default: return state;
  }
}

const INITIAL_UI: UiState = {
  isOpen: false,
  isWalletProfileModalOpen: false,
  isUnderConstructionModalOpen: false,
  mobileSheet: null,
  optimisticLang: null,
};

export default function Navbar() {
  const { theaterMode } = useLayout();
  const { isConnected, isLoading, persona, accounts, connect, disconnect, activeNetworkId: networkId, sessions, activeNetwork, switchNetwork } = useRadixWallet();
  const [ui, dispatch] = useReducer(uiReducer, INITIAL_UI);
  const { isOpen, isWalletProfileModalOpen, isUnderConstructionModalOpen, mobileSheet, optimisticLang } = ui;
  const setIsOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === 'function') {
      dispatch({ type: 'TOGGLE_MENU' });
    } else {
      dispatch({ type: 'SET_MENU', value });
    }
  };
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme, setTheme } = useTheme();
  const { language, t } = useLanguage();
  const pathname = usePathname();
  const { prefetch, push, replace } = useRouter();
  // NOTE: useSearchParams() has been intentionally removed from this component.
  // It caused the entire Navbar to suspend on every hard-reload (especially
  // noticeable on the explorer view where the URL has search params like
  // ?view=transactions&network=mainnet), making the header content flash/disappear
  // until the params resolved. Both usages now read window.location.search
  // directly inside effects and event handlers, which are client-only and
  // therefore never run during SSR — no Suspense needed.
  const { prefetch: prefetchDashboard } = usePrefetchDashboard();
  const [, startLangTransition] = useTransition();

  const prevLanguageRef = useRef(language);
  useEffect(() => {
    if (language !== prevLanguageRef.current) {
      prevLanguageRef.current = language;
      dispatch({ type: 'SET_OPTIMISTIC_LANG', value: null });
    }
  }, [language]);

  // Prefetch the alternate language path so language switches feel instant.
  // Uses window.location.search instead of useSearchParams() to avoid Suspense.
  useEffect(() => {
    const altLang = language === 'en' ? 'es' : 'en';
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const altPath = (pathname.startsWith(`/${language}/`) || pathname === `/${language}`)
      ? pathname.replace(`/${language}`, `/${altLang}`) + search
      : `/${altLang}${search}`;
    prefetch(altPath);
  }, [language, pathname, prefetch]);

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
      push(`/${language}${hash}`);
    }
    setIsOpen(false);
  };

  const switchToLanguage = (targetLang: string) => {
    if (targetLang === language) return;
    dispatch({ type: 'SET_OPTIMISTIC_LANG', value: targetLang });
    setCookie('lang', targetLang);
    const timeout = setTimeout(() => { dispatch({ type: 'SET_OPTIMISTIC_LANG', value: null }); }, 5000);
    // Read current search string directly — this handler only runs on user
    // interaction (client-side), so window is always available here.
    const search = window.location.search;
    try {
      const nextPath = (pathname.startsWith(`/${language}/`) || pathname === `/${language}`)
        ? pathname.replace(`/${language}`, `/${targetLang}`) + search
        : `/${targetLang}${search}`;
      startLangTransition(() => { replace(nextPath, { scroll: false }); });
    } catch { clearTimeout(timeout); dispatch({ type: 'SET_OPTIMISTIC_LANG', value: null }); }
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
    items.flatMap((item) =>
      item.href.startsWith('http') || item.href === '#' ? [] : [`/${lang}${item.href}`]
    );

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
        className="fixed top-0 w-full z-50 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-card-border)] transition-transform duration-300"
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
                const popupItems = NAV_POPUP_ITEMS[link.key]?.map(item => 
                  item.key === 'dashboard' && activeNetwork === 'stokenet'
                    ? { ...item, href: '/dashboard?network=stokenet' }
                    : item
                );
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
              <NavPopup align="right" width="w-44" keepOpenOnTriggerClick offsetClass="absolute top-[calc(100%+4px)]" trigger={
                <button type="button" onClick={toggleLanguage} className={iconBtnClass} aria-label="Select language">
                  <Globe className="size-4" />
                  {currentLangDisplay.toUpperCase()}
                </button>
              }>
                <LanguagePopupContent currentLang={currentLangDisplay} onSwitch={switchToLanguage} t={t} />
              </NavPopup>

              {/* Theme: click = cycle, hover = popup */}
              <NavPopup align="right" width="w-[440px]" offsetClass="absolute top-[calc(100%+4px)]" trigger={
                <button type="button" onClick={cycleTheme} className={iconBtnClass} aria-label="Select theme" suppressHydrationWarning>
                  <ThemeIcon theme={theme} isLightTheme={isLightTheme} />
                </button>
              }>
                <ThemePopupContent currentTheme={theme} onSelect={setTheme} t={t} />
              </NavPopup>

              {/* Desktop CTA */}
              <div className="self-center ml-2">
                {isConnected ? (
                  <NavPopup
                    align="right"
                    width="w-auto"
                    offsetClass="absolute top-full"
                    trigger={
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'SET_PROFILE_MODAL', value: true })}
                        aria-label="Wallet Settings"
                        className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] h-[44px] rounded-full font-bold text-sm hover:opacity-90 transition-opacity shrink-0 px-4 shadow-sm"
                      >
                        <RadixLogo
                          label={
                            isLoading
                              ? (t.nav?.wallet_connecting as string ?? 'Connecting...')
                              : persona
                                ? (persona.label.length > 12 ? `${persona.label.slice(0, 10)}...` : persona.label)
                                : accounts.length > 0
                                  ? `${accounts[0].address.slice(0, 4)}...${accounts[0].address.slice(-4)}`
                                  : (t.nav?.connectWallet as string)
                          }
                          showBeta={false}
                          width="160"
                          height="32"
                          viewBox="0 0 210 40"
                          fontSize={18}
                          textX={122}
                          textAnchor="middle"
                          logoScale={0.12}
                          logoTranslateY={8}
                          logoTranslateX={5}
                          strokeColor="white"
                          textColor="white"
                          className={isLoading ? "animate-pulse" : ""}
                        />
                      </button>
                    }
                  >
                    <ConnectedWalletPopupContent
                      disconnect={disconnect}
                      connect={connect}
                      networkId={networkId}
                      personaName={persona?.label}
                      t={t}
                      onOpenProfileModal={() => dispatch({ type: 'SET_PROFILE_MODAL', value: true })}
                      onOpenUnderConstruction={() => dispatch({ type: 'SET_UNDER_CONSTRUCTION_MODAL', value: true })}
                      sessions={sessions}
                      activeNetwork={activeNetwork}
                      switchNetwork={switchNetwork}
                    />
                  </NavPopup>
                ) : (
                  <NavPopup
                    align="right"
                    width="w-auto"
                    offsetClass="absolute top-full"
                    trigger={
                      <button
                        type="button"
                        onClick={() => {
                          if (sessions['mainnet']) {
                            switchNetwork('mainnet');
                          } else {
                            connect(RadixNetworkId.Mainnet);
                          }
                        }}
                        aria-label={t.nav.connectWallet as string}
                        className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] h-[44px] rounded-full font-bold text-sm hover:opacity-90 transition-opacity shrink-0 px-4 shadow-sm"
                      >
                        <RadixLogo
                          label={isLoading ? (t.nav?.wallet_connecting as string ?? 'Connecting...') : (t.nav?.connectWallet as string)}
                          showBeta={false}
                          width="160"
                          height="32"
                          viewBox="0 0 210 40"
                          fontSize={18}
                          textX={122}
                          textAnchor="middle"
                          logoScale={0.12}
                          logoTranslateY={8}
                          logoTranslateX={5}
                          strokeColor="white"
                          textColor="white"
                          className={isLoading ? "animate-pulse" : ""}
                        />
                      </button>
                    }
                  >
                    <WalletPopupContent connect={connect} t={t} sessions={sessions} switchNetwork={switchNetwork} isLoading={isLoading} disconnect={disconnect} />
                  </NavPopup>
                )}
              </div>
            </div>

            {/* Mobile controls */}
            <div className="md:hidden flex items-center gap-1">
              <button
                type="button"
                onClick={toggleLanguage}
                onTouchStart={(e) => {
                  longPressRef.current = setTimeout(() => {
                    e.preventDefault();
                    dispatch({ type: 'SET_MOBILE_SHEET', value: 'lang' });
                  }, 450);
                }}
                onTouchEnd={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
                onTouchMove={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
                className={`${iconBtnClass} px-2`} aria-label="Toggle language"
              >
                <Globe className="size-4" />
                {currentLangDisplay.toUpperCase()}
              </button>
              <button
                type="button"
                onClick={cycleTheme}
                onTouchStart={(e) => {
                  longPressRef.current = setTimeout(() => {
                    e.preventDefault();
                    dispatch({ type: 'SET_MOBILE_SHEET', value: 'theme' });
                  }, 450);
                }}
                onTouchEnd={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
                onTouchMove={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
                className={`${iconBtnClass} px-2`} aria-label="Toggle theme" suppressHydrationWarning
              >
                <ThemeIcon theme={theme} isLightTheme={isLightTheme} />
              </button>
              {isConnected ? (
                <NavPopup
                  align="right"
                  width="w-[280px]"
                  offsetClass="absolute top-[60px]"
                  trigger={
                    <button
                      type="button"
                      aria-label="Wallet Settings"
                      className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] size-[30px] rounded-full text-white font-bold text-sm hover:opacity-90 transition-opacity shrink-0 shadow-sm ml-2"
                    >
                      {persona?.label ? persona.label.charAt(0).toUpperCase() : (accounts.length > 0 ? accounts[0].address.charAt(0).toUpperCase() : '?')}
                    </button>
                  }
                >
                  <ConnectedWalletPopupContent
                    disconnect={disconnect}
                    connect={connect}
                    networkId={networkId}
                    personaName={persona?.label}
                    t={t}
                    onOpenProfileModal={() => dispatch({ type: 'SET_PROFILE_MODAL', value: true })}
                    onOpenUnderConstruction={() => dispatch({ type: 'SET_UNDER_CONSTRUCTION_MODAL', value: true })}
                    sessions={sessions}
                    activeNetwork={activeNetwork}
                    switchNetwork={switchNetwork}
                  />
                </NavPopup>
              ) : (
                <NavPopup
                  align="right"
                  width="w-[280px]"
                  offsetClass="absolute top-[60px]"
                  trigger={
                    <button
                      type="button"
                      aria-label="Connect Wallet"
                      className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] size-[30px] rounded-full hover:opacity-90 transition-opacity shrink-0 shadow-sm ml-2"
                    >
                      <RadixCircleIcon className="size-[30px]" fillColor="transparent" strokeColor="white" />
                    </button>
                  }
                >
                  <WalletPopupContent connect={connect} t={t} sessions={sessions} switchNetwork={switchNetwork} isLoading={isLoading} disconnect={disconnect} />
                </NavPopup>
              )}
              <button type="button" onClick={() => setIsOpen(!isOpen)} className="text-[var(--color-text-main)] p-1 ml-2" aria-label={isOpen ? 'Close menu' : 'Open menu'}>
                {isOpen ? <X className="size-6" /> : <Menu className="size-6" />}
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
                const popupItems = NAV_POPUP_ITEMS[link.key]?.map(item => 
                  item.key === 'dashboard' && activeNetwork === 'stokenet'
                    ? { ...item, href: '/dashboard?network=stokenet' }
                    : item
                );
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
                            <div className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] border-l border-[var(--color-card-border)] ml-1 rounded-r-lg hover:bg-[var(--color-surface)] transition-colors cursor-pointer">
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
              <div className="pt-3 pb-1 flex justify-center">
                {isConnected ? (
                  <NavPopup
                    align="center"
                    width="w-[280px]"
                    offsetClass="absolute bottom-[calc(100%+8px)]"
                    trigger={
                    <button
                      type="button"
                      aria-label="Wallet Settings"
                      className="flex items-center justify-center w-full min-w-[200px] h-12 text-sm font-bold bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl px-4 shadow-sm"
                    >
                        <RadixLogo
                          label={
                            isLoading
                              ? (t.nav?.wallet_connecting as string ?? 'Connecting...')
                              : persona
                                ? (persona.label.length > 12 ? `${persona.label.slice(0, 10)}...` : persona.label)
                                : accounts.length > 0
                                  ? `${accounts[0].address.slice(0, 4)}...${accounts[0].address.slice(-4)}`
                                  : (t.nav?.connectWallet as string)
                          }
                          showBeta={false}
                          width="170"
                          height="32"
                          viewBox="0 0 210 40"
                          fontSize={18}
                          textX={122}
                          textAnchor="middle"
                          logoScale={0.12}
                          logoTranslateY={8}
                          logoTranslateX={10}
                          strokeColor="white"
                          textColor="white"
                          className={isLoading ? "animate-pulse" : ""}
                        />
                      </button>
                    }
                  >
                    <ConnectedWalletPopupContent
                      disconnect={() => { disconnect(); setIsOpen(false); }}
                      connect={(netId) => { connect(netId); setIsOpen(false); }}
                      networkId={networkId}
                      personaName={persona?.label}
                      t={t}
                      onOpenProfileModal={() => {
                        setIsOpen(false);
                        dispatch({ type: 'SET_PROFILE_MODAL', value: true });
                      }}
                      onOpenUnderConstruction={() => {
                        setIsOpen(false);
                        dispatch({ type: 'SET_UNDER_CONSTRUCTION_MODAL', value: true });
                      }}
                      sessions={sessions}
                      activeNetwork={activeNetwork}
                      switchNetwork={switchNetwork}
                    />
                  </NavPopup>
                ) : (
                  <NavPopup
                    align="center"
                    width="w-[280px]"
                    offsetClass="absolute bottom-[calc(100%+8px)]"
                    trigger={
                      <button
                        type="button"
                        aria-label={t.nav.connectWallet as string}
                        className="flex items-center justify-center w-full min-w-[200px] h-12 text-sm font-bold bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl px-4 shadow-sm"
                      >
                        <RadixLogo
                          label={isLoading ? (t.nav?.wallet_connecting as string ?? 'Connecting...') : (t.nav?.connectWallet as string)}
                          showBeta={false}
                          width="170"
                          height="32"
                          viewBox="0 0 210 40"
                          fontSize={18}
                          textX={122}
                          textAnchor="middle"
                          logoScale={0.12}
                          logoTranslateY={8}
                          logoTranslateX={10}
                          strokeColor="white"
                          textColor="white"
                          className={isLoading ? "animate-pulse" : ""}
                        />
                      </button>
                    }
                  >
                    <WalletPopupContent
                      connect={(netId) => { connect(netId); setIsOpen(false); }}
                      t={t}
                      sessions={sessions}
                      switchNetwork={switchNetwork}
                      isLoading={isLoading}
                      disconnect={disconnect}
                    />
                  </NavPopup>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <WalletProfileModal
        isOpen={isWalletProfileModalOpen}
        onClose={() => dispatch({ type: 'SET_PROFILE_MODAL', value: false })}
        t={t}
        locale={language}
      />

      <UnderConstructionModal
        isOpen={isUnderConstructionModalOpen}
        onClose={() => dispatch({ type: 'SET_UNDER_CONSTRUCTION_MODAL', value: false })}
        t={t}
      />

      {/* Mobile bottom sheet — theme or language selector on long-press */}
      {mobileSheet && (
        <button type="button" aria-label="Close" className="fixed inset-0 z-[100] flex flex-col justify-start md:hidden w-full text-left" onClick={() => dispatch({ type: 'SET_MOBILE_SHEET', value: null })}>
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
                      onClick={() => { setTheme(opt.key); dispatch({ type: 'SET_MOBILE_SHEET', value: null }); }}
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
                      type="button"
                      key={code}
                      onClick={() => { switchToLanguage(code); dispatch({ type: 'SET_MOBILE_SHEET', value: null }); }}
                      className={[
                        'w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-colors mb-1',
                        isActive
                          ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'text-[var(--color-text-muted)] active:bg-[var(--color-surface)]',
                      ].join(' ')}
                    >
                      <span className="text-2xl leading-none">{flag}</span>
                      <span className="flex-1 text-left text-base">{label}</span>
                      {isActive && <Check className="size-4 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </button>
      )}
    </>
  );
}

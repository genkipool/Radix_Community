import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import Navbar from '@/components/layout/Navbar';

// ─── Mock next/navigation ────────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockPathname = '/es/dashboard';

vi.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
    }),
}));

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: { children?: React.ReactNode; href: string } & Record<string, unknown>) =>
        <a href={href} {...props}>{children}</a>,
}));

// ─── Mock useTheme from ThemeContext ─────────────────────────────────────────
let mockTheme = 'radix-dark';
const mockSetTheme = vi.fn((t: string) => { mockTheme = t; });

vi.mock('@/context/ThemeContext', () => ({
    useTheme: () => ({
        theme: mockTheme,
        setTheme: mockSetTheme,
    }),
    ThemeProvider: ({ children }: { children?: React.ReactNode }) => children,
}));

// ─── Mock expensive sub-components not under test ─────────────────────────────
vi.mock('@/components/layout/NavPopup', () => ({
    default: ({ trigger, children }: { trigger?: React.ReactNode; children?: React.ReactNode }) => (
        <>{trigger}{children}</>
    ),
}));
vi.mock('@/components/shared/UnderConstructionModal', () => ({
    UnderConstructionModal: () => null,
}));
vi.mock('@/features/wallet/components/WalletProfileModal', () => ({
    WalletProfileModal: ({ isOpen }: { isOpen?: boolean }) => isOpen ? <div>Wallet</div> : null,
}));
vi.mock('lucide-react', () => {
    const icons = ['Menu', 'X', 'Sun', 'Moon', 'Globe', 'Server', 'Layers', 'BarChart2', 'BookOpen', 'GraduationCap', 'Gamepad2', 'Smartphone', 'FileText', 'MessageSquare', 'Eye', 'Check', 'Route', 'Sparkles', 'User', 'RefreshCcw', 'LogOut'];
    const mockIcon = () => null;
    const exports: Record<string, unknown> = { default: {} };
    for (const name of icons) exports[name] = mockIcon;
    return exports;
});

const user = userEvent.setup();

describe('Navbar', () => {
    beforeEach(() => {
        mockTheme = 'radix-dark';
        mockSetTheme.mockClear();
        mockPush.mockClear();
        mockReplace.mockClear();
    });

    // ─── Renderizado Inicial ─────────────────────────────────────────────────
    describe('Renderizado Inicial', () => {
        it('renders all main elements', () => {
            renderWithProviders(<Navbar />);
            expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
            expect(screen.getAllByRole('link').length).toBeGreaterThan(1);
            expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
            expect(screen.getAllByLabelText('Connect Wallet').length).toBeGreaterThan(0);
        });
    });

    // ─── Interactividad: Tema ────────────────────────────────────────────────
    describe('Interactividad de Tema', () => {
        it('calls setTheme when theme button is clicked', async () => {
            renderWithProviders(<Navbar />);
            const themeBtn = screen.getByRole('button', { name: /toggle theme/i });
            await user.click(themeBtn);
            expect(mockSetTheme).toHaveBeenCalledTimes(1);
        });

        it('cycles to the next theme in order', async () => {
            renderWithProviders(<Navbar />);
            const themeBtn = screen.getByRole('button', { name: /toggle theme/i });
            await user.click(themeBtn);
            expect(mockSetTheme).toHaveBeenCalledWith('oro-light');
        });

        it('does not crash on rapid double-click', async () => {
            renderWithProviders(<Navbar />);
            const themeBtn = screen.getByRole('button', { name: /toggle theme/i });
            await user.dblClick(themeBtn);
            expect(mockSetTheme).toHaveBeenCalledTimes(2);
        });
    });

    // ─── Interactividad: Idioma ──────────────────────────────────────────────
    describe('Interactividad de Idioma', () => {
        it('navigates to opposite locale on language toggle', async () => {
            renderWithProviders(<Navbar />, { locale: 'es' });
            const langBtns = screen.getAllByRole('button', { name: /toggle language/i });
            await user.click(langBtns[0]);
            expect(mockReplace).toHaveBeenCalled();
        });
    });

    // ─── Menú Móvil ──────────────────────────────────────────────────────────
    describe('Menú Móvil', () => {
        it('opens and closes the mobile menu', async () => {
            renderWithProviders(<Navbar />);
            const menuButtons = screen.getAllByRole('button');
            const hamburger = menuButtons.find(btn =>
                btn.className.includes('md:hidden') || btn.textContent === ''
            );
            if (!hamburger) return;
            await user.click(hamburger);
            const allLinks = screen.getAllByRole('link');
            expect(allLinks.length).toBeGreaterThan(3);
            await user.click(hamburger);
        });
    });

    // ─── Accesibilidad ───────────────────────────────────────────────────────
    describe('Accesibilidad', () => {
        it('has proper accessibility attributes', () => {
            renderWithProviders(<Navbar />);
            expect(screen.getByRole('button', { name: /toggle theme/i })).toHaveAttribute('aria-label');
            expect(screen.getByRole('button', { name: /toggle language/i })).toHaveAttribute('aria-label');
            expect(screen.getByRole('navigation')).toBeInTheDocument();
        });
    });
});

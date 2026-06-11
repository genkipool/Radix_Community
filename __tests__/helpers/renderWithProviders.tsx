import React, { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';
import { LayoutProvider } from '@/context/LayoutContext';
import { translations } from '@/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RadixWalletContext } from '@/features/wallet/context/RadixWalletProvider';

/**
 * Mock ThemeProvider that works without next-themes in test environment.
 * Avoids the need to mock next-themes internals.
 */
const ThemeContext = React.createContext({
    theme: 'radix-dark' as string,
    setTheme: (t: string) => { void t; },
});

function MockThemeProvider({ children, theme = 'radix-dark' }: { children: ReactNode; theme?: string }) {
    const [currentTheme, setCurrentTheme] = React.useState(theme);
    return (
        <ThemeContext.Provider value={{ theme: currentTheme, setTheme: setCurrentTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

// Re-export the context so tests can spy on it if needed
export { ThemeContext };

interface ProviderOptions {
    locale?: 'en' | 'es';
    theme?: string;
}

function AllProviders({ children, locale = 'en', theme = 'radix-dark' }: { children: ReactNode } & ProviderOptions) {
    const dictionary = translations[locale] as typeof translations.en;
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <MockThemeProvider theme={theme}>
                <LanguageProvider language={locale} dictionary={dictionary}>
                    <LayoutProvider>
                        <RadixWalletContext.Provider value={{ isConnected: false, isLoading: false, isExtensionAvailable: true, accounts: [], personaData: [], persona: undefined, error: null, activeNetworkId: null, sessions: { mainnet: null, stokenet: null }, activeNetwork: 'mainnet', connect: () => {}, disconnect: () => {}, switchNetwork: () => {}, selectedAccountAddresses: [], setSelectedAccountAddresses: () => {} }}>
                            {children}
                        </RadixWalletContext.Provider>
                    </LayoutProvider>
                </LanguageProvider>
            </MockThemeProvider>
        </QueryClientProvider>
    );
}

export function renderWithProviders(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & ProviderOptions,
) {
    const { locale, theme, ...renderOptions } = options ?? {};
    return render(ui, {
        wrapper: ({ children }) => (
            <AllProviders locale={locale} theme={theme}>
                {children}
            </AllProviders>
        ),
        ...renderOptions,
    });
}

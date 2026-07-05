/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
            'server-only': path.resolve(__dirname, '__tests__/mocks/server-only.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./__tests__/setup.ts'],
        include: ['__tests__/**/*.test.{ts,tsx}'],
        css: false,
    },
});

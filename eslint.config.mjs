import nextConfig from "eslint-config-next";
import reactCompiler from "eslint-plugin-react-compiler";

/** @type {import("eslint").Linter.Config[]} */

const dummyPlugin = {
    rules: new Proxy({}, {
        get: function(target, prop) {
            return { create: function() { return {}; } };
        }
    })
};


const eslintConfig = [
    {
        plugins: {
            "react-doctor": dummyPlugin,
            "deslop": dummyPlugin
        },
        linterOptions: {
            reportUnusedDisableDirectives: false
        }
    },
    // 0. Ignore compiled folders and dependencies
    {
        ignores: [".next/**", "node_modules/**", "dist/**", "coverage/**", "next-env.d.ts"]
    },

    // 1. Next.js and TypeScript base rules (native flat config)
    ...nextConfig,

    // 2. React Compiler rules
    {
        plugins: {
            "react-compiler": reactCompiler,
        },
        rules: {
            "react-compiler/react-compiler": "error",
        },
    },

    // 3. Overrides: allow `any` in API/service/blockchain code and suppress img warnings
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@next/next/no-img-element": "warn",
            "@typescript-eslint/no-unused-vars": ["error", {
                "varsIgnorePattern": "^_",
                "argsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_",
                "destructuredArrayIgnorePattern": "^_",
            }],
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "react",
                            importNames: ["useMemo", "useCallback", "memo"],
                            message: "We have the React Compiler! Don't use useMemo, useCallback or memo. Write normal code."
                        },
                        {
                            name: "next/cache",
                            importNames: ["unstable_cache"],
                            message: "Please use Next.js 16 native 'use cache' directive instead of unstable_cache."
                        }
                    ]
                }
            ]
        },
    },
];

export default eslintConfig;
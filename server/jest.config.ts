import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    globals: {
        "ts-jest": {
            tsconfig: "./tsconfig.test.json",
        },
    },
    projects: [
        {
            displayName: "integration",
            preset: "ts-jest",
            testEnvironment: "node",
            globals: {
                "ts-jest": {
                    tsconfig: "./tsconfig.test.json",
                },
            },
            testMatch: ["**/__tests__/**/*.test.ts"],
            testPathIgnorePatterns: [
                "/node_modules/",
                "\\.unit\\.test\\.ts$",  // ← regex על סיומת, לא path מלא
            ],
            setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
        },
        {
            displayName: "unit",
            preset: "ts-jest",
            testEnvironment: "node",
            globals: {
                "ts-jest": {
                    tsconfig: "./tsconfig.test.json",
                },
            },
            testMatch: ["**/__tests__/**/*.unit.test.ts"],
        },
    ],
};

export default config;
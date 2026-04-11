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
            testMatch: ["**/__tests__/auth.test.ts"],
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
            testMatch: ["**/__tests__/redis.service.test.ts"],
        },
    ],
};

export default config;
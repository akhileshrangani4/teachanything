import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  rootDir: ".",

  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/__tests__/**",
    "!src/**/__mocks__/**",
    "!src/app/**/layout.tsx",
    "!src/app/**/page.tsx",
    "!src/types/**",
  ],

  coverageDirectory: "<rootDir>/coverage",
  coverageProvider: "v8",

  coverageThreshold: {
    global: {
      branches: 30,
      lines: 4,
    },
  },

  clearMocks: true,
  resetMocks: true,

  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
    "\\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$":
      "<rootDir>/__mocks__/fileMock.cjs",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@teachanything/db$": "<rootDir>/../../packages/db/src",
    "^@teachanything/db/(.*)$": "<rootDir>/../../packages/db/src/$1",
    "^@teachanything/ai$": "<rootDir>/../../packages/ai/src",
    "^@teachanything/ai/(.*)$": "<rootDir>/../../packages/ai/src/$1",
  },

  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.ts"],

  transform: {
    "^.+\\.(t|j)sx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          jsx: "react-jsx",
          allowJs: true,
        },
      },
    ],
  },

  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transformIgnorePatterns: ["/node_modules/(?!nanoid)/"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/dist/"],
};

export default config;

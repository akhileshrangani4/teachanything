import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],

  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },

  collectCoverageFrom: [
    "<rootDir>/src/**/*.{ts,tsx}",
    "!<rootDir>/src/**/*.test.{ts,tsx}",
    "!<rootDir>/src/**/__tests__/**",
    "!<rootDir>/src/**/__mocks__/**",
    "!<rootDir>/dist/**",
  ],

  coverageDirectory: "<rootDir>/coverage",
  coverageProvider: "v8",

  coverageThreshold: {
    global: {
      branches: 10,
      lines: 10,
    },
  },

  clearMocks: true,
  resetMocks: true,

  transformIgnorePatterns: ["/node_modules/(?!nanoid|langchain|@langchain)/"],

  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};

export default config;

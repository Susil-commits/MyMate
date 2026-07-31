/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^sanitize-html$": "<rootDir>/tests/mocks/sanitize-html.cjs"
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  extensionsToTreatAsEsm: [".ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(sanitize-html|htmlparser2|domhandler|domutils|entities|dom-serializer)/)"
  ],
};

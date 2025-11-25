import type { Config } from "jest"
import { pathsToModuleNameMapper } from "ts-jest"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const { compilerOptions } = require("./tsconfig.json")

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths ?? {}, {
      prefix: "<rootDir>/",
    }),
    "^nodemailer-express-handlebars$":
      "<rootDir>/test/__mocks__/nodemailer-express-handlebars.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
        useESM: false,
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!uuid)",
  ],
}

export default config

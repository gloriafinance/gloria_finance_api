const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
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
  transformIgnorePatterns: ["node_modules/(?!uuid)"],
}

module.exports = config

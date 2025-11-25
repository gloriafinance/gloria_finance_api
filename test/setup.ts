// Mock uuid before any other imports
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-value'),
  v1: jest.fn(() => 'test-uuid-value'),
  v3: jest.fn(() => 'test-uuid-value'),
  v5: jest.fn(() => 'test-uuid-value'),
}))

jest.mock('@/Shared/adapter/CustomLogger', () => ({
  Logger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}))

jest.mock('@/Shared/adapter', () => ({
  IdentifyEntity: { get: (prefix: string) => `${prefix}-test-id` },
  Logger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  XLSExportAdapter: jest.fn(),
  HandlebarsHTMLAdapter: jest.fn(),
  PuppeteerAdapter: jest.fn(),
  GeneratePDFAdapter: jest.fn(),
}))

jest.mock('@/Shared/decorators', () => ({
  Cache:
    () =>
    (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}))

jest.mock('@/Shared/infrastructure/middleware/Permission.middleware', () => ({
  PermissionMiddleware: (_req: any, _res: any, next: any) => next(),
}))

jest.mock('@/Shared/infrastructure/middleware/Can.middleware', () => ({
  Can: () => (_req: any, _res: any, next: any) => next(),
}))

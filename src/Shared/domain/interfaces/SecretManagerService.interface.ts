export interface ISecretManagerService {
  upsertSecret<T>(secretId: string, secretValue: T): Promise<void>

  accessSecret<T>(secretId: string): Promise<T | undefined>

  deleteSecret(secretId: string): Promise<void>
}

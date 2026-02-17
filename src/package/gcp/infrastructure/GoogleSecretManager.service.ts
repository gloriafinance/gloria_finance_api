import { SecretManagerServiceClient } from "@google-cloud/secret-manager"
import { Logger } from "@/Shared/adapter"
import { GenericException, type ISecretManagerService } from "@/Shared/domain"

export class GoogleSecretManagerService implements ISecretManagerService {
  private static instance: GoogleSecretManagerService
  private readonly logger = Logger(GoogleSecretManagerService.name)
  private readonly client = new SecretManagerServiceClient()
  private readonly projectIdPromise = this.resolveProjectId()

  static getInstance(): GoogleSecretManagerService {
    if (!GoogleSecretManagerService.instance) {
      GoogleSecretManagerService.instance = new GoogleSecretManagerService()
    }
    return GoogleSecretManagerService.instance
  }

  async upsertSecret<T>(secretId: string, secretValue: T): Promise<void> {
    const projectId = await this.projectIdPromise
    const serializedSecret = this.serializeSecret(secretValue)
    const normalizedId = this.normalizeSecretId(secretId)
    const parent = `projects/${projectId}`
    const secretPath = `${parent}/secrets/${normalizedId}`

    const exists = await this.secretExists(secretPath)
    if (!exists) {
      await this.client.createSecret({
        parent,
        secretId: normalizedId,
        secret: {
          replication: { automatic: {} },
        },
      })
    }

    await this.client.addSecretVersion({
      parent: secretPath,
      payload: {
        data: Buffer.from(serializedSecret, "utf8"),
      },
    })
  }

  async accessSecret<T>(secretId: string): Promise<T | undefined> {
    const projectId = await this.projectIdPromise
    const normalizedId = this.normalizeSecretId(secretId)
    const versionPath = `projects/${projectId}/secrets/${normalizedId}/versions/latest`

    try {
      const [version] = await this.client.accessSecretVersion({
        name: versionPath,
      })
      const data = version.payload?.data
      if (!data) {
        return undefined
      }

      return this.deserializeSecret<T>(Buffer.from(data).toString("utf8"))
    } catch (error: any) {
      if (this.isNotFound(error)) {
        return undefined
      }

      this.logger.error("Failed to access secret in Google Secret Manager", {
        secretId: normalizedId,
        message: error?.message ?? "Unknown error",
      })
      throw new GenericException(
        "Unable to access secret from Google Secret Manager"
      )
    }
  }

  private async secretExists(secretPath: string): Promise<boolean> {
    try {
      await this.client.getSecret({ name: secretPath })
      return true
    } catch (error: any) {
      if (this.isNotFound(error)) {
        return false
      }

      this.logger.error("Failed to verify secret in Google Secret Manager", {
        secretPath,
        message: error?.message ?? "Unknown error",
      })
      throw new GenericException(
        "Unable to verify secret in Google Secret Manager"
      )
    }
  }

  private async resolveProjectId(): Promise<string> {
    try {
      const projectId = await this.client.getProjectId()
      if (!projectId) {
        throw new Error("empty_project_id")
      }
      return projectId
    } catch (error: any) {
      this.logger.error("Failed to resolve GCP project id for Secret Manager", {
        message: error?.message ?? "Unknown error",
      })
      throw new GenericException(
        "Unable to resolve Google Cloud project id from ADC credentials"
      )
    }
  }

  private normalizeSecretId(secretId: string): string {
    const normalized = String(secretId ?? "")
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 255)

    if (!normalized) {
      throw new GenericException("Invalid secret id for Google Secret Manager")
    }

    return normalized
  }

  private serializeSecret<T>(secretValue: T): string {
    const serialized = JSON.stringify(secretValue)
    if (serialized === undefined) {
      throw new GenericException("Secret value cannot be undefined")
    }
    return serialized
  }

  private deserializeSecret<T>(serializedSecret: string): T {
    try {
      return JSON.parse(serializedSecret) as T
    } catch {
      throw new GenericException("Secret payload is not valid JSON")
    }
  }

  private isNotFound(error: any): boolean {
    return (
      error?.code === 5 ||
      String(error?.message ?? "")
        .toUpperCase()
        .includes("NOT_FOUND")
    )
  }
}

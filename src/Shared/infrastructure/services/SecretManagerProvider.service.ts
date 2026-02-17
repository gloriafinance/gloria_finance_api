import type { ISecretManagerService } from "@/Shared/domain"
import { GenericException } from "@/Shared/domain"
import { GoogleSecretManagerService } from "@/package/gcp"

export class SecretManagerProviderService {
  private static instance: ISecretManagerService

  static getInstance(): ISecretManagerService {
    if (!SecretManagerProviderService.instance) {
      const cloudProvider = (process.env.CLOUD_PROVIDER ?? "gcp").toLowerCase()
      if (cloudProvider !== "gcp") {
        throw new GenericException(
          `Unsupported CLOUD_PROVIDER '${cloudProvider}' for Secret Manager`
        )
      }

      SecretManagerProviderService.instance =
        GoogleSecretManagerService.getInstance()
    }

    return SecretManagerProviderService.instance
  }
}

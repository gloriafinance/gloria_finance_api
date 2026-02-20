import { ChurchStatus, type IChurchRepository } from "@/Church/domain"
import { Logger } from "@/Shared/adapter"
import type { ISecretManagerService } from "@/Shared/domain"
import { SecretManagerProviderService } from "@/Shared/infrastructure"
import {
  MetaWhatsappGraphService,
  type WhatsappAccessTokenSecret,
} from "@/package/whatsapp"
import type { IJob } from "@/package/queue/domain"

export class RotateWhatsappAccessTokensJob implements IJob {
  private readonly logger = Logger(RotateWhatsappAccessTokensJob.name)
  private readonly metaWhatsapp = new MetaWhatsappGraphService()
  private readonly rotateWindowDays = Number(
    process.env.META_ROTATE_WINDOW_DAYS ?? "10"
  )

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly secretManager: ISecretManagerService = SecretManagerProviderService.getInstance()
  ) {}

  async handle(): Promise<void> {
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET

    if (!appId || !appSecret) {
      this.logger.debug(
        "Skipping WhatsApp token rotation: META_APP_ID or META_APP_SECRET missing"
      )
      return
    }

    const churches = await this.churchRepository.all({
      status: ChurchStatus.ACTIVE,
    })
    let processed = 0
    let rotated = 0

    for (const church of churches) {
      const credentials = church.getWhatsappCredentials()
      if (
        !credentials.wabaId ||
        !credentials.phoneNumberId ||
        !credentials.accessTokenSecretId
      ) {
        continue
      }

      let accessToken: string
      try {
        accessToken = await this.resolveAccessToken(
          church.getChurchId(),
          credentials.accessTokenSecretId
        )
      } catch {
        continue
      }

      processed++
      const inspect = await this.inspectToken(accessToken)

      if (!inspect.isValid) {
        this.logger.debug(
          `WhatsApp token invalid for church ${church.getChurchId()}. Reconnect required`
        )
        continue
      }

      // Some system-user tokens may not have time-based expiration.
      if (!inspect.expiresAt || inspect.expiresAt <= 0) {
        continue
      }

      const secondsLeft = inspect.expiresAt - Math.floor(Date.now() / 1000)
      const rotationWindow = this.rotateWindowDays * 24 * 60 * 60

      if (secondsLeft > rotationWindow) {
        continue
      }

      const refreshedToken = await this.refreshToken(accessToken)

      if (!refreshedToken) {
        this.logger.debug(
          `Unable to refresh WhatsApp token for church ${church.getChurchId()}`
        )
        continue
      }

      const secretId = credentials.accessTokenSecretId

      try {
        const secretPayload: WhatsappAccessTokenSecret = {
          accessToken: refreshedToken,
        }
        await this.secretManager.upsertSecret(secretId, secretPayload)
      } catch (error: any) {
        this.logger.error("Unable to store rotated WhatsApp token", {
          churchId: church.getChurchId(),
          message: error?.message ?? "Unknown error",
        })
        continue
      }

      church.setWhatsappCredentials(
        credentials.wabaId,
        credentials.phoneNumberId,
        secretId
      )
      await this.churchRepository.upsert(church)
      rotated++
    }

    this.logger.info("WhatsApp token rotation finished", {
      processed,
      rotated,
      rotateWindowDays: this.rotateWindowDays,
    })
  }

  private async inspectToken(
    accessToken: string
  ): Promise<{ isValid: boolean; expiresAt?: number }> {
    try {
      const data = await this.metaWhatsapp.inspectToken(accessToken)
      return {
        isValid: data.is_valid === true,
        expiresAt: data.expires_at,
      }
    } catch (error: any) {
      this.logger.error("Failed to inspect WhatsApp token", {
        message: error?.message ?? "Unknown error",
      })
      return { isValid: false }
    }
  }

  private async refreshToken(accessToken: string): Promise<string | undefined> {
    try {
      return await this.metaWhatsapp.rotateAccessToken(accessToken)
    } catch (error: any) {
      this.logger.error("Failed to rotate WhatsApp token", {
        message: error?.message ?? "Unknown error",
      })
      return undefined
    }
  }

  private async resolveAccessToken(
    churchId: string,
    secretId: string
  ): Promise<string> {
    try {
      const secret =
        await this.secretManager.accessSecret<WhatsappAccessTokenSecret>(
          secretId
        )
      const accessToken = secret?.accessToken?.trim()
      if (!accessToken) {
        throw new Error("missing_access_token")
      }
      return accessToken
    } catch (error: any) {
      this.logger.error("Unable to read WhatsApp token from secret manager", {
        churchId,
        secretId,
        message: error?.message ?? "Unknown error",
      })
      throw error
    }
  }
}

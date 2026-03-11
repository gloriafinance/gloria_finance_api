import {
  Church,
  Devotional,
  DevotionalAudience,
  DevotionalNotFound,
  DevotionalTone,
  type IChurchRepository,
  type IDevotionalRepository,
} from "@/Church/domain"
import { Logger } from "@/Shared/adapter"
import { FindChurchById } from "@/Church/applications/church/FindChurchById"
import { DevotionalGeneratorJob } from "@/Church/infrastructure/http/jobs/DevotionalGenerator.job"

const TONE_LABEL_MAP: Record<DevotionalTone, string> = {
  [DevotionalTone.PASTORAL]: "pastoral",
  [DevotionalTone.EXHORTATIVE_SOFT]: "exhortativo suave",
  [DevotionalTone.CELEBRATIVE]: "celebrativo",
  [DevotionalTone.CONTEMPLATIVE]: "contemplativo",
}

const AUDIENCE_LABEL_MAP: Record<DevotionalAudience, string> = {
  [DevotionalAudience.ALL]: "todos",
  [DevotionalAudience.YOUTH]: "jóvenes",
  [DevotionalAudience.WOMEN]: "damas",
  [DevotionalAudience.MEN]: "caballeros",
  [DevotionalAudience.KIDS]: "niños",
}

export class DevotionalGenerationService {
  private readonly logger = Logger(DevotionalGenerationService.name)
  private readonly generator = new DevotionalGeneratorJob()

  constructor(
    private readonly devotionalRepository: IDevotionalRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async regenerate(
    churchId: string,
    devotionalId: string,
    currentUserId: string
  ) {
    this.logger.info("Regenerate devotional requested", {
      churchId,
      devotionalId,
      currentUserId,
    })

    const { devotional, church } = await this.searchDevotionalAndChurch(
      churchId,
      devotionalId
    )

    devotional.markGenerating()
    await this.devotionalRepository.upsert(devotional)
    this.logger.info("Devotional marked as generating", {
      churchId,
      devotionalId,
      status: devotional.getStatus(),
    })

    return await this.generateWithIA(devotional, church, currentUserId)
  }

  async generate(
    churchId: string,
    devotionalId: string
  ): Promise<{
    church: Church | null
    devotional: Devotional | null
  }> {
    const claimed = await this.devotionalRepository.claimGeneration(
      churchId,
      devotionalId
    )
    if (!claimed) {
      return { church: null, devotional: null }
    }

    const { devotional, church } = await this.searchDevotionalAndChurch(
      churchId,
      devotionalId
    )

    try {
      return await this.generateWithIA(devotional, church)
    } catch (error: any) {
      this.logger.error("Error generating devotional", {
        devotionalId,
        churchId,
        message: error?.message,
      })
      devotional.markFailed(error?.message ?? "Error generating devotional")
      await this.devotionalRepository.upsert(devotional)
      throw error
    }
  }

  private async searchDevotionalAndChurch(
    churchId: string,
    devotionalId: string
  ) {
    const devotional = await this.devotionalRepository.findByDevotionalId(
      churchId,
      devotionalId
    )
    if (!devotional) {
      this.logger.debug(
        `Devotional not found by church ${churchId} and devocionalId ${devotionalId}`
      )
      throw new DevotionalNotFound()
    }

    const church = await new FindChurchById(this.churchRepository).execute(
      churchId
    )

    return {
      devotional,
      church,
    }
  }

  private async generateWithIA(
    devotional: Devotional,
    church: Church,
    currentUserId?: string
  ) {
    const snapshot = devotional.getPlanSnapshot()
    this.logger.info("Generating devotional with AI", {
      churchId: church.getChurchId(),
      devotionalId: devotional.getDevotionalId(),
      lang: church.getLang(),
      mode: snapshot.mode,
      audience: snapshot.audience,
      tone: snapshot.dayConfig.tone,
      dayOfWeek: snapshot.dayConfig.dayOfWeek,
    })

    const generated = await this.generator.handler({
      church_doctrinal_profile_text: church.getDoctrinalBases().join(". "),
      purpose: snapshot.dayConfig.biblicalContext,
      theme: snapshot.themeWeek,
      title_hint: snapshot.dayConfig.titleHint,
      lang: church.getLang(),
      tone: TONE_LABEL_MAP[snapshot.dayConfig.tone],
      audience: AUDIENCE_LABEL_MAP[snapshot.audience],
    })

    devotional.applyGeneratedContent(
      {
        title: generated.title,
        devotional: generated.devotional,
        scriptures: generated.scriptures,
        pushTitle: generated.push.push_title,
        pushBody: generated.push.push_body,
      },
      currentUserId
    )

    await this.devotionalRepository.upsert(devotional)
    this.logger.info("Devotional generated and persisted", {
      churchId: church.getChurchId(),
      devotionalId: devotional.getDevotionalId(),
      status: devotional.getStatus(),
      titleLength: generated.title.length,
      devotionalLength: generated.devotional.length,
      scriptures: generated.scriptures.length,
    })

    return { devotional, church }
  }
}

import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  Res,
  Use,
  type ServerRequest,
} from "bun-platform-kit"
import {
  GetBankingOnboardingDraft,
  SaveBankingOnboardingDraft,
} from "@/Banking/applications"
import type { ChurchBankingOnboardingDraft } from "@/Church/domain/type/ChurchBankingOnboarding.type"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"

@Controller("/api/v1/banking/onboarding")
export class BankingOnboardingController {
  @Get("/draft")
  @Use([PermissionMiddleware, Can("banking", "read")])
  async getDraft(@Req() request: ServerRequest, @Res() res: ServerResponse) {
    try {
      const auth = (request as any).auth as {
        churchId: string
        userId: string
      }

      const draft = await new GetBankingOnboardingDraft(
        ChurchMongoRepository.getInstance()
      ).execute(auth.churchId)

      res.status(HttpStatus.OK).send(draft)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Put("/draft")
  @Use([PermissionMiddleware, Can("banking", "manage")])
  async saveDraft(
    @Body() draft: ChurchBankingOnboardingDraft,
    @Req() request: ServerRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const auth = (request as any).auth as {
        churchId: string
        userId: string
      }

      const saved = await new SaveBankingOnboardingDraft(
        ChurchMongoRepository.getInstance()
      ).execute(auth.churchId, auth.userId, draft)

      res.status(HttpStatus.OK).send(saved)
    } catch (e) {
      domainResponse(e, res)
    }
  }
}

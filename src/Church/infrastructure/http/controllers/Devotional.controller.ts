import { Body, Controller, Post, Req, Res, type ServerResponse, Use, } from "bun-platform-kit"
import { DevotionalGeneratorJob } from "@/Church/infrastructure/http/jobs/DevotionalGenerator.job.ts"
import { HttpStatus } from "@/Shared/domain"
import { AIProviderError, AIProviderErrorCode, } from "@/package/ai/errors/AIProviderError"
import { FindChurchById } from "@/Church/applications"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { type AuthenticatedRequest, PermissionMiddleware, } from "@/Shared/infrastructure"

@Controller("/api/v1/church/devotional")
export class DevotionalController {
  @Post("/generate")
  @Use(PermissionMiddleware)
  async generate(
    @Body()
    body: {
      purpose: string
      theme: string
      title_hint: string
      lang: string
      tone: string // pastoral / exhortativo suave / celebrativo / contemplativo
      audience: string
    },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const church = await new FindChurchById(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId)

      const response = await new DevotionalGeneratorJob().handler({
        ...body,
        church_doctrinal_profile_text: church.getDoctrinalBase().join(". "),
      })

      res.status(HttpStatus.OK).send(response)
    } catch (error) {
      if (error instanceof AIProviderError) {
        if (error.code === AIProviderErrorCode.LIMIT_EXCEEDED) {
          return res.status(HttpStatus.TOO_MANY_REQUESTS).send({
            message: error.message,
            provider: error.provider,
            status: error.status,
            code: error.code,
          })
        }

        if (error.code === AIProviderErrorCode.AUTH_ERROR) {
          return res.status(HttpStatus.UNAUTHORIZED).send({
            message: error.message,
            provider: error.provider,
            status: error.status,
            code: error.code,
          })
        }

        return res.status(HttpStatus.BAD_REQUEST).send({
          message: error.message,
          provider: error.provider,
          status: error.status,
          code: error.code,
        })
      }

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        message: "Unexpected error generating devotional",
      })
    }
  }
}

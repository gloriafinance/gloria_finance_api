import {
  Body,
  Controller,
  Post,
  Res,
  type ServerResponse,
} from "bun-platform-kit"
import { DevotionalGeneratorJob } from "@/Church/infrastructure/http/jobs/DevotionalGenerator.job.ts"
import { HttpStatus } from "@/Shared/domain"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError"

@Controller("/api/v1/church/devotional")
export class DevotionalController {
  @Post("/generate")
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
    @Res() res: ServerResponse
  ) {
    const church_doctrinal_profile_text =
      "La base doctrinal que la IPUB (Igreja Pentecostal Unida do Brasil) publica en sus canales oficiales/distritales se resume así:\n" +
      "\n" +
      "La Biblia como autoridad máxima e infalible para doctrina y práctica cristiana.\n" +
      "\n" +
      "Un solo Dios (Unicidad): Dios es uno e indivisible, y se manifestó como Padre (creación), Hijo (encarnación) y Espíritu Santo (después de la ascensión).\n" +
      "\n" +
      "Jesucristo y el “Nombre”: enfatizan la salvación y la predicación en el Nombre de Jesús, con textos como Hechos 4:12.\n" +
      "\n" +
      "Arrepentimiento: perdón/remisión de pecados mediante arrepentimiento genuino y fe en Cristo.\n" +
      "\n" +
      "Bautismo en agua: presentado como parte del “evangelio completo”, junto al arrepentimiento y el Espíritu Santo.\n" +
      "\n" +
      "Bautismo con el Espíritu Santo con evidencia inicial de hablar en otras lenguas (Hechos 2:4; 10:45–46; 19:6).\n" +
      "\n" +
      "En su descripción institucional, también declaran que predican que hay “apenas um Deus… Jesus Cristo” y que es necesario arrepentimiento + bautismo en el Nombre de Jesús + bautismo con el Espíritu Santo.\n" +
      "\n" +
      "Y como contexto histórico, sus páginas conectan a la IPUB con la UPCI (United Pentecostal Church International)."

    try {
      const response = await new DevotionalGeneratorJob().handler({
        ...body,
        church_doctrinal_profile_text,
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

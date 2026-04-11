import { type Schema, SchemaType } from "@google/generative-ai"
import { AITextService } from "@/package/ai/service/AITextService.ts"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError.ts"
import { ScheduleEventType } from "@/Schedule/domain"

export type PromptUserRequest = {
  church_doctrinal_profile_text: string
  lang: string
  title: string
  activityType: ScheduleEventType
  time: string
}

type NotificationEventResponse = {
  title: string
  body: string
}

export class NotificationEventsAgent {
  async execute(request: PromptUserRequest) {
    const { church_doctrinal_profile_text, lang, time, title, activityType } =
      request

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      required: ["title", "body"],
      properties: {
        title: {
          type: SchemaType.STRING,
          description:
            "Título curto da notificação push, alegre, convidativo e claro. Máximo 45 caracteres.",
        },
        body: {
          type: SchemaType.STRING,
          description:
            "Mensagem curta da notificação push, animada, entusiástica, natural, com base bíblica e convite para o evento. Máximo 140 caracteres.",
        },
      },
    }

    const systemPrompt =
      `Você é um agente especializado em gerar conteúdo curto para push notifications de igrejas cristãs.

        Sua única função é gerar uma saída estruturada para notificação push com os campos exatos:
        - title
        - body
        
        Regras obrigatórias:
        1. Responda sempre e somente no idioma informado na entrada. Não misture idiomas. Não traduza para outro idioma. Não use palavras de outro idioma.
        2. Retorne apenas conteúdo compatível com o schema definido. Não inclua campos extras. Não inclua explicações. Não inclua markdown.
        3. O conteúdo deve ser apropriado para push notification mobile: curto, claro, natural e direto.
        4. O tom deve ser alegre, acolhedor, entusiástico, reverente e pastoral, sem exageros.
        5. O conteúdo deve convidar a pessoa para participar da atividade informada.
        6. O conteúdo deve ter base bíblica de forma breve, natural e segura.
        7. O conteúdo deve respeitar estritamente a base doutrinária fornecida na entrada.
        8. Nunca contradiga, relativize, reinterprete ou invente doutrina além do que foi fornecido.
        9. Se a base doutrinária limitar certos tipos de linguagem, promessas, práticas ou ênfases, siga essa limitação estritamente.
        10. Não use linguagem manipulativa, sensacionalista, agressiva, condenatória ou estranha.
        11. Não use emojis.
        12. Não invente detalhes que não estejam presentes na entrada.
        13. O campo "title" deve ser curto e adequado para notificação push.
        14. O campo "body" deve ser curto, convidativo e adequado para notificação push.
        15. Se houver qualquer tensão entre criatividade e fidelidade doutrinária, priorize sempre a fidelidade doutrinária.
        16. Se a entrada trouxer tom, idioma, contexto e base doutrinária, esses elementos são a fonte de verdade.`.trim()

    const userPrompt = `
      Gere uma notificação push para a atividade abaixo.

      Dados de entrada:
      - language: ${lang}
      - activityType: ${activityType}
      - time: ${time}
      - title: ${title}
      - doctrinalBasis: ${church_doctrinal_profile_text}
      
      Instruções específicas:
      - Gere a resposta estritamente no idioma informado em "language".
      - Use "doctrinalBasis" como referência obrigatória de fidelidade teológica e pastoral.
      - Crie uma saída curta para push notification.
      - A saída deve conter somente:
        - title
        - body
      - O title deve ser curto e claro.
      - O body deve convidar para a atividade, com linguagem natural e breve base bíblica, sem violar a base doutrinária informada.`.trim()

    try {
      return await AITextService.getInstance().execute<NotificationEventResponse>(
        {
          systemPrompt,
          userPrompt,
          schema: responseSchema,
          validate: (provider, payload) => validateResponse(provider, payload),
        }
      )
    } catch (error) {
      if (error instanceof AIProviderError) throw error
      throw error
    }
  }
}

const validateResponse = (
  provider: string,
  payload: unknown
): NotificationEventResponse => {
  if (!payload || typeof payload !== "object") {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid response: payload is not an object"
    )
  }

  const response = payload as Record<string, unknown>

  const title = response.title
  if (!title || typeof title !== "string") {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid response: title must be an string"
    )
  }

  const body = response.body
  if (!body || typeof body !== "string") {
    throw new AIProviderError(
      provider,
      undefined,
      AIProviderErrorCode.INVALID_RESPONSE,
      "Invalid response: body must be an string"
    )
  }

  return response as NotificationEventResponse
}

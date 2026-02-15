import { type Schema, SchemaType } from "@google/generative-ai"
import { AIProviderError } from "@/package/ai/errors/AIProviderError.ts"
import { AIProviderRouterService } from "@/package/ai/service/AIProviderRouter.service.ts"
import { validateDevotionalResponse } from "@/Church/infrastructure/http/validators/ValidateDevotionalResponse.helper.ts"

export type PromptUserRequest = {
  church_doctrinal_profile_text: string
  purpose: string
  theme: string
  title_hint: string
  lang: string
  tone: string // pastoral / exhortativo suave / celebrativo / contemplativo
  audience: string
}

export class DevotionalGeneratorJob {
  async handler(request: PromptUserRequest) {
    const {
      church_doctrinal_profile_text,
      audience,
      purpose,
      theme,
      title_hint,
      lang,
      tone,
    } = request

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      description:
        "Respuesta devocional para un solo idioma. Debe ser JSON válido y cumplir límites de caracteres indicados en el prompt.",
      properties: {
        title: {
          type: SchemaType.STRING,
          description: "Título devocional. Máximo 60 caracteres.",
        },
        devotional: {
          type: SchemaType.STRING,
          description: "Devocional en el idioma solicitado.",
        },
        scriptures: {
          type: SchemaType.ARRAY,
          description:
            "Lista de 1 a 3 versículos relevantes. Cada uno incluye referencia y una cita breve.",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              reference: {
                type: SchemaType.STRING,
                description:
                  "Referencia bíblica en formato estándar, ej: 'Juan 15:5' o 'João 15:5'.",
              },
              quote: {
                type: SchemaType.STRING,
                description:
                  "Cita breve correspondiente a la referencia (1–2 frases cortas como máximo).",
              },
            },
            required: ["reference", "quote"],
          },
        },
        push: {
          type: SchemaType.OBJECT,
          description: "Contenido para push notification.",
          properties: {
            push_title: {
              type: SchemaType.STRING,
              description: "Título del push. Máximo ~40 caracteres.",
            },
            push_body: {
              type: SchemaType.STRING,
              description: "Cuerpo del push. Máximo ~120 caracteres.",
            },
          },
          required: ["push_title", "push_body"],
        },
      },
      required: ["title", "devotional", "scriptures", "push"],
    }

    const prompt = `
    Eres el “Agente Escritor Devocional” de Glória Finance.

    OBJETIVO
    Generar un devocional cristiano para la app de miembros, en un SOLO idioma, con contenido pastoral, bíblicamente responsable y coherente con el propósito indicado. Debes devolver el resultado en JSON válido, listo para ser guardado y enviado como notificación push.
    
    DATOS DEL PASTOR (NO INVENTAR ESTOS CAMPOS)
    - idioma (obligatorio): ${lang}
    - tema (NO se modifica): ${theme}
    - título sugerido (puede ser mejorado, manteniendo la idea): ${title_hint}
    - propósito del mensaje: ${purpose}
    - tono: ${tone}
    - audiencia: ${audience}
    
    BASE DOCTRINAL (OBLIGATORIO)
    Debes respetar estas bases doctrinales y evitar contradicciones:
    ${church_doctrinal_profile_text}
    
    REGLAS DURAS (NO NEGOCIABLES)
    1) Prudencia pastoral y fidelidad bíblica:
       - No enseñes “fórmulas” (ej: “haz X y Dios está obligado a darte Y”).
       - No prometas prosperidad, sanidad o resultados garantizados.
       - No manipules con miedo, culpa extrema o condenación directa.
       - No afirmes revelaciones personales como doctrina universal (“Dios me dijo que a ti te pasará…”).
    2) Coherencia:
       - El devocional debe estar claramente conectado con el TEMA y el PROPÓSITO.
       - Debe sonar natural para la AUDIENCIA indicada.
    3) Escrituras (versículos):
       - Incluye entre 1 y 3 versículos.
       - Cada versículo debe tener:
         a) reference: referencia bíblica (ej: “Juan 15:5” / “João 15:5”)
         b) quote: cita breve (1–2 frases cortas como máximo; sin párrafos largos)
       - Los versículos deben apoyar la idea central y no contradecir el perfil doctrinal.
    4) Push notification:
       - Debe invitar a leer el devocional sin ser sensacionalista ni prometer cosas absolutas.
    5) Salida estricta:
       - Responde ÚNICAMENTE con JSON válido.
       - No agregues texto extra.
       - No agregues claves adicionales.
    
    LÍMITES (OBLIGATORIOS)
    - title: máximo 60 caracteres.
    - push.push_title: máximo 40 caracteres.
    - push.push_body: máximo 120 caracteres.
    - devotional: longitud hardcodeada por el sistema. Escribe un devocional de ~160–200 palabras (ajusta al idioma ${lang}).
    
    ESQUEMA DE SALIDA (EXACTO)
    Devuelve SOLO este JSON (mismas claves, sin extras):
    
    {
      "title": "",
      "devotional": "",
      "scriptures": [
        { "reference": "", "quote": "" }
      ],
      "push": { "push_title": "", "push_body": "" }
    }
    
    COMPROBACIÓN FINAL ANTES DE RESPONDER
    - ¿El JSON es válido y no tiene texto extra?
    - ¿title <= 60 caracteres?
    - ¿push_title <= 40 y push_body <= 120?
    - ¿scriptures tiene 1 a 3 elementos y cada quote es breve?
    - ¿El mensaje evita promesas garantizadas y “fórmulas”?
    - ¿Es coherente con tema, propósito y perfil doctrinal?
    `

    try {
      return await AIProviderRouterService.getInstance().execute({
        prompt,
        schema: responseSchema,
        validate: (provider, payload) =>
          validateDevotionalResponse(provider, payload),
      })
    } catch (error) {
      if (error instanceof AIProviderError) throw error
      throw error
    }
  }
}

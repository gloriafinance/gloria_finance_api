import { APP_DIR } from "@/app.ts"
import { Logger } from "@/Shared/adapter"
import nodemailerExpressHbs from "nodemailer-express-handlebars"
import * as fs from "fs"
import * as path from "node:path"

type Translations = Record<string, unknown>
const DEFAULT_LOCALE = "pt-BR"

const normalizeLocale = (value?: string): string => {
  if (!value) {
    return DEFAULT_LOCALE
  }

  const normalized = value.replace("_", "-").trim()
  const lower = normalized.toLowerCase()

  if (lower.startsWith("pt")) {
    return "pt-BR"
  }
  if (lower.startsWith("es")) {
    return "es"
  }

  return normalized
}

const loadTranslations = (): Record<string, Translations> => {
  const translations: Record<string, Translations> = {}
  const roots = [
    typeof APP_DIR === "string" ? path.join(APP_DIR, "templates", "i18n") : "",
    path.join(process.cwd(), "dist", "templates", "i18n"),
    path.join(process.cwd(), "src", "templates", "i18n"),
    path.join(process.cwd(), "templates", "i18n"),
  ].filter(Boolean)

  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue
    }

    const files = fs.readdirSync(root).filter((file) => file.endsWith(".json"))
    for (const file of files) {
      const locale = path.basename(file, ".json")
      if (translations[locale]) {
        continue
      }

      const content = fs.readFileSync(path.join(root, file), "utf8")
      translations[locale] = JSON.parse(content)
    }
  }

  return translations
}

const lookupTranslation = (
  translations: Record<string, Translations>,
  locale: string,
  key: string
): unknown => {
  const catalog = translations[locale]
  if (!catalog || !key) {
    return undefined
  }

  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined
    }

    return (current as Record<string, unknown>)[part]
  }, catalog)
}

const interpolate = (text: string, params: Record<string, unknown>): string => {
  return text.replace(/\{\{(\w+)\}\}/g, (_, token) => {
    const value = params[token]
    return value === undefined || value === null ? "" : String(value)
  })
}

export default async (transport: any) => {
  const logger = Logger("ConfigEngineHTML")
  const translations = loadTranslations()
  const availableLocales = Object.keys(translations)

  logger.info(`Configuración del motor de template`)

  //const hbs = await import("nodemailer-express-handlebars")

  logger.info(`${APP_DIR}/package/email/templates`)
  const handlebarOptions = {
    viewEngine: {
      extName: ".hbs",
      partialsDir: `${APP_DIR}/package/email/templates`,
      layoutsDir: `${APP_DIR}/package/email/templates`,
      defaultLayout: "base",
      helpers: {
        t: (key: string, options: any) => {
          const rootLang = options?.data?.root?.lang
          const normalized = normalizeLocale(rootLang)
          const locale = availableLocales.includes(normalized)
            ? normalized
            : availableLocales.includes(DEFAULT_LOCALE)
              ? DEFAULT_LOCALE
              : availableLocales[0] || DEFAULT_LOCALE

          const translation = lookupTranslation(translations, locale, key)
          if (typeof translation !== "string") {
            return ""
          }

          return interpolate(translation, options?.hash ?? {})
        },
        i18nLang: (options: any) => {
          const rootLang = options?.data?.root?.lang
          const normalized = normalizeLocale(rootLang)
          if (availableLocales.includes(normalized)) {
            return normalized
          }
          if (availableLocales.includes(DEFAULT_LOCALE)) {
            return DEFAULT_LOCALE
          }
          return availableLocales[0] || DEFAULT_LOCALE
        },
      },
    },
    viewPath: `${APP_DIR}/package/email/templates`,
    extName: ".hbs",
  }

  const configHbs = nodemailerExpressHbs(handlebarOptions)

  transport.use("compile", configHbs)
}

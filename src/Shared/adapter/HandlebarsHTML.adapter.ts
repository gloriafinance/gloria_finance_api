import { IHTMLAdapter } from "@/Shared/domain/interfaces/GenerateHTML.interface"
import Handlebars from "handlebars"
import * as fs from "fs"
import * as path from "node:path"
import { APP_DIR } from "@/app"
import { Logger } from "@/Shared/adapter/CustomLogger"

const handlebars =
  (Handlebars as unknown as { default?: typeof Handlebars }).default ||
  Handlebars

const categoryLabels: Record<string, string> = {
  REVENUE: "Entradas operacionais e doações recorrentes",
  COGS: "Custos diretos para entregar serviços ou projetos",
  OPEX: "Despesas operacionais do dia a dia",
  MINISTRY_TRANSFERS: "Repasses e contribuições ministeriais",
  CAPEX: "Investimentos e gastos de capital de longo prazo",
  OTHER: "Receitas ou despesas extraordinárias",
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export class HandlebarsHTMLAdapter implements IHTMLAdapter {
  private logger = Logger(HandlebarsHTMLAdapter.name)

  constructor() {
    handlebars.registerHelper("ifEquals", function (arg1, arg2, options) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this)
    })

    handlebars.registerHelper("inc", (value: number) => value + 1)

    handlebars.registerHelper("formatDate", (date: string) => {
      return new Intl.DateTimeFormat("es-ES").format(new Date(date))
    })

    handlebars.registerHelper("subtract", (a: number, b: number) => {
      const left = Number(a) || 0
      const right = Number(b) || 0

      return (left - right).toFixed(2)
    })

    handlebars.registerHelper("formatCurrency", (value: unknown) => {
      const numericValue = Number(value)
      const safeValue = Number.isFinite(numericValue) ? numericValue : 0

      if (safeValue < 0) {
        return `(${brlFormatter.format(Math.abs(safeValue))})`
      }

      return brlFormatter.format(safeValue)
    })

    handlebars.registerHelper("formatExpense", (value: unknown) => {
      const numericValue = Number(value)
      const safeValue = Number.isFinite(numericValue) ? numericValue : 0

      // For expenses, always show with minus sign
      if (safeValue > 0) {
        return `- ${brlFormatter.format(safeValue)}`
      } else if (safeValue < 0) {
        // If already negative (edge case), show as positive with minus
        return `- ${brlFormatter.format(Math.abs(safeValue))}`
      }

      return brlFormatter.format(0)
    })

    handlebars.registerHelper("isNegative", (value: unknown) => {
      const numericValue = Number(value)

      return Number.isFinite(numericValue) && numericValue < 0
    })

    handlebars.registerHelper("isExpense", (value: unknown) => {
      const numericValue = Number(value)
      // An expense is considered as any positive cost value
      return Number.isFinite(numericValue) && numericValue > 0
    })

    handlebars.registerHelper("translateCategory", (category: string) => {
      if (!category) {
        return ""
      }

      if (categoryLabels[category]) {
        return categoryLabels[category]
      }

      return category
        .toLowerCase()
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    })
  }

  generateHTML(templateName: string, data: any): string {
    this.logger.info(`Generating HTML from template: ${templateName}`, data)

    const templatePath = this.resolveTemplatePath(templateName)
    const htmlTemplate = fs.readFileSync(templatePath, "utf8")

    const template = handlebars.compile(htmlTemplate)

    return template(data)
  }

  private resolveTemplatePath(templateName: string): string {
    const templateFile = `${templateName}.hbs`
    const roots = [
      typeof APP_DIR === "string" ? path.join(APP_DIR, "templates") : undefined,
      path.join(process.cwd(), "dist", "templates"),
      path.join(process.cwd(), "src", "templates"),
      path.join(process.cwd(), "templates"),
    ].filter(Boolean) as string[]

    for (const root of roots) {
      const candidate = path.join(root, templateFile)
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }

    throw new Error(`Invalid path: template ${templateFile} not found`)
  }
}

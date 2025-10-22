import { IHTMLAdapter } from "@/Shared/domain/interfaces/GenerateHTML.interface"
import * as handlebars from "handlebars"
import * as fs from "fs"
import { APP_DIR } from "@/app"
import { Logger } from "@/Shared/adapter/CustomLogger"

const categoryLabels: Record<string, string> = {
  REVENUE: "Entradas operacionais e doações recorrentes",
  COGS: "Custos diretos para entregar serviços ou projetos",
  OPEX: "Despesas operacionais do dia a dia",
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

      return brlFormatter.format(safeValue)
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

    const loadTemplate = (path: string) => {
      return fs.readFileSync(path, "utf8")
    }

    const htmlTemplate = loadTemplate(
      `${APP_DIR}/templates/${templateName}.hbs`
    )

    const template = handlebars.compile(htmlTemplate)

    return template(data)
  }
}

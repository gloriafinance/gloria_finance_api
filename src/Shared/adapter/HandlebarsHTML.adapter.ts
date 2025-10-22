import { IHTMLAdapter } from "@/Shared/domain/interfaces/GenerateHTML.interface"
import * as handlebars from "handlebars"
import * as fs from "fs"
import { APP_DIR } from "@/app"
import { Logger } from "@/Shared/adapter/CustomLogger"

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

import { APP_DIR } from "@/app"
import { Logger } from "@/Shared/adapter"
import nodemailerExpressHbs from "nodemailer-express-handlebars"

export default async (transport: any) => {
  const logger = Logger("ConfigEngineHTML")

  logger.info(`Configuración del motor de template`)

  //const hbs = await import("nodemailer-express-handlebars")

  logger.info(`${APP_DIR}/SendMail/templates`)
  const handlebarOptions = {
    viewEngine: {
      extName: ".hbs",
      partialsDir: `${APP_DIR}/package/email/SendMail/templates`,
      layoutsDir: `${APP_DIR}/package/email/SendMail/templates`,
      defaultLayout: "base",
    },
    viewPath: `${APP_DIR}/package/email/SendMail/templates`,
    extName: ".hbs",
  }

  const configHbs = nodemailerExpressHbs(handlebarOptions)

  transport.use("compile", configHbs)
}

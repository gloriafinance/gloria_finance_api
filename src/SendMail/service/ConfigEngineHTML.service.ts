import { APP_DIR } from "@/app"
import { Logger } from "@/Shared/adapter"
import hbs = require("nodemailer-express-handlebars")

export default async (transport: any) => {
  const logger = Logger("ConfigEngineHTML")

  logger.info(`Configuración del motor de template`)

  //const hbs = await import("nodemailer-express-handlebars")

  logger.info(`${APP_DIR}/SendMail/templates`)
  const handlebarOptions = {
    viewEngine: {
      extName: ".hbs",
      partialsDir: `${APP_DIR}/SendMail/templates`,
      layoutsDir: `${APP_DIR}/SendMail/templates`,
      defaultLayout: "base",
    },
    viewPath: `${APP_DIR}/SendMail/templates`,
    extName: ".hbs",
  }
  const configHbs = hbs(handlebarOptions)

  transport.use("compile", configHbs)
}

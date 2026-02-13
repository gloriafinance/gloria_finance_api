import nodemailer = require("nodemailer")

import configEngineHTML from "./ConfigEngineHTML.service"
import type { Mail } from "../domain/types/mail.type"
import { Logger } from "@/Shared/adapter"

const configTransportMail = async () => {
  const logger = Logger("configTransportMail")

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      type: "OAuth2",
      user: "gloriafinance@jaspesoft.com",
      serviceClient: process.env.SEND_MAIL_CLIENT_ID,
      privateKey: process.env.SEND_MAIL_PRIVATE_KEY,
    },
  })

  try {
    await transporter.verify()

    await configEngineHTML(transporter)

    return transporter
  } catch (error) {
    logger.error(`${error}`)
    throw error
  }
}

export const SendMailService = async (payload: Mail) => {
  const logger = Logger("SendMailService")

  const transport = await configTransportMail()

  logger.info(`Configuraciones del email`)

  const webapp = process.env.WEBAPP_URL
  const attachments = payload.attachments?.map((attachment) => ({
    filename: attachment.filename,
    content: Buffer.from(attachment.contentBase64, "base64"),
    contentType: attachment.contentType,
  }))

  const HelperOptions = {
    from: '"Gloria Finance" <support@gloriafinance.com.br>',
    to: payload.to,
    subject: payload.subject,
    template: `${payload.template}`,
    context: {
      ...payload.context,
      webapp,
      client: payload.clientName,
      year: new Date().getFullYear(),
    },
    attachments,
  }

  logger.info(
    `Enviando email a ${payload.to}, subject ${
      payload.subject
    } template ${payload.template}, attachments ${
      attachments?.length || 0
    }, context
      ${JSON.stringify(HelperOptions.context)}`
  )

  await transport.sendMail(HelperOptions)

  logger.info(`Correo enviado con exito`)
}

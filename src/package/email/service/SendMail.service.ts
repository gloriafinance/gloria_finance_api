import nodemailer = require("nodemailer")

import configEngineHTML from "./ConfigEngineHTML.service"
import type { Mail } from "../domain/types/mail.type"
import { Logger } from "@/Shared/adapter"

const configTransportMail = async () => {
  const logger = Logger("configTransportMail")
  const mailUser = process.env.SEND_MAIL_USER
  const serviceClient = process.env.SEND_MAIL_SERVICE_CLIENT_EMAIL
  const privateKey = process.env.SEND_MAIL_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!mailUser) {
    throw new Error(
      "Missing SEND_MAIL_USER. Define the Workspace mailbox to impersonate"
    )
  }

  if (!serviceClient) {
    throw new Error(
      "Missing service account email. Define SEND_MAIL_SERVICE_CLIENT_EMAIL with value like xxx@yyy.iam.gserviceaccount.com"
    )
  }

  if (!serviceClient.includes("@")) {
    throw new Error(
      "Invalid service account email for XOAUTH2. SEND_MAIL_SERVICE_CLIENT_EMAIL must be a service account email (not numeric client_id)"
    )
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      type: "OAuth2",
      user: mailUser,
      serviceClient,
      privateKey,
      scope: "https://mail.google.com/",
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
  const mailFrom = process.env.SEND_MAIL_USER

  if (!mailFrom) {
    throw new Error("Missing SEND_MAIL_USER")
  }

  const transport = await configTransportMail()

  logger.info(`Configuraciones del email`)

  const webapp = process.env.WEBAPP_URL
  const attachments = payload.attachments?.map((attachment) => ({
    filename: attachment.filename,
    content: Buffer.from(attachment.contentBase64, "base64"),
    contentType: attachment.contentType,
  }))

  const HelperOptions = {
    from: `"Gloria Finance" <${mailFrom}>`,
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

  const result = await transport.sendMail(HelperOptions)

  logger.info(
    `Resultado SMTP messageId=${result.messageId} accepted=${
      result.accepted?.join(",") || ""
    } rejected=${result.rejected?.join(",") || ""} response=${result.response}`
  )

  if (result.rejected && result.rejected.length > 0) {
    throw new Error(`SMTP rejected recipients: ${result.rejected.join(",")}`)
  }

  logger.info(`Correo enviado con exito`)
}

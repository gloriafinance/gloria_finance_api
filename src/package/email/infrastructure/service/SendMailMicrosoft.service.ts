import nodemailer = require("nodemailer")

import configEngineHTML from "./ConfigEngineHTML.service.ts"
import type { Mail } from "../../domain/types/mail.type.ts"
import { Logger } from "@/Shared/adapter"

type MicrosoftAccessTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type RenderedMail = {
  html?: string
}

type CachedAccessToken = {
  value: string
  expiresAt: number
}

let cachedAccessToken: CachedAccessToken | undefined

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

const getMicrosoftAccessToken = async (): Promise<string> => {
  const now = Date.now()

  if (cachedAccessToken && cachedAccessToken.expiresAt > now) {
    return cachedAccessToken.value
  }

  const tenantId = requireEnv("SEND_MAIL_MICROSOFT_TENANT_ID")
  const clientId = requireEnv("SEND_MAIL_MICROSOFT_CLIENT_ID")
  const clientSecret = requireEnv("SEND_MAIL_MICROSOFT_CLIENT_SECRET")

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  })

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  )

  const rawResponse = await response.text()
  let tokenResponse: MicrosoftAccessTokenResponse

  try {
    tokenResponse = JSON.parse(rawResponse) as MicrosoftAccessTokenResponse
  } catch {
    throw new Error(
      `Microsoft OAuth returned an invalid response (${response.status}): ${rawResponse}`
    )
  }

  if (!response.ok || !tokenResponse.access_token) {
    throw new Error(
      `Microsoft OAuth failed (${response.status}): ${
        tokenResponse.error_description || tokenResponse.error || rawResponse
      }`
    )
  }

  const expiresInSeconds = tokenResponse.expires_in ?? 3600
  const cacheLifetimeSeconds = Math.max(expiresInSeconds - 60, 0)

  cachedAccessToken = {
    value: tokenResponse.access_token,
    expiresAt: now + cacheLifetimeSeconds * 1000,
  }

  return tokenResponse.access_token
}

const renderMailHtml = async (
  payload: Mail,
  mailFrom: string
): Promise<string> => {
  const renderer = nodemailer.createTransport({ jsonTransport: true })
  await configEngineHTML(renderer)

  const webapp = process.env.WEBAPP_URL
  const result = await renderer.sendMail({
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
  })

  const rawMessage = Buffer.isBuffer(result.message)
    ? result.message.toString("utf8")
    : result.message

  const rendered =
    typeof rawMessage === "string"
      ? (JSON.parse(rawMessage) as RenderedMail)
      : (rawMessage as RenderedMail)

  if (!rendered?.html) {
    throw new Error(`Unable to render email template ${payload.template}`)
  }

  return rendered.html
}

export const SendMailMicrosoftService = async (payload: Mail) => {
  const logger = Logger("SendMailMicrosoftService")
  const mailFrom = requireEnv("SEND_MAIL_USER")

  const [accessToken, html] = await Promise.all([
    getMicrosoftAccessToken(),
    renderMailHtml(payload, mailFrom),
  ])

  const attachments = payload.attachments?.map((attachment) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: attachment.filename,
    contentType: attachment.contentType || "application/octet-stream",
    contentBytes: attachment.contentBase64,
  }))

  const message = {
    subject: payload.subject,
    body: {
      contentType: "HTML",
      content: html,
    },
    toRecipients: [
      {
        emailAddress: {
          address: payload.to,
        },
      },
    ],
    ...(attachments?.length ? { attachments } : {}),
  }

  logger.info(
    `Enviando email via Microsoft Graph a ${payload.to}, subject ${
      payload.subject
    } template ${payload.template}, attachments ${attachments?.length || 0}`
  )

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailFrom)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        saveToSentItems: true,
      }),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    logger.error(
      `Microsoft Graph sendMail failed status=${response.status} body=${errorBody}`
    )
    throw new Error(
      `Microsoft Graph sendMail failed (${response.status}): ${errorBody}`
    )
  }

  logger.info(
    `Correo enviado con exito via Microsoft Graph status=${response.status}`
  )
}

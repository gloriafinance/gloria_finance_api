export type MailAttachment = {
  filename: string
  contentBase64: string
  contentType?: string
}

export type Mail = {
  to: string
  subject: string
  template: string
  clientName: string
  context: any
  attachments?: MailAttachment[]
}

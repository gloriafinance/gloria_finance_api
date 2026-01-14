import { IJob } from "../../domain"

const chatId = process.env.TELEGRAM_CHAT_ID

const telegramToken = process.env.TELEGRAM_BOT_TOKEN

const TelegramSendMessage = async (message: string) => {
  const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(errorBody || response.statusText)
    }
  } catch (error: any) {
    console.error("Error al enviar el mensaje:", error?.message || error)
  }
}

export class TelegramNotificationJob implements IJob {
  async handle(args: any): Promise<void> {
    await TelegramSendMessage(args.message)
  }
}

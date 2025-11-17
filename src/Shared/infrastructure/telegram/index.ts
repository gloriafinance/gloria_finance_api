import axios from "axios"
import { IQueue } from "../../domain"

const chatId = process.env.TELEGRAM_CHAT_ID

const telegramToken = process.env.TELEGRAM_BOT_TOKEN

const TelegramSendMessage = async (message: string) => {
  const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`

  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
    })
  } catch (error) {
    console.error(
      "Error al enviar el mensaje:",
      error.response?.data || error.message
    )
  }
}

export class TelegramNotificationJob implements IQueue {
  async handle(args: any): Promise<void> {
    await TelegramSendMessage(args.message)
  }
}

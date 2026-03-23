import type { SupportAnalysisTarget } from "@/Support/domain/requests/SupportAssistant.request"
import type { File } from "@/Shared/domain/types/file"
import type {
  SupportAssistantIntent,
  SupportAssistantResponse,
} from "@/Support/domain/types/SupportAssistant.response"

export type SupportConversationAttachment = {
  name: string
  mimeType: string
  size: number
  dataBase64: string
}

export type SupportConversation = {
  conversationId: string
  churchId: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export type SupportConversationSummary = Pick<
  SupportConversation,
  "conversationId" | "title" | "createdAt" | "updatedAt"
>

export type SupportConversationTurn = {
  conversationId: string
  churchId: string
  userId: string
  question: string
  answer: string
  intent: SupportAssistantIntent
  response: SupportAssistantResponse
  analysisTarget?: SupportAnalysisTarget
  attachments?: SupportConversationAttachment[]
  sources: string[]
  createdAt: string
}

export type SupportConversationHistoryEntry = Pick<
  SupportConversationTurn,
  | "question"
  | "answer"
  | "intent"
  | "response"
  | "analysisTarget"
  | "attachments"
  | "sources"
  | "createdAt"
>

export type AppendSupportConversationTurnParams = {
  conversationId: string
  churchId: string
  userId: string
  question: string
  analysisTarget?: SupportAnalysisTarget
  files?: File[]
  response: SupportAssistantResponse
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import { promises as fs } from "node:fs"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import { PermissionMiddleware } from "@/Shared/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import type { File } from "@/Shared/domain/types/file"
import { GenericException } from "@/Shared/domain"
import type { SupportAssistantRequest } from "@/Support/domain/requests/SupportAssistant.request"
import { SupportAssistantAgent } from "@/Support/infrastructure/agents/SupportAssistant.agent"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { SupportConversationMemoryService } from "@/Support/infrastructure/services/SupportConversationMemory.service"

@Controller("/api/v1/ai/support")
export class SupportAssistantController {
  constructor(
    private readonly conversationMemory = new SupportConversationMemoryService()
  ) {}

  @Post("/")
  @Use([PermissionMiddleware])
  async support(
    @Body() body: SupportAssistantRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      if (!req.auth.userId) {
        throw new GenericException(
          "Authenticated user is required for support conversations"
        )
      }

      const files = await this.normalizeFiles(req.files?.file)
      const concepts =
        await FinancialConceptMongoRepository.getInstance().search({
          churchId: req.auth.churchId,
          active: true,
        })
      const conversation = await this.conversationMemory.resolveConversation({
        churchId: req.auth.churchId,
        userId: req.auth.userId,
        question: body.question,
        analysisTarget: body.analysisTarget,
        conversationId: body.conversationId,
      })

      const response = await new SupportAssistantAgent().execute({
        question: body.question,
        analysisTarget: body.analysisTarget,
        files,
        churchId: req.auth.churchId,
        lang: req.auth.lang,
        financialConcepts: concepts,
        conversationHistory: conversation.history,
      })

      await this.conversationMemory.appendTurn({
        conversationId: conversation.conversationId,
        churchId: req.auth.churchId,
        userId: req.auth.userId,
        question: body.question,
        analysisTarget: body.analysisTarget,
        files,
        response,
      })

      res.status(HttpStatus.OK).send({
        ...response,
        conversationId: conversation.conversationId,
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/conversations")
  @Use([PermissionMiddleware])
  async listConversations(
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      if (!req.auth.userId) {
        throw new GenericException(
          "Authenticated user is required for support conversations"
        )
      }

      const conversations =
        await this.conversationMemory.listRecentConversations({
          churchId: req.auth.churchId,
          userId: req.auth.userId,
        })

      res.status(HttpStatus.OK).send(conversations)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/conversations/:conversationId")
  @Use([PermissionMiddleware])
  async getConversation(
    @Param("conversationId") conversationId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      if (!req.auth.userId) {
        throw new GenericException(
          "Authenticated user is required for support conversations"
        )
      }

      const messages = await this.conversationMemory.loadConversationTurns({
        churchId: req.auth.churchId,
        userId: req.auth.userId,
        conversationId,
      })

      res.status(HttpStatus.OK).send({
        conversationId,
        messages,
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Delete("/conversations/:conversationId")
  @Use([PermissionMiddleware])
  async deleteConversation(
    @Param("conversationId") conversationId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      if (!req.auth.userId) {
        throw new GenericException(
          "Authenticated user is required for support conversations"
        )
      }

      await this.conversationMemory.deleteConversation({
        churchId: req.auth.churchId,
        userId: req.auth.userId,
        conversationId,
      })

      res.status(HttpStatus.OK).send({
        conversationId,
        deleted: true,
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  private async normalizeFiles(input: unknown): Promise<File[]> {
    const rawFiles = Array.isArray(input) ? input : input ? [input] : []
    const normalized: File[] = []

    for (const rawFile of rawFiles) {
      const file = rawFile as Record<string, unknown>
      const name =
        typeof file.name === "string"
          ? file.name
          : typeof file.filename === "string"
            ? file.filename
            : "upload"
      const mimeType =
        typeof file.mimeType === "string"
          ? file.mimeType
          : typeof file.mimetype === "string"
            ? file.mimetype
            : "application/octet-stream"

      let data: Buffer | undefined
      if (Buffer.isBuffer(file.data)) {
        data = file.data
      } else if (typeof file.arrayBuffer === "function") {
        data = Buffer.from(
          await (file.arrayBuffer as () => Promise<ArrayBuffer>)()
        )
      } else {
        const filePath =
          typeof file.tempFilePath === "string"
            ? file.tempFilePath
            : typeof file.path === "string"
              ? file.path
              : typeof file.filePath === "string"
                ? file.filePath
                : undefined

        if (filePath) {
          data = await fs.readFile(filePath)
        }
      }

      if (!data) continue

      normalized.push({
        name,
        mimeType,
        data,
      })
    }

    return normalized
  }
}

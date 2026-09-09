import { Logger } from "@/Shared/adapter"
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  type ServerResponse,
} from "bun-platform-kit"
import { ProcessAsaasTransactionService } from "../../services/ProcessAsaasTransaction.service.ts"
import type { ChurchBankingWebhookRequest } from "../ChurchBankingWebhookBun.adapter.ts"
import {
  ChurchBankingWebhookVerificationError,
  ChurchBankingWebhookVerifier,
  churchBankingWebhookVerifier,
} from "../ChurchBankingWebhookVerifier.ts"

type WebhookVerifier = Pick<ChurchBankingWebhookVerifier, "verify">

type payloadWebhook = {
  id: string
  externalAccountId: string
  accountId: string
  data: {
    payment: {
      amountInCents: number
      status: "RECEIVED" | "REFUNDED"
      paymentDate: string
      transactionReceiptUrl: string
      externalReference: string
    }
  }
}

@Controller("/webhooks")
export class ChurchBankingController {
  private logger = Logger(ChurchBankingController.name)

  constructor(
    private readonly verifier: WebhookVerifier = churchBankingWebhookVerifier
  ) {}

  @Post("/church-banking")
  async receive(
    @Body() body: payloadWebhook,
    @Req() req: ChurchBankingWebhookRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await this.verifier.verify({
        authorization: req.headers.authorization,
        method: req.method,
        path: req.path,
        rawBody: req.rawBody,
      })

      this.logger.info(
        "Received an authenticated Church Banking webhook request.",
        body
      )

      await new ProcessAsaasTransactionService().handle({
        id: body.id,
        bankId: body.accountId,
        churchId: body.externalAccountId,
        amount: Number(body.data.payment.amountInCents) / 100,
        date: body.data.payment.paymentDate,
        invoice: body.data.payment.transactionReceiptUrl,
        financialConceptId: body.data.payment.externalReference,
        status: body.data.payment.status,
      })

      res.status(200).send({ message: "ok" })
    } catch (error) {
      if (error instanceof ChurchBankingWebhookVerificationError) {
        res.status(error.status).send({ code: error.code })
        return
      }
      throw error
    }
  }
}

// function webhookLogContext(body: unknown): Record<string, unknown> {
//   if (typeof body !== "object" || body === null || Array.isArray(body))
//     return {}
//
//   const event = body as Record<string, unknown>
//   return {
//     eventId: typeof event.id === "string" ? event.id : undefined,
//     type: typeof event.type === "string" ? event.type : undefined,
//     requestId:
//       typeof event.requestId === "string" ? event.requestId : undefined,
//     externalAccountId:
//       typeof event.externalAccountId === "string"
//         ? event.externalAccountId
//         : undefined,
//   }
//}

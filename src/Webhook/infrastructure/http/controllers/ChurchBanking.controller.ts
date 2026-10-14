import { Logger } from "@/Shared/adapter"
import domainResponse from "@/Shared/helpers/domainResponse.ts"
import { HttpStatus } from "@/Shared/domain"
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  type ServerResponse,
} from "bun-platform-kit"
import { ProcessAsaasTransactionService } from "../../services/ProcessAsaasTransaction.service.ts"
import {
  ProcessRecurringPaymentBankingUpdate,
  type BillPaymentUpdatedEvent,
  type PixTransferUpdatedEvent,
} from "../../services/ProcessRecurringPaymentBankingUpdate.service.ts"
import type { ChurchBankingWebhookRequest } from "../ChurchBankingWebhookBun.adapter.ts"
import {
  ChurchBankingWebhookVerificationError,
  ChurchBankingWebhookVerifier,
  churchBankingWebhookVerifier,
} from "../ChurchBankingWebhookVerifier.ts"

type WebhookVerifier = Pick<ChurchBankingWebhookVerifier, "verify">

type BankingPaymentUpdatedEvent = {
  id: string
  type: "BANKING_PAYMENT_UPDATED"
  externalAccountId: string
  accountId: string
  data: {
    payment: {
      amountInCents: number
      transactionFeeInCents: number
      platformFeeInCents: number
      status: "RECEIVED" | "REFUNDED"
      paymentDate: string
      transactionReceiptUrl: string
      externalReference: string
      payer?: { name: string; cpfCnpj: string }
    }
  }
}

type ChurchBankingWebhookEvent =
  | BankingPaymentUpdatedEvent
  | (PixTransferUpdatedEvent & { type: "BANKING_PIX_TRANSFER_UPDATED" })
  | (BillPaymentUpdatedEvent & { type: "BANKING_BILL_PAYMENT_UPDATED" })

@Controller("/webhooks")
export class ChurchBankingController {
  private logger = Logger(ChurchBankingController.name)

  constructor(
    private readonly verifier: WebhookVerifier = churchBankingWebhookVerifier,
    private readonly recurringPaymentWebhook = new ProcessRecurringPaymentBankingUpdate()
  ) {}

  @Post("/church-banking")
  async receive(
    @Body() body: ChurchBankingWebhookEvent,
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

      if (!isWebhookEvent(body)) {
        res
          .status(HttpStatus.BAD_REQUEST)
          .send({ code: "CHURCH_BANKING_WEBHOOK_PAYLOAD_INVALID" })
        return
      }
      this.logger.info("Received authenticated Church Banking webhook", {
        id: body.id,
        type: body.type,
      })

      if (body.type === "BANKING_PAYMENT_UPDATED") {
        const payment = body.data.payment
        await new ProcessAsaasTransactionService().handle({
          id: body.id,
          bankId: body.accountId,
          churchId: body.externalAccountId,
          amount: Number(payment.amountInCents) / 100,
          transactionFeeInCents: payment.transactionFeeInCents,
          platformFeeInCents: payment.platformFeeInCents,
          date: payment.paymentDate,
          invoice: payment.transactionReceiptUrl,
          externalReference: payment.externalReference,
          status: payment.status,
          payer: payment.payer,
        })
      } else if (body.type === "BANKING_PIX_TRANSFER_UPDATED") {
        await this.recurringPaymentWebhook.processPix(body)
      } else {
        await this.recurringPaymentWebhook.processBill(body)
      }

      res.status(HttpStatus.OK).send({ message: "ok" })
    } catch (error) {
      this.logger.error("Error processing Church Banking webhook request", {
        error,
      })

      if (error instanceof ChurchBankingWebhookVerificationError) {
        res.status(error.status).send({ code: error.code })
        return
      }

      domainResponse(error, res)
    }
  }
}

function isWebhookEvent(value: unknown): value is ChurchBankingWebhookEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false
  const body = value as Record<string, unknown>
  if (
    typeof body.id !== "string" ||
    typeof body.occurredAt !== "string" ||
    typeof body.externalAccountId !== "string" ||
    typeof body.accountId !== "string"
  )
    return false
  if (body.type === "BANKING_PAYMENT_UPDATED") {
    if (!isRecord(body.data) || !isRecord(body.data.payment)) return false
    const payment = body.data.payment
    return (
      typeof payment.amountInCents === "number" &&
      typeof payment.transactionFeeInCents === "number" &&
      typeof payment.platformFeeInCents === "number" &&
      (payment.status === "RECEIVED" || payment.status === "REFUNDED") &&
      typeof payment.paymentDate === "string" &&
      typeof payment.transactionReceiptUrl === "string" &&
      typeof payment.externalReference === "string" &&
      (payment.payer === undefined || isRecord(payment.payer))
    )
  }
  if (body.type === "BANKING_PIX_TRANSFER_UPDATED") {
    if (!isRecord(body.data) || !isRecord(body.data.pixTransfer)) return false
    const transfer = body.data.pixTransfer
    return (
      typeof transfer.providerTransferId === "string" &&
      typeof transfer.status === "string" &&
      typeof transfer.amountInCents === "number" &&
      typeof transfer.externalReference === "string" &&
      isRecord(transfer.context) &&
      (typeof transfer.transactionReceiptUrl === "string" ||
        transfer.transactionReceiptUrl === null) &&
      (typeof transfer.failureCode === "string" ||
        transfer.failureCode === null)
    )
  }
  if (body.type === "BANKING_BILL_PAYMENT_UPDATED") {
    if (!isRecord(body.data) || !isRecord(body.data.billPayment)) return false
    const bill = body.data.billPayment
    return (
      typeof bill.providerBillId === "string" &&
      typeof bill.status === "string" &&
      typeof bill.externalReference === "string" &&
      isRecord(bill.context) &&
      (typeof bill.paymentDate === "string" || bill.paymentDate === null) &&
      (typeof bill.transactionReceiptUrl === "string" ||
        bill.transactionReceiptUrl === null) &&
      (typeof bill.failureCode === "string" || bill.failureCode === null)
    )
  }
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

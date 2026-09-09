import {
  AvailabilityAccountMongoRepository,
  FinancialConceptMongoRepository,
} from "@/FinanceConfig/infrastructure/presistence"
import { DispatchCreateFinancialRecord } from "@/Financial/applications"
import {
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
} from "@/Financial/domain"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure"
import { QueueService } from "@/package/queue/infrastructure"
import { Logger, Urn } from "@/Shared/adapter"
import { StorageProviderService } from "@/Shared/infrastructure"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { SocketIOService } from "@/bootstrap"
import { RealTimeEvent } from "@/Shared/domain"

type Operation = {
  id: string
  bankId: string
  churchId: string
  amount: number
  date: string
  invoice: string
  financialConceptId?: string
  status: "RECEIVED" | "REFUNDED"
  payer?: { name: string; cpfCnpj: string }
}

export class ProcessAsaasTransactionService {
  private logger = Logger(ProcessAsaasTransactionService.name)

  constructor(
    private readonly availabilityAccountRepository = AvailabilityAccountMongoRepository.getInstance(),
    private readonly financialConceptRepository = FinancialConceptMongoRepository.getInstance(),
    private readonly financeRecordRepository = FinanceRecordMongoRepository.getInstance()
  ) {}

  async handle(input: Operation) {
    this.logger.info("Processing Asaas transaction", input)

    const financialRecordId = Urn.create({
      entity: "financialRecord",
      entityId: input.id,
    })

    const exists = await this.financeRecordRepository.one({ financialRecordId })
    if (exists) {
      this.logger.info(
        `Financial record with ID ${financialRecordId} already exists. Skipping processing.`,
        input
      )
      return
    }

    if (input.status === "RECEIVED") {
      const concept = await this.financialConceptRepository.one({
        financialConceptId: input.financialConceptId!,
      })

      if (!concept) {
        this.logger.error(
          `Financial concept with ID ${input.financialConceptId} not found.`,
          input
        )

        throw new Error(
          `Financial concept with ID ${input.financialConceptId} not found.`
        )
      }

      const availabilityAccount = await this.availabilityAccountRepository.one({
        "source.bankId": input.bankId,
      })

      if (!availabilityAccount) {
        this.logger.error(
          `Availability account with bank ID ${input.bankId} not found.`,
          input
        )

        throw new Error(
          `Availability account with bank ID ${input.bankId} not found.`
        )
      }

      const voucher = await this.saveReceipt(input.id, input.invoice)

      let description = concept?.getDescription()!

      if (input.payer && concept.getTag() === "Tithes") {
        description += ":" + input.payer?.name
      }

      await Promise.all([
        new DispatchCreateFinancialRecord(QueueService.getInstance()).execute({
          voucher,
          availabilityAccount,
          financialRecordId: Urn.create({
            entity: "financialRecord",
            entityId: input.id,
          }),
          createdBy: "system",
          description,
          financialConcept: concept!,
          financialRecordType: FinancialRecordType.INCOME,
          source: FinancialRecordSource.AUTO,
          status: FinancialRecordStatus.RECONCILED,
          churchId: input.churchId,
          amount: input.amount,
          date: new Date(input.date),
        }),
        this.notify(input.payer),
      ])

      return
    }
  }

  private async notify(payer?: { name: string; cpfCnpj: string }) {
    if (!payer) {
      return
    }

    const cpfCnpjFormat = (str: string) => {
      const nro = str.replace(/\D/g, "")

      if (nro.length === 11) {
        // CPF: 123.456.789-09
        return `${nro.substring(0, 3)}.${nro.substring(3, 6)}.${nro.substring(6, 9)}-${nro.substring(9)}`
      } else if (nro.length === 14) {
        // CNPJ: 12.345.678/0001-95
        return `${nro.substring(0, 2)}.${nro.substring(2, 5)}.${nro.substring(5, 8)}/${nro.substring(8, 12)}-${nro.substring(12)}`
      }
    }

    const doc = cpfCnpjFormat(payer.cpfCnpj)

    const member = await MemberMongoRepository.getInstance().one({
      dni: doc,
    })

    if (member) {
      SocketIOService.getInstance().notifyClient(
        member.getMemberId(),
        RealTimeEvent.PaidPix,
        { payment: "finish" }
      )
    }
  }

  private async saveReceipt(
    id: string,
    transactionReceiptUrl: string
  ): Promise<string | undefined> {
    // 1. Resolver URL real del PDF
    const pdfUrl = await this.getAsaasReceiptPdfUrl(transactionReceiptUrl)

    // 2. Descargar PDF
    const response = await fetch(pdfUrl)

    if (!response.ok) {
      this.logger.error(`Error downloading Asaas receipt: ${response.status}`, {
        id,
        transactionReceiptUrl,
        pdfUrl,
      })

      return undefined
    }

    const contentType = response.headers.get("content-type")

    if (!contentType?.includes("application/pdf")) {
      this.logger.error(`Expected PDF but received ${contentType}`, {
        id,
        transactionReceiptUrl,
        pdfUrl,
      })
      return undefined
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    return await StorageProviderService.getInstance().uploadFile({
      data: buffer,
      mimetype: "application/pdf",
      originalname: `comprovante-${id}.pdf`,
    })
  }

  private async getAsaasReceiptPdfUrl(
    transactionReceiptUrl: string
  ): Promise<string> {
    const receiptUrl = new URL(transactionReceiptUrl)

    if (receiptUrl.hostname !== "www.asaas.com") {
      throw new Error("Invalid Asaas receipt URL")
    }

    const response = await fetch(receiptUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch Asaas receipt page: ${response.status}`)
    }

    const html = await response.text()

    const match = html.match(
      /href=["']([^"']*\/transactionReceipt\/pdf\/[^"']+)["']/i
    )

    if (!match) {
      throw new Error("Asaas PDF receipt URL not found")
    }

    return new URL(match[1]!, "https://www.asaas.com").toString()
  }
}

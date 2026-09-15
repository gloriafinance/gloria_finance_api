import { SocketIOService } from "@/bootstrap"
import { Member } from "@/Church/domain"
import {
  ChurchMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import {
  AvailabilityAccountMongoRepository,
  FinancialConceptMongoRepository,
} from "@/FinanceConfig/infrastructure/presistence"
import {
  DispatchCreateFinancialRecord,
  RegisterContributionsOnline,
} from "@/Financial/applications"
import {
  FinancialConcept,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
  OnlineContributionsStatus,
} from "@/Financial/domain"
import {
  FinanceRecordMongoRepository,
  OnlineContributionsMongoRepository,
} from "@/Financial/infrastructure"
import { QueueService } from "@/package/queue/infrastructure"
import { Logger, Urn } from "@/Shared/adapter"
import {
  AmountValue,
  PaymentAmountExceedsPending,
  RealTimeEvent,
} from "@/Shared/domain"
import { StorageProviderService } from "@/Shared/infrastructure"
import {
  AccountReceivable,
  AccountReceivableNotFound,
} from "@/AccountsReceivable/domain"
import { PayAccountReceivable } from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"

type Operation = {
  id: string
  bankId: string
  churchId: string
  amount: number
  transactionFeeInCents: number
  platformFeeInCents: number
  date: string
  invoice: string
  externalReference: string
  status: "RECEIVED" | "REFUNDED"
  payer?: { name: string; cpfCnpj: string }
}

export class ProcessAsaasTransactionService {
  private logger = Logger(ProcessAsaasTransactionService.name)

  constructor(
    private readonly availabilityAccountRepository = AvailabilityAccountMongoRepository.getInstance(),
    private readonly financialConceptRepository = FinancialConceptMongoRepository.getInstance(),
    private readonly financeRecordRepository = FinanceRecordMongoRepository.getInstance(),
    private readonly churchRepository = ChurchMongoRepository.getInstance()
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
      await this.paymentIncome(input, financialRecordId)
      return
    }
  }

  private async paymentIncome(input: Operation, financialRecordId: string) {
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

    const church = await this.churchRepository.one({ churchId: input.churchId })

    const voucher = await this.saveReceipt(input.id, input.invoice)
    const member = await this.lookMember(input.payer)

    if (input.externalReference.startsWith("urn:accountReceivable:")) {
      await this.paymentAccountReceivable({
        input,
        financialRecordId,
        availabilityAccountId: availabilityAccount.getAvailabilityAccountId(),
        voucher,
        member,
        symbol: church?.getSymbolFormatMoney()!,
      })
      return
    }

    const concept = await this.financialConceptRepository.one({
      financialConceptId: input.externalReference,
    })

    if (!concept) {
      this.logger.error(
        `Financial concept with ID ${input.externalReference} not found.`,
        input
      )

      throw new Error(
        `Financial concept with ID ${input.externalReference} not found.`
      )
    }

    let description = concept.getDescription()

    if (input.payer && concept.getTag() === "Tithes") {
      description += ":" + input.payer.name
    }

    await Promise.all([
      new DispatchCreateFinancialRecord(QueueService.getInstance()).execute({
        voucher,
        availabilityAccount,
        financialRecordId,
        createdBy: "system",
        description,
        financialConcept: concept,
        financialRecordType: FinancialRecordType.INCOME,
        source: FinancialRecordSource.AUTO,
        status: FinancialRecordStatus.RECONCILED,
        churchId: input.churchId,
        amount: input.amount,
        date: new Date(input.date),
      }),
      this.notify(member),
      this.recordHistoryInContributions({ concept, input, voucher, member }),
    ])
  }

  private async paymentAccountReceivable(params: {
    input: Operation
    financialRecordId: string
    availabilityAccountId: string
    voucher?: string
    member: Member | null
    symbol: string
  }) {
    const {
      input,
      financialRecordId,
      availabilityAccountId,
      voucher,
      member,
      symbol,
    } = params

    const account = await AccountsReceivableMongoRepository.getInstance().one({
      accountReceivableId: input.externalReference,
      churchId: input.churchId,
    })

    if (!account) {
      throw new AccountReceivableNotFound()
    }

    if (input.amount > account.getAmountPending()) {
      throw new PaymentAmountExceedsPending()
    }

    const installmentIds = this.installmentIdsForPayment(account, input.amount)

    await new PayAccountReceivable(
      this.financialConceptRepository,
      this.availabilityAccountRepository,
      AccountsReceivableMongoRepository.getInstance(),
      QueueService.getInstance()
    ).execute({
      accountReceivableId: account.getAccountReceivableId(),
      installmentId: installmentIds[0]!,
      installmentIds,
      financialTransactionId: input.id,
      financialRecordId,
      availabilityAccountId,
      churchId: input.churchId,
      amount: AmountValue.create(input.amount),
      date: new Date(input.date),
      voucher,
      concept: account.getFinancialConcept().getName(),
      createdBy: "system",
      symbol,
    })

    await Promise.all([
      this.notify(member),
      this.recordHistoryInContributions({
        concept: account.getFinancialConcept(),
        input,
        voucher,
        member,
        accountReceivableId: account.getAccountReceivableId(),
      }),
    ])
  }

  private installmentIdsForPayment(
    account: AccountReceivable,
    amount: number
  ): string[] {
    let remaining = amount
    const installmentIds: string[] = []

    for (const installment of account.getInstallments()) {
      if (remaining <= 0) break

      const amountPending = installment.amountPending ?? installment.amount
      if (amountPending <= 0) continue

      installmentIds.push(installment.installmentId!)
      remaining -= Math.min(remaining, amountPending)
    }

    if (installmentIds.length === 0 || remaining > 0) {
      throw new PaymentAmountExceedsPending()
    }

    return installmentIds
  }

  private async notify(member: Member | null) {
    if (!member) {
      this.logger.info(
        "No member found for the payer. Skipping real-time notification.",
        member || {}
      )
      return
    }

    SocketIOService.getInstance().notifyClient(
      member.getMemberId(),
      RealTimeEvent.PaidPix,
      { payment: "finish" }
    )
  }

  private async lookMember(payer?: { name: string; cpfCnpj: string }) {
    if (!payer) {
      return null
    }

    const cpfCnpjFormat = (str: string) => {
      const nro = str.replace(/\D/g, "")

      if (nro.length === 11) {
        return `${nro.substring(0, 3)}.${nro.substring(3, 6)}.${nro.substring(6, 9)}-${nro.substring(9)}`
      } else if (nro.length === 14) {
        return `${nro.substring(0, 2)}.${nro.substring(2, 5)}.${nro.substring(5, 8)}/${nro.substring(8, 12)}-${nro.substring(12)}`
      }
    }

    const doc = cpfCnpjFormat(payer.cpfCnpj)

    return await MemberMongoRepository.getInstance().one({
      dni: doc,
    })
  }

  private async recordHistoryInContributions(params: {
    concept: FinancialConcept
    input: Operation
    voucher?: string
    member: Member | null
    accountReceivableId?: string
  }) {
    const { voucher, member, input, concept, accountReceivableId } = params

    if (!member) {
      this.logger.info(
        `No member found for payer ${input.payer?.name} with CPF/CNPJ ${input.payer?.cpfCnpj}. Skipping contribution registration.`,
        input
      )
      return
    }

    await new RegisterContributionsOnline(
      OnlineContributionsMongoRepository.getInstance(),
      StorageProviderService.getInstance(),
      FinancialYearMongoRepository.getInstance()
    ).execute(
      {
        status: OnlineContributionsStatus.PROCESSED,
        amount: input.amount,
        observation: "",
        paidAt: input.date,
        bankTransferReceipt: voucher,
        accountReceivableId,
      },
      member,
      concept
    )
  }

  private async saveReceipt(
    id: string,
    transactionReceiptUrl: string
  ): Promise<string | undefined> {
    const pdfUrl = await this.getAsaasReceiptPdfUrl(transactionReceiptUrl)

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

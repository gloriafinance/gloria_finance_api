import { Logger } from "@/Shared/adapter/CustomLogger"
import { type IQueueService, QueueName } from "@/package/queue/domain"
import { Bank, type ImportBankStatementRequest } from "@/Banking/domain"
import type { IAvailabilityAccountRepository } from "@/Financial/domain/interfaces"
import { AvailabilityAccountNotFound } from "@/Financial/domain"

type ImportBankStatementUseCaseRequest = Omit<
  ImportBankStatementRequest,
  "bankId"
> & {
  bank: Bank
}

export class ImportBankStatement {
  private readonly logger = Logger(ImportBankStatement.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(request: ImportBankStatementUseCaseRequest): Promise<{
    queuedAt: Date
  }> {
    this.logger.info("Queueing bank statement import", {
      bank: { ...request.bank.toPrimitives() },
      churchId: request.churchId,
      month: request.month,
      year: request.year,
      uploadedBy: request.uploadedBy,
    })

    const availabilityAccount = await this.availabilityAccountRepository.one({
      "source.bankId": request.bank.getBankId(),
      churchId: request.churchId,
    })

    if (!availabilityAccount) {
      throw new AvailabilityAccountNotFound()
    }

    this.queueService.dispatch(QueueName.ImportBankStatementJob, {
      churchId: request.churchId,
      bank: request.bank.toPrimitives(),
      availabilityAccount: {
        accountName: availabilityAccount.getAccountName(),
        availabilityAccountId: availabilityAccount.getAvailabilityAccountId(),
      },
      month: request.month,
      year: request.year,
      fileContent: request.fileContent,
      uploadedBy: request.uploadedBy,
    })

    return {
      queuedAt: new Date(),
    }
  }
}

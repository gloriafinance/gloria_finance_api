import {
  BankStatementReconciler,
  MovementBankRecordJob,
} from "@/Banking/applications"
import {
  BankMongoRepository,
  BankStatementMongoRepository,
  MovementBankMongoRepository,
} from "@/Banking/infrastructure/persistence"
import { ImportBankStatementJob } from "@/Banking/infrastructure/jobs/ImportBankStatement.job"
import { BankStatementParserFactory } from "@/Banking/infrastructure/parsers/BankStatementParserFactory"
import { QueueService } from "@/Shared/infrastructure"
import type { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import type { IListQueue } from "@/package/queue/domain"

type BankingQueueDeps = {
  financialRecordRepository: IFinancialRecordRepository
}

export const BankingQueue = ({
  financialRecordRepository,
}: BankingQueueDeps): IListQueue[] => [
  {
    name: MovementBankRecordJob.name,
    useClass: MovementBankRecordJob,
    inject: [
      MovementBankMongoRepository.getInstance(),
      BankMongoRepository.getInstance(),
    ],
  },
  {
    name: ImportBankStatementJob.name,
    useClass: ImportBankStatementJob,
    inject: [
      BankStatementParserFactory.getInstance(),
      BankStatementMongoRepository.getInstance(),
      new BankStatementReconciler(
        BankStatementMongoRepository.getInstance(),
        financialRecordRepository,
        QueueService.getInstance()
      ),
      QueueService.getInstance(),
    ],
  },
]

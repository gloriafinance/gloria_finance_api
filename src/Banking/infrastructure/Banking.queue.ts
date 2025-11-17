import { IDefinitionQueue } from "@/Shared/domain"
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
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence"
import { QueueService } from "@/Shared/infrastructure"

export const BankingQueue = (): IDefinitionQueue[] => [
  {
    useClass: MovementBankRecordJob,
    inject: [
      MovementBankMongoRepository.getInstance(),
      BankMongoRepository.getInstance(),
    ],
  },
  {
    useClass: ImportBankStatementJob,
    inject: [
      BankStatementParserFactory.getInstance(),
      BankStatementMongoRepository.getInstance(),
      new BankStatementReconciler(
        BankStatementMongoRepository.getInstance(),
        FinanceRecordMongoRepository.getInstance(),
        QueueService.getInstance()
      ),
      QueueService.getInstance(),
    ],
  },
]

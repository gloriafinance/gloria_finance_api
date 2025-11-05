import { IDefinitionQueue } from "@/Shared/domain"
import { MovementBankRecord } from "@/banking/applications"
import {
  BankMongoRepository,
  MovementBankMongoRepository,
  BankStatementMongoRepository,
} from "@/banking/infrastructure/persistence"
import { ImportBankStatementJob } from "@/banking/infrastructure/jobs/ImportBankStatement.job"
import { BankStatementParserFactory } from "@/banking/infrastructure/parsers/BankStatementParserFactory"
import { BankStatementReconciler } from "@/banking/infrastructure/services/BankStatementReconciler"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence"
import { QueueService } from "@/Shared/infrastructure"

export const BankingQueue = (): IDefinitionQueue[] => [
  {
    useClass: MovementBankRecord,
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

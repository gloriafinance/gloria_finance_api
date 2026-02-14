import type { IListQueue } from "@/package/queue/domain"
import { IncomeStatementJob } from "@/Reports/infrastructure/http/jobs/incomeStatement.job.ts"
import { DREJob } from "@/Reports/infrastructure/http/jobs/DRE.job.ts"

export const ReportQueue = (): IListQueue[] => [
  {
    name: IncomeStatementJob.name,
    useClass: IncomeStatementJob,
  },
  {
    name: DREJob.name,
    useClass: DREJob,
  },
]

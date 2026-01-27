import { ContributionMemberController } from "./ContributionMember.controller"
import { GenerositySummaryController } from "./GenerositySummary.controller"
import { ContributionController } from "./OnlineContribution.controller"
import { FinancialRecordJobController } from "@/Financial/infrastructure/http/controllers/FinancialRecordJob.controller"
import { FinancialRecordController } from "@/Financial/infrastructure/http/controllers/FinancialRecord.controller"

export const financialControllers = () => [
  ContributionMemberController,
  GenerositySummaryController,
  ContributionController,
  FinancialRecordJobController,
  FinancialRecordController,
]

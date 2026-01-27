import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

import { Logger } from "@/Shared/adapter"
import {
  AccountReceivableType,
  AccountsReceivableStatus,
  IAccountsReceivableRepository,
} from "@/AccountsReceivable/domain"
import {
  IOnlineContributionsRepository,
  MemberGenerositySummary,
  OnlineContributionsStatus,
} from "@/Financial/domain"

dayjs.extend(utc)
dayjs.extend(timezone)

type Request = {
  memberId: string
  churchId: string
  debtorDni: string
  timeZone?: string
  now?: Date
}

export class GetMemberGenerositySummary {
  private logger = Logger(GetMemberGenerositySummary.name)

  constructor(
    private readonly contributionRepository: IOnlineContributionsRepository,
    private readonly accountsReceivableRepository: IAccountsReceivableRepository
  ) {}

  async execute(request: Request): Promise<MemberGenerositySummary> {
    const resolvedTimeZone = this.resolveTimeZone(request.timeZone)

    this.logger.info(`Get member generosity summary`, {
      memberId: request.memberId,
      churchId: request.churchId,
      timeZone: resolvedTimeZone,
    })

    const now = this.resolveNow(request.now, resolvedTimeZone)

    const yearRange = {
      start: now.startOf("year").toDate(),
      end: now.endOf("year").toDate(),
    }

    const monthRange = {
      start: now.startOf("month").toDate(),
      end: now.endOf("month").toDate(),
    }

    const contributionTotals =
      await this.contributionRepository.sumByMemberAndPaidAtRanges({
        memberId: request.memberId,
        churchId: request.churchId,
        statuses: [OnlineContributionsStatus.PROCESSED],
        yearRange,
        monthRange,
      })

    const commitmentTotals =
      await this.accountsReceivableRepository.sumPaidInstallmentsByDebtorAndDateRanges(
        {
          churchId: request.churchId,
          debtorDni: request.debtorDni,
          yearRange,
          monthRange,
          types: [AccountReceivableType.CONTRIBUTION],
        }
      )

    const activeCommitments =
      await this.accountsReceivableRepository.countByDebtorAndStatus({
        churchId: request.churchId,
        debtorDni: request.debtorDni,
        statuses: [AccountsReceivableStatus.PENDING],
        types: [AccountReceivableType.CONTRIBUTION, AccountReceivableType.LOAN],
      })

    return {
      contributedYear:
        Number(contributionTotals?.contributedYear ?? 0) +
        Number(commitmentTotals?.contributedYear ?? 0),
      contributedMonth:
        Number(contributionTotals?.contributedMonth ?? 0) +
        Number(commitmentTotals?.contributedMonth ?? 0),
      activeCommitments: Number(activeCommitments ?? 0),
    }
  }

  private resolveTimeZone(timeZone?: string): string {
    if (!timeZone || timeZone.trim().length === 0) {
      return "UTC"
    }

    return timeZone
  }

  private resolveNow(date: Date | undefined, timeZone: string) {
    try {
      return dayjs.tz(date ?? new Date(), timeZone)
    } catch {
      return dayjs.tz(date ?? new Date(), "UTC")
    }
  }
}

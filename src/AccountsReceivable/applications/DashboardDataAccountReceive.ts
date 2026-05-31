import type {
  AccountReceivableDashboardType,
  IAccountsReceivableRepository,
} from "@/AccountsReceivable/domain"

export class DashboardDataAccountReceive {
  constructor(private readonly repository: IAccountsReceivableRepository) {}

  async execute(churchId: string): Promise<AccountReceivableDashboardType> {
    const response = await this.repository.dashboardAccountReceivable(churchId)

    if (response) {
      return response
    }

    return {
      total: 0,
      loans: [],
    }
  }
}

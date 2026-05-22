import type {
  AccountPayablesDashboardType,
  IAccountPayableRepository,
} from "@/AccountsPayable/domain"

export class DashboardDataAccountPayable {
  constructor(private readonly repository: IAccountPayableRepository) {}

  async execute(churchId: string): Promise<AccountPayablesDashboardType> {
    const response = await this.repository.dashboardAccountPayable(churchId)

    if (response) {
      return response
    }

    return {
      total: 0,
      accounts: [],
    }
  }
}

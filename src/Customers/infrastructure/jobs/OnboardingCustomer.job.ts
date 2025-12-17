import { IQueue, IQueueService, QueueName } from "@/Shared/domain"
import { CreateOrUpdateChurch } from "@/Church/applications"
import { ChurchStatus, IChurchRepository } from "@/Church/domain"
import { Customer } from "@/Customers/domain/Customer"
import { Logger } from "@/Shared/adapter"
import { ICustomerRepository } from "@/Customers/domain/interfaces/CustomerRepository.interface"
import {
  CustomerStatus,
  OnboardingStatus,
} from "@/Customers/domain/enums/CustomerStatus.enum"
import { GenerateFinancialMonths } from "@/ConsolidatedFinancial/applications"
import { IFinancialConceptRepository } from "@/Financial/domain/interfaces"
import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { FirstLoadFinancialConcepts } from "@/FinanceConfig/applications"

type OnboardingCustomerJobArgs = {
  customer: Customer
  church: {
    openingDate: Date
    registerNumber?: string
  }
}
export class OnboardingCustomerJob implements IQueue {
  private logger = Logger(OnboardingCustomerJob.name)

  constructor(
    private readonly queueService: IQueueService,
    private readonly churchRepository: IChurchRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly financialYearRepository: IFinancialYearRepository
  ) {}

  async handle(args: OnboardingCustomerJobArgs): Promise<any> {
    this.logger.info(`  started`, args)

    const { church: churchData } = args

    const customer = Customer.fromPrimitives(args.customer)

    const church = await new CreateOrUpdateChurch(
      this.churchRepository
    ).execute({
      ...customer.getAddress(),
      name: customer.getName(),
      status: ChurchStatus.ACTIVE,
      registerNumber: churchData.registerNumber,
      openingDate: churchData.openingDate,
      lang: customer.getLang(),
    })

    customer.setStatus(CustomerStatus.ACTIVE)
    customer.setOnboardingStatus(OnboardingStatus.COMPLETED)
    customer.setTenantId(church.getChurchId())

    await this.customerRepository.upsert(customer)

    await new FirstLoadFinancialConcepts(
      this.financialConceptRepository,
      this.churchRepository
    ).execute({ churchId: church.getChurchId(), lang: customer.getLang() })

    await new GenerateFinancialMonths(this.financialYearRepository).execute({
      churchId: church.getChurchId(),
      year: new Date().getFullYear(),
    })

    this.queueService.dispatch(QueueName.BootstrapPermissionsJob, {
      churchId: church.getChurchId(),
      user: {
        name: customer.getName(),
        email: customer.getEmail(),
      },
    })
  }
}

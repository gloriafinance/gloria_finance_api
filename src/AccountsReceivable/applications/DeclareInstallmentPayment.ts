import { Logger } from "@/Shared/adapter"
import {
  AccountReceivableNotFound,
  DebtorType,
  type DeclareInstallmentPaymentRequest,
  type IAccountsReceivableRepository,
  InstallmentNotFound,
} from "@/AccountsReceivable/domain"
import { RegisterContributionsOnline } from "@/Financial/applications"
import { AmountValue } from "@/Shared/domain"
import type { IMemberRepository } from "@/Church/domain"
import { FindMemberById } from "@/Church/applications"
import { SearchAvailabilityAccount } from "@/FinanceConfig/applications"
import { DateBR } from "@/Shared/helpers"
import type { IAvailabilityAccountRepository } from "@/FinanceConfig/domain"

export class DeclareInstallmentPayment {
  private logger = Logger(DeclareInstallmentPayment.name)

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository,
    private readonly memberRepository: IMemberRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly registerContributionsOnline: RegisterContributionsOnline
  ) {}

  async execute(request: DeclareInstallmentPaymentRequest): Promise<void> {
    this.logger.info(`Start DeclareInstallmentPayment`, request)

    const member = await new FindMemberById(this.memberRepository).execute({
      memberId: request.memberId,
      churchId: request.churchId,
    })

    const account = await this.accountReceivableRepository.one({
      accountReceivableId: request.accountReceivableId,
      "debtor.debtorDNI": member.getDni(),
      "debtor.debtorType": DebtorType.MEMBER,
    })

    if (!account) {
      this.logger.debug(`Account Receivable not found`)
      throw new AccountReceivableNotFound()
    }

    const availabilityAccount = await new SearchAvailabilityAccount(
      this.availabilityAccountRepository
    ).execute({
      availabilityAccountId: request.availabilityAccountId,
      churchId: member.getChurch().churchId,
    })

    const installment = account.getInstallment(request.installmentId)

    if (!installment) {
      this.logger.debug(`Installment ${request.installmentId} not found`)
      throw new InstallmentNotFound(request.installmentId)
    }

    const paidAt = DateBR().toISOString().slice(0, 10)

    await this.registerContributionsOnline.execute(
      {
        amount: AmountValue.create(request.amount).getValue(),
        bankTransferReceipt: request.file || request.voucher,
        paidAt,
        observation: `Pagamento de compromisso ${account.getAccountReceivableId()} - parcela ${installment.installmentId}`,
        accountReceivableId: account.getAccountReceivableId(),
        installmentId: installment.installmentId,
        availabilityAccount,
      },

      member,
      account.getFinancialConcept()
    )

    account.markInstallmentInReview(request.installmentId)
    await this.accountReceivableRepository.upsert(account)
  }
}

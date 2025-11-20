import { Logger } from "@/Shared/adapter"
import {
  AccountReceivable,
  AccountReceivableNotFound,
  AccountReceivableType,
  DebtorType,
  DeclareInstallmentPaymentRequest,
  IAccountsReceivableRepository,
  InstallmentNotFound,
  InvalidMemberForInstallmentPayment,
} from "@/AccountsReceivable/domain"
import {
  ContributionRequest,
  OnlineContributionsStatus,
} from "@/Financial/domain"
import { RegisterContributionsOnline } from "@/Financial/applications"
import { AvailabilityAccountMongoRepository } from "@/Financial/infrastructure/persistence"
import { AvailabilityAccountNotFound } from "@/Financial/domain/exceptions"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { FindMemberById } from "@/Church/applications"
import { OnlineContributionsMongoRepository } from "@/Financial/infrastructure/persistence/OnlineContributionsMongoRepository"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { StorageGCP } from "@/Shared/infrastructure"
import { AmountValue } from "@/Shared/domain"

export class DeclareInstallmentPayment {
  private logger = Logger(DeclareInstallmentPayment.name)

  constructor(
    private readonly accountReceivableRepository: IAccountsReceivableRepository
  ) {}

  async execute(
    request: DeclareInstallmentPaymentRequest
  ): Promise<OnlineContributionsStatus> {
    this.logger.info(`Start DeclareInstallmentPayment`, request)

    const account = await this.accountReceivableRepository.one({
      accountReceivableId: request.accountReceivableId,
      churchId: request.churchId,
    })

    if (!account) {
      this.logger.debug(`Account Receivable not found`)
      throw new AccountReceivableNotFound()
    }

    if (account.getType() !== AccountReceivableType.CONTRIBUTION) {
      throw new InvalidMemberForInstallmentPayment()
    }

    const debtor = account.getDebtor()
    const debtorMatches = debtor.debtorDNI === request.debtorDNI

    if (debtor.debtorType !== DebtorType.MEMBER || !debtorMatches) {
      throw new InvalidMemberForInstallmentPayment()
    }

    const installment = account.getInstallment(request.installmentId)

    if (!installment) {
      this.logger.debug(`Installment ${request.installmentId} not found`)
      throw new InstallmentNotFound(request.installmentId)
    }

    const member = await new FindMemberById(
      MemberMongoRepository.getInstance()
    ).execute(request.debtorDNI)

    const availabilityAccount =
      await AvailabilityAccountMongoRepository.getInstance().one({
        availabilityAccountId: request.availabilityAccountId,
      })

    if (!availabilityAccount) {
      throw new AvailabilityAccountNotFound()
    }

    const contributionRequest: ContributionRequest = {
      memberId: member.getMemberId(),
      amount: AmountValue.create(request.amount).getValue(),
      bankTransferReceipt: request.file || request.voucher,
      financialConceptId: account.getFinancialConcept().getFinancialConceptId(),
      availabilityAccountId: request.availabilityAccountId,
      month: new Date().toISOString(),
      observation: `Pagamento de compromisso ${account.getAccountReceivableId()} - parcela ${installment.installmentId}`,
      accountReceivableId: account.getAccountReceivableId(),
      installmentId: installment.installmentId,
    }

    await new RegisterContributionsOnline(
      OnlineContributionsMongoRepository.getInstance(),
      StorageGCP.getInstance(process.env.BUCKET_FILES),
      FinancialYearMongoRepository.getInstance()
    ).execute(
      contributionRequest,
      availabilityAccount,
      member,
      account.getFinancialConcept()
    )

    return OnlineContributionsStatus.PENDING_VERIFICATION
  }
}

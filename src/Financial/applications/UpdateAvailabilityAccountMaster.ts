import type { IAvailabilityAccountMasterRepository } from "../domain/interfaces"
import { AvailabilityAccount, AvailabilityAccountMaster } from "../domain"
import IdentifyAvailabilityAccountMaster from "./helpers/MasterBalanceIdentifier"
import { Logger } from "@/Shared/adapter"

export class UpdateAvailabilityAccountMaster {
  private logger = Logger("UpdateAvailabilityAccountMaster")

  constructor(
    private readonly availabilityAccountMasterRepository: IAvailabilityAccountMasterRepository
  ) {}

  async execute(
    account: AvailabilityAccount,
    amount: number,
    operationType: "MONEY_IN" | "MONEY_OUT",
    period?: { year: number; month: number }
  ) {
    this.logger.info(`UpdateAvailabilityAccountMaster`, account)
    const identifyAvailabilityAccountMaster = IdentifyAvailabilityAccountMaster(
      account.getAvailabilityAccountId(),
      period
    )

    this.logger.info(
      `Search AvailabilityAccountMaster ${identifyAvailabilityAccountMaster}`
    )

    let accountMaster = await this.availabilityAccountMasterRepository.one({
      availabilityAccountMasterId: identifyAvailabilityAccountMaster,
    })

    if (!accountMaster) {
      this.logger.info(
        `AvailabilityAccountMaster ${identifyAvailabilityAccountMaster} not found`
      )
      accountMaster = AvailabilityAccountMaster.create(account)
    }

    accountMaster.updateMaster(Number(amount), operationType)

    await this.availabilityAccountMasterRepository.upsert(accountMaster)

    this.logger.info(`UpdateAvailabilityAccountMaster finish`, accountMaster)
  }
}

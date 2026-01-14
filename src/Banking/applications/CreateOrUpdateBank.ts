import { Church, ChurchNotFound, IChurchRepository } from "@/Church/domain"
import { BankNotFound } from "@/Banking/domain"
import type { BankRequest, IBankRepository } from "@/Banking/domain"
import { Bank } from "@/Banking/domain/Bank"

export class CreateOrUpdateBank {
  constructor(
    private readonly bankRepository: IBankRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(requestBank: BankRequest) {
    if (!requestBank.bankId) {
      await this.registerBank(requestBank)
      return
    }

    const bank: Bank = await this.bankRepository.findById(requestBank.bankId)

    if (!bank) {
      throw new BankNotFound()
    }

    bank.setBankInstruction(requestBank.bankInstruction)
    bank.setAccountType({ accountType: requestBank.accountType })
    bank.setInstancePaymentAddress(requestBank.addressInstancePayment)
    bank.setTag(requestBank.tag)
    bank.setStatus(requestBank.active)

    await this.bankRepository.upsert(bank)
  }

  private async registerBank(requestBank: BankRequest): Promise<void> {
    //TODO validar si el banco ya existe
    const bank = Bank.create(
      requestBank.accountType,
      requestBank.active,
      requestBank.name,
      requestBank.tag,
      requestBank.addressInstancePayment,
      requestBank.bankInstruction,
      await this.getChurch(requestBank.churchId)
    )
    await this.bankRepository.upsert(bank)
  }

  private async getChurch(churchId: string): Promise<Church> {
    const church = await this.churchRepository.findById(churchId)
    if (!church) throw new ChurchNotFound()

    return church
  }
}

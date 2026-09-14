import { FindMemberById } from "@/Church/applications"
import type { IMemberRepository } from "@/Church/domain"
import { AmountValue } from "@/Shared/domain"
import { DateBR } from "@/Shared/helpers"
import type {
  CreatePaymentResponse,
  CreatePixPaymentRequest,
  IChurchBankingClient,
} from "@/Banking/domain"

export class CreatePixPayment {
  constructor(
    private readonly memberRepository: IMemberRepository,
    private readonly churchBankingClient: IChurchBankingClient
  ) {}

  async execute(
    request: CreatePixPaymentRequest
  ): Promise<CreatePaymentResponse> {
    const member = await new FindMemberById(this.memberRepository).execute({
      memberId: request.memberId,
      churchId: request.churchId,
    })

    const amount = AmountValue.create(request.amount).getValue()

    return await this.churchBankingClient.createPayment({
      externalAccountId: request.churchId!,
      externalReference: request.externalReference,
      principalAmountInCents: Math.round(amount * 100),
      dueDate: DateBR().toISOString().slice(0, 10),
      customer: {
        name: member.getName(),
        cpfCnpj: member.getDni(),
      },
    })
  }
}

export type BankingHolderType = "PJ" | "PF"

export type BankingOnboardingResponsible = {
  name?: string
  email?: string
  cpfCnpj?: string
  mobilePhone?: string
  address?: string
  addressNumber?: string
  neighborhood?: string
  state?: string
  postalCode?: string
  companyType?: string
  incomeValue?: number
}

export type ChurchBankingOnboarding = {
  holderType?: BankingHolderType
  mobilePhone?: string
  neighborhood?: string
  state?: string
  companyType?: string
  incomeValue?: number
  responsible?: BankingOnboardingResponsible
  consent?: {
    acceptedAt: Date
    acceptedByUserId: string
  }
  updatedAt?: Date
}

export type ChurchBankingOnboardingDraft = {
  holderType?: BankingHolderType
  name?: string
  registerNumber?: string
  email?: string
  mobilePhone?: string
  postalCode?: string
  address?: string
  street?: string
  number?: string
  city?: string
  neighborhood?: string
  state?: string
  companyType?: string
  incomeValue?: number
  responsible?: BankingOnboardingResponsible
  consentAccepted?: boolean
}

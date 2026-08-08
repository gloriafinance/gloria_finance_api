import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { ConceptType } from "./enums/ConcepType.enum"
import { StatementCategory } from "@/Financial/domain"
import { Church } from "@/Church/domain"
import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"

export type FinancialConceptImpactFlags = {
  affectsCashFlow: boolean
  affectsResult: boolean
  affectsBalance: boolean
  isOperational: boolean
}

export type FinancialConceptImpactOverrides =
  Partial<FinancialConceptImpactFlags>

export class FinancialConcept extends AggregateRoot {
  isSystem: boolean = false
  private id?: string
  private financialConceptId: string
  private name: string
  private description: string
  private active: boolean
  private type: ConceptType
  private statementCategory: StatementCategory
  private churchId: string
  private createdAt: Date
  private affectsCashFlow: boolean
  private affectsResult: boolean
  private affectsBalance: boolean
  private isOperational: boolean
  private tag?: string

  private constructor() {
    super()
  }

  static create(
    name: string,
    description: string,
    active: boolean,
    type: ConceptType,
    statementCategory: StatementCategory,
    church: Church,
    impactOverrides: FinancialConceptImpactOverrides,
    tag?: string,
    isSystem: boolean = false
  ): FinancialConcept {
    const concept: FinancialConcept = new FinancialConcept()
    concept.financialConceptId = IdentifyEntity.get(`financialConcept`)
    concept.name = name
    concept.description = description
    concept.active = active
    concept.type = type
    concept.statementCategory = statementCategory
    concept.churchId = church.getChurchId()
    concept.createdAt = DateBR()
    concept.affectsBalance = impactOverrides.affectsBalance!
    concept.affectsResult = impactOverrides.affectsResult!
    concept.affectsCashFlow = impactOverrides.affectsCashFlow!
    concept.isOperational = impactOverrides.isOperational!
    concept.tag = tag
    concept.isSystem = isSystem

    return concept
  }

  static fromPrimitives(plainData: any): FinancialConcept {
    const concept: FinancialConcept = new FinancialConcept()
    concept.id = plainData.id
    concept.financialConceptId = plainData.financialConceptId
    concept.name = plainData.name
    concept.description = plainData.description
    concept.active = plainData.active
    concept.type = plainData.type
    concept.statementCategory =
      plainData.statementCategory ?? StatementCategory.OTHER
    concept.createdAt = plainData.createdAt
    concept.churchId = plainData.churchId
    concept.affectsCashFlow = plainData.affectsCashFlow
    concept.affectsResult = plainData.affectsResult
    concept.affectsBalance = plainData.affectsBalance
    concept.isOperational = plainData.isOperational
    concept.isSystem = plainData.isSystem
    concept.tag = plainData.tag

    return concept
  }

  getFinancialConceptId(): string {
    return this.financialConceptId
  }

  getId(): string | undefined {
    return this.id
  }

  isDisable(): boolean {
    return !this.active
  }

  disable(): void {
    this.active = false
  }

  enable(): void {
    this.active = true
  }

  getType(): ConceptType {
    return this.type
  }

  getChurchId(): string {
    return this.churchId
  }

  getName(): string {
    return this.name
  }

  getDescription(): string {
    return this.description
  }

  setName(name: string): void {
    this.name = name
  }

  setDescription(description: string): void {
    this.description = description
  }

  setType(type: ConceptType): void {
    this.type = type
  }

  getStatementCategory(): StatementCategory {
    return this.statementCategory
  }

  setStatementCategory(statementCategory: StatementCategory): void {
    this.statementCategory = statementCategory
  }

  updateImpactFlags(overrides?: FinancialConceptImpactOverrides): void {
    if (!overrides) {
      return
    }

    if (typeof overrides.affectsCashFlow === "boolean") {
      this.affectsCashFlow = overrides.affectsCashFlow
    }

    if (typeof overrides.affectsResult === "boolean") {
      this.affectsResult = overrides.affectsResult
    }

    if (typeof overrides.affectsBalance === "boolean") {
      this.affectsBalance = overrides.affectsBalance
    }

    if (typeof overrides.isOperational === "boolean") {
      this.isOperational = overrides.isOperational
    }
  }

  getAffectsCashFlow(): boolean {
    return this.affectsCashFlow
  }

  getAffectsResult(): boolean {
    return this.affectsResult
  }

  getAffectsBalance(): boolean {
    return this.affectsBalance
  }

  getIsOperational(): boolean {
    return this.isOperational
  }

  toPrimitives(): any {
    return {
      financialConceptId: this.financialConceptId,
      churchId: this.churchId,
      name: this.name,
      description: this.description,
      active: this.active,
      type: this.type,
      statementCategory: this.statementCategory,
      createdAt: this.createdAt,
      affectsCashFlow: this.affectsCashFlow,
      affectsResult: this.affectsResult,
      affectsBalance: this.affectsBalance,
      isOperational: this.isOperational,
      tag: this.tag,
      isSystem: this.isSystem,
    }
  }
}

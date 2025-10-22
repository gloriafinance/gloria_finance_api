import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { ConceptType } from "./enums/ConcepType.enum"
import { StatementCategory } from "./enums/StatementCategory.enum"
import { Church } from "@/Church/domain"
import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"

export class FinancialConcept extends AggregateRoot {
  private id?: string
  private financialConceptId: string
  private name: string
  private description: string
  private active: boolean
  private type: ConceptType
  private statementCategory: StatementCategory
  private churchId: string
  private createdAt: Date

  static create(
    name: string,
    description: string,
    active: boolean,
    type: ConceptType,
    statementCategory: StatementCategory,
    church: Church
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
    return concept
  }

  getFinancialConceptId(): string {
    return this.financialConceptId
  }

  getId(): string {
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
    }
  }
}

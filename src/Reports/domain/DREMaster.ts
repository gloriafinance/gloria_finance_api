import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { type DREStructure } from "./types/DREStructure.type"
import { type DREResponse } from "@/Reports/domain/responses/DRE.response"

export class DREMaster extends AggregateRoot {
  private id?: string
  private dreMasterId: string
  private churchId: string
  private month: number
  private year: number
  private dre: DREStructure

  static create(props: {
    churchId: string
    month: number
    year: number
    dre: DREStructure
  }): DREMaster {
    const dreMaster = new DREMaster()
    dreMaster.dreMasterId = `${props.churchId}-${props.year}-${props.month}`
    dreMaster.churchId = props.churchId
    dreMaster.month = props.month
    dreMaster.year = props.year
    dreMaster.dre = props.dre
    return dreMaster
  }

  static fromPrimitives(primitives: any): DREMaster {
    const dreMaster = new DREMaster()
    dreMaster.id = primitives.id
    dreMaster.dreMasterId = primitives.dreMasterId
    dreMaster.churchId = primitives.churchId
    dreMaster.month = primitives.month
    dreMaster.year = primitives.year
    dreMaster.dre = primitives.dre

    return dreMaster
  }

  getId(): string {
    return this.id
  }

  toResponseAPI(): DREResponse {
    return {
      grossRevenue: this.dre.grossRevenue,
      netRevenue: this.dre.netRevenue,
      directCosts: this.dre.directCosts,
      grossProfit: this.dre.grossProfit,
      operationalExpenses: this.dre.operationalExpenses,
      ministryTransfers: this.dre.ministryTransfers,
      capexInvestments: this.dre.capexInvestments,
      extraordinaryResults: this.dre.extraordinaryResults,
      operationalResult: this.dre.operationalResult,
      netResult: this.dre.netResult,
      year: this.year,
      month: this.month,
    }
  }

  toPrimitives() {
    return {
      dreMasterId: this.dreMasterId,
      churchId: this.churchId,
      month: this.month,
      year: this.year,
      dre: this.dre,
    }
  }
}

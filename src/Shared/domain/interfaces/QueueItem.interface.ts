import { IJob } from "@/Shared/domain"

export interface IDefinitionQueue {
  useClass: new (...args: any[]) => IJob
  inject?: any[]
  /**
   * Delay in seconds
   */
  delay?: number
}

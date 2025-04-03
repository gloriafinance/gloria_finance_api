import { IQueue } from "@/Shared/domain"

export interface IDefinitionQueue {
  useClass: new (...args: any[]) => IQueue
  inject?: any[]
  /**
   * Delay in seconds
   */
  delay?: number
}

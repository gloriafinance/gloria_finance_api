import type { IJob } from "./Job.interface.ts"

export interface IListQueue {
  name: string
  useClass?: new (...args: any[]) => IJob
  inject?: any[]
  /**
   * Delay in seconds
   */
  delay?: number
}

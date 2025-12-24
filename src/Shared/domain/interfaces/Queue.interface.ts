export interface IJob {
  handle(args: any): Promise<any | void>
}

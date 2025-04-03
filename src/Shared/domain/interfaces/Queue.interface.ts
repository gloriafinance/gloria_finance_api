export interface IQueue {
  handle(args: any): Promise<any | void>
}

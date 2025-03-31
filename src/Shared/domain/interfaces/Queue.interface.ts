export interface IQueue<T> {
  handle(args: any): Promise<T>
}

import { MovementBank } from "../MovementBank"

export interface IMovementBankRepository {
  upsert(movementBank: MovementBank): Promise<void>
}

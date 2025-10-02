import { IMovementBankRepository, MovementBank } from "../../domain"
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"

export class MovementBankMongoRepository
  extends MongoRepository<MovementBank>
  implements IMovementBankRepository
{
  private static instance: MovementBankMongoRepository

  constructor() {
    super()
  }

  static getInstance(): MovementBankMongoRepository {
    if (!MovementBankMongoRepository.instance) {
      MovementBankMongoRepository.instance = new MovementBankMongoRepository()
    }
    return MovementBankMongoRepository.instance
  }

  async upsert(movementBank: MovementBank): Promise<void> {
    await this.persist(movementBank.getId(), movementBank)
  }

  collectionName(): string {
    return "movement_bank"
  }
}

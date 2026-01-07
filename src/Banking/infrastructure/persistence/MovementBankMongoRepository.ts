import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { IMovementBankRepository, MovementBank } from "@/Banking/domain"

export class MovementBankMongoRepository
  extends MongoRepository<MovementBank>
  implements IMovementBankRepository
{
  private static instance: MovementBankMongoRepository

  private constructor() {
    super(MovementBank)
  }

  static getInstance(): MovementBankMongoRepository {
    if (!MovementBankMongoRepository.instance) {
      MovementBankMongoRepository.instance = new MovementBankMongoRepository()
    }
    return MovementBankMongoRepository.instance
  }

  collectionName(): string {
    return "movement_bank"
  }
}

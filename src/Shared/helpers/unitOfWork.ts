import { Logger } from "@/Shared/adapter"

type RollbackAction = () => Promise<void> | void
type PostCommitAction = () => Promise<void> | void

export class UnitOfWorkRollbackError extends Error {
  constructor(public readonly causes: unknown[]) {
    super(`One or more rollback actions failed (${causes.length})`)
    this.name = UnitOfWorkRollbackError.name
  }
}

export class UnitOfWork {
  private readonly rollbackActions: RollbackAction[] = []
  private readonly postCommitActions: PostCommitAction[] = []
  private readonly logger = Logger(UnitOfWork.name)

  /**
   * Register a rollback action to be executed if the unit of work is rolled back.
   * @param action
   */
  register(action: RollbackAction): void {
    this.rollbackActions.push(action)
  }

  registerPostCommit(action: PostCommitAction): void {
    this.postCommitActions.push(action)
  }

  async rollback(): Promise<void> {
    const errors: unknown[] = []

    const actions = this.rollbackActions.splice(0, this.rollbackActions.length)
    const results = await Promise.allSettled(
      actions.map((action) => Promise.resolve().then(() => action()))
    )

    results.forEach((result, idx) => {
      if (result.status === "rejected") {
        errors.push(result.reason)
        this.logger.error("Rollback action failed", result.reason)
      }
    })

    this.postCommitActions.length = 0

    if (errors.length) {
      throw new UnitOfWorkRollbackError(errors)
    }
  }

  async commit(): Promise<void> {
    try {
      for (const action of this.postCommitActions) {
        await action()
      }
      this.rollbackActions.length = 0
    } catch (error) {
      try {
        await this.rollback()
      } catch (rollbackError) {
        this.logger.error("Rollback failed after commit error", rollbackError)
        throw rollbackError
      }

      throw error
    } finally {
      this.postCommitActions.length = 0
    }
  }
}

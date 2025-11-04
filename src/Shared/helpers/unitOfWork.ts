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
  registerRollbackActions(action: RollbackAction): void {
    this.rollbackActions.push(action)
  }

  execPostCommit(action: PostCommitAction): void {
    this.postCommitActions.push(action)
  }

  /**
   * Commits the unit of work, executing all post-commit actions.
   */
  async commit(): Promise<void> {
    try {
      for (const action of this.postCommitActions) {
        await action()
      }
      this.rollbackActions.length = 0
    } finally {
      this.postCommitActions.length = 0
    }
  }

  async rollback(): Promise<void> {
    const errors: unknown[] = []

    const actions = this.rollbackActions.splice(0, this.rollbackActions.length)
    const results = await Promise.allSettled(
      actions.map((action) => Promise.resolve().then(() => action()))
    )

    results.forEach((result) => {
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
}

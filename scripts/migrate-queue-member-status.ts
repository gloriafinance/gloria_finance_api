/**
 * Queue payload migration: CreateUserForMemberJob
 *
 * Run BEFORE deploying the new Member.status contract if the queue may contain
 * jobs dispatched by the previous version (which carried `active` instead of
 * `status`). Waiting / delayed jobs with `active` but no `status` are
 * rewritten so the new CreateUserForMemberJob.handle() can hydrate them
 * without throwing InvalidMemberStatus.
 *
 * Usage (from repo root):
 *   bun scripts/migrate-queue-member-status.ts
 *
 * The script is idempotent: re-running it skips already-migrated jobs.
 */

import { Queue } from "bullmq"
import { readRedisConnectionOptions } from "../src/Shared/helpers/ReadRedisConnectionOptions.helper"

const QUEUE_NAME = "CreateUserForMemberJob"

const main = async (): Promise<void> => {
  const redisOpts = readRedisConnectionOptions()
  const queue = new Queue(QUEUE_NAME, {
    connection: redisOpts,
  })

  let migrated = 0
  let skipped = 0
  let errors = 0

  const states: Array<"waiting" | "delayed" | "paused"> = [
    "waiting",
    "delayed",
    "paused",
  ]

  for (const state of states) {
    const jobs = await queue.getJobs(state, 0, -1)

    for (const job of jobs) {
      const data = job.data as any

      // Already migrated or never had the old shape
      if (data.status || data.active === undefined) {
        skipped++
        continue
      }

      const updated = {
        ...data,
        status: data.active === true ? "APPROVED" : "INACTIVE",
      }
      delete updated.active

      try {
        await job.updateData(updated)
        migrated++
      } catch (err) {
        console.error(`Failed to update job ${job.id}:`, err)
        errors++
      }
    }
  }

  console.log(
    `[${QUEUE_NAME}] migrated=${migrated} skipped=${skipped} errors=${errors}`
  )

  await queue.close()
  process.exit(0)
}

void main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})

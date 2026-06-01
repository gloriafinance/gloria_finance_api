const VALID_STATUSES = ["PENDING_REVIEW", "APPROVED", "INACTIVE"]

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("members")

    // 1. active === false and status is missing or invalid -> INACTIVE
    await collection.updateMany(
      { active: false, status: { $nin: VALID_STATUSES } },
      { $set: { status: "INACTIVE" }, $unset: { active: "" } }
    )

    // 2. active === true (or missing) and status is missing or invalid -> APPROVED
    //    Covers active:true, active absent, or any active value other than false.
    await collection.updateMany(
      { active: { $ne: false }, status: { $nin: VALID_STATUSES } },
      { $set: { status: "APPROVED" }, $unset: { active: "" } }
    )

    // 3. Clean up active on documents that already have a valid status
    await collection.updateMany(
      { status: { $in: VALID_STATUSES }, active: { $exists: true } },
      { $unset: { active: "" } }
    )

    // 4. Final guard: any document still lacking status -> APPROVED
    await collection.updateMany(
      { status: { $exists: false } },
      { $set: { status: "APPROVED" } }
    )

    // 5. Create named index
    const indexes = await collection.indexes()
    const hasIndex = indexes.some(
      (idx) => idx.name === "idx_members_church_status_created"
    )
    if (!hasIndex) {
      await collection.createIndex(
        { "church.churchId": 1, status: 1, createdAt: -1 },
        { name: "idx_members_church_status_created", background: true }
      )
    }

    // 6. Backfill embedded contribution member snapshots (additive only)
    //    Old OnlineContributions.toPrimitives() emitted the full Member aggregate
    //    with nested member.church.{churchId,name}. The new ContributionMemberSnapshot
    //    expects flat member.{churchId,churchName}. Add the flat fields idempotently
    //    without removing historical fields so rollback remains safe.
    const contributions = db.collection("contributions")
    await contributions.updateMany(
      {
        "member.church.churchId": { $exists: true },
        "member.churchId": { $exists: false },
      },
      [
        {
          $set: {
            "member.churchId": "$member.church.churchId",
            "member.churchName": { $ifNull: ["$member.church.name", ""] },
          },
        },
      ]
    )
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("members")

    // Rollback: APPROVED -> active: true; INACTIVE/PENDING_REVIEW -> active: false
    await collection.updateMany(
      { status: "APPROVED" },
      { $set: { active: true }, $unset: { status: "" } }
    )

    await collection.updateMany(
      { status: { $in: ["INACTIVE", "PENDING_REVIEW"] } },
      { $set: { active: false }, $unset: { status: "" } }
    )

    // Drop named index
    const indexes = await collection.indexes()
    const hasIndex = indexes.some(
      (idx) => idx.name === "idx_members_church_status_created"
    )
    if (hasIndex) {
      await collection.dropIndex("idx_members_church_status_created")
    }
  },
}

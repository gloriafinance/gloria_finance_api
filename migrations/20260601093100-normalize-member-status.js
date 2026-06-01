module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("members")

    // 1. active === false -> INACTIVE
    await collection.updateMany(
      { active: false },
      { $set: { status: "INACTIVE" }, $unset: { active: "" } }
    )

    // 2. active === true -> APPROVED
    await collection.updateMany(
      { active: true },
      { $set: { status: "APPROVED" }, $unset: { active: "" } }
    )

    // 3. Missing active and missing status -> APPROVED
    //    Restricted to documents that also lack status so a retry does not
    //    overwrite established INACTIVE or PENDING_REVIEW values.
    await collection.updateMany(
      { active: { $exists: false }, status: { $exists: false } },
      { $set: { status: "APPROVED" } }
    )

    // 4. Ensure no documents lack status (final idempotency guard)
    await collection.updateMany(
      { status: { $exists: false } },
      { $set: { status: "APPROVED" } }
    )

    // 5. Remove active from all documents (idempotency)
    await collection.updateMany(
      { active: { $exists: true } },
      { $unset: { active: "" } }
    )

    // 6. Create named index
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

    // 7. Backfill embedded contribution member snapshots
    //    Old OnlineContributions.toPrimitives() emitted the full Member aggregate
    //    with nested member.church.{churchId,name}. The new ContributionMemberSnapshot
    //    expects flat member.{churchId,churchName}. Migrate old snapshots idempotently
    //    so that UpdateContributionStatus does not pass undefined as churchId.
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
        {
          $unset: [
            "member.church",
            "member.email",
            "member.phone",
            "member.createdAt",
            "member.dni",
            "member.conversionDate",
            "member.baptismDate",
            "member.birthdate",
            "member.isMinister",
            "member.isTreasurer",
            "member.settings",
            "member.active",
            "member.status",
          ],
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

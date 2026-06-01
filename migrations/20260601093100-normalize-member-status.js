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

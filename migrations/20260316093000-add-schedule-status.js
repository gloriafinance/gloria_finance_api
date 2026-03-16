const ACTIVE = "ACTIVE"
const SUSPENDED = "SUSPENDED"
const FINALIZED = "FINALIZED"

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collectionExists = await db
      .listCollections({ name: "schedule_events" }, { nameOnly: true })
      .hasNext()
    if (!collectionExists) {
      return
    }

    const collection = db.collection("schedule_events")

    await collection.updateMany(
      {
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      },
      {
        $set: { status: ACTIVE },
      }
    )

    await collection.updateMany(
      {
        isActive: false,
      },
      {
        $set: { status: FINALIZED },
      }
    )

    await collection.updateMany({}, { $unset: { isActive: "" } })

    await collection.dropIndex("idx_schedule_today_lookup").catch(() => {})
    await collection.dropIndex("idx_schedule_filters").catch(() => {})
    await collection
      .dropIndex("idx_schedule_deactivate_previous_day_global")
      .catch(() => {})

  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collectionExists = await db
      .listCollections({ name: "schedule_events" }, { nameOnly: true })
      .hasNext()
    if (!collectionExists) {
      return
    }

    const collection = db.collection("schedule_events")

    await collection.updateMany(
      { status: ACTIVE },
      { $set: { isActive: true } }
    )

    await collection.updateMany(
      { status: { $in: [SUSPENDED, FINALIZED] } },
      { $set: { isActive: false } }
    )

    await collection.updateMany({}, { $unset: { status: "" } })

    await collection.dropIndex("idx_schedule_today_lookup").catch(() => {})
    await collection.dropIndex("idx_schedule_filters").catch(() => {})
    await collection
      .dropIndex("idx_schedule_deactivate_previous_day_global")
      .catch(() => {})

  },
}

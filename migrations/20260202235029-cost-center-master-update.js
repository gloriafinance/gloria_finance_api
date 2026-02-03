module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("financial_records")

    const pipeline = [
      {
        $match: {
          status: { $in: ["CLEARED", "RECONCILED"] },
          date: { $gte: new Date("2026-01-01T00:00:00.000Z") },
          type: { $in: ["OUTGO", "PURCHASE"] },
          costCenter: { $exists: true },
          "availabilityAccount.symbol": { $exists: true },
        },
      },
      {
        $project: {
          churchId: 1,
          costCenterId: "$costCenter.costCenterId",
          costCenterName: "$costCenter.name",
          amount: { $abs: "$amount" },
          date: 1,
          symbol: {
            $ifNull: ["$availabilityAccount.symbol", "UNSPECIFIED"],
          },
        },
      },
      {
        $addFields: {
          year: { $year: "$date" },
          month: { $month: "$date" },
        },
      },
      {
        $group: {
          _id: {
            churchId: "$churchId",
            costCenterId: "$costCenterId",
            costCenterName: "$costCenterName",
            month: "$month",
            year: "$year",
            symbol: "$symbol",
          },
          total: { $sum: "$amount" },
          lastMove: { $max: "$date" },
        },
      },
      {
        $project: {
          _id: 0,
          churchId: "$_id.churchId",
          costCenterId: "$_id.costCenterId",
          costCenterName: "$_id.costCenterName",
          month: "$_id.month",
          year: "$_id.year",
          symbol: "$_id.symbol",
          total: 1,
          lastMove: 1,
        },
      },
    ]

    const aggregated = await collection.aggregate(pipeline).toArray()

    if (!aggregated.length) {
      return
    }

    const masterCollection = db.collection("cost_centers_master")

    const bulkOps = aggregated.map((item) => {
      const costCenterMasterId = `${item.month}-${item.year}-${item.costCenterId}-${item.symbol}`

      return {
        updateOne: {
          filter: { costCenterMasterId },
          update: {
            $set: {
              churchId: item.churchId,
              costCenter: {
                costCenterId: item.costCenterId,
                costCenterName: item.costCenterName,
              },
              month: item.month,
              year: item.year,
              total: item.total,
              lastMove: item.lastMove,
              symbol: item.symbol,
              costCenterMasterId,
            },
          },
          upsert: true,
        },
      }
    })

    if (bulkOps.length > 0) {
      await masterCollection.bulkWrite(bulkOps)
    }
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
  },
}

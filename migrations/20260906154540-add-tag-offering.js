/**
 * @param db {import('mongodb').Db}
 * @param client {import('mongodb').MongoClient}
 * @returns {Promise<void>}
 */
export const up = async (db, client) => {
  const financialConceptsCollection = db.collection("financial_concepts")
  await financialConceptsCollection.updateMany(
    { tag: { $exists: false }, name: /Oferta/, type: "INCOME" },
    { $set: { tag: "Offering" } }
  )

  await financialConceptsCollection.updateMany(
    { tag: { $exists: false }, name: /Ofrenda/, type: "INCOME" },
    { $set: { tag: "Offering" } }
  )
}

/**
 * @param db {import('mongodb').Db}
 * @param client {import('mongodb').MongoClient}
 * @returns {Promise<void>}
 */
export const down = async (db, client) => {
  // TODO write the statements to rollback your migration (if possible)
  // Example:
  // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
}

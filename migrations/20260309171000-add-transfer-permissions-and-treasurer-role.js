module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const permissionsCollection = db.collection("permissions")
    const rolesCollection = db.collection("roles")
    const rolePermissionsCollection = db.collection("role_permissions")

    const permissions = [
      {
        permissionId: "financial_records:transfer_between_accounts",
        module: "financial_records",
        action: "transfer_between_accounts",
        description:
          "Registrar transferências internas entre contas de disponibilidade",
        isSystem: true,
      },
      {
        permissionId: "financial_records:reverse_transfer",
        module: "financial_records",
        action: "reverse_transfer",
        description:
          "Reverter transferências internas e cancelar os movimentos vinculados",
        isSystem: true,
      },
    ]

    for (const permission of permissions) {
      await permissionsCollection.updateOne(
        { permissionId: permission.permissionId },
        { $setOnInsert: permission },
        { upsert: true }
      )
    }

    const treasurerRoles = await rolesCollection
      .find({ roleId: "TREASURER" }, { projection: { _id: 0, churchId: 1 } })
      .toArray()

    for (const role of treasurerRoles) {
      for (const permission of permissions) {
        await rolePermissionsCollection.updateOne(
          {
            churchId: role.churchId,
            roleId: "TREASURER",
            permissionId: permission.permissionId,
          },
          {
            $setOnInsert: {
              churchId: role.churchId,
              roleId: "TREASURER",
              permissionId: permission.permissionId,
            },
          },
          { upsert: true }
        )
      }
    }
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const rolePermissionsCollection = db.collection("role_permissions")
    const permissionsCollection = db.collection("permissions")

    const permissionIds = [
      "financial_records:transfer_between_accounts",
      "financial_records:reverse_transfer",
    ]

    await rolePermissionsCollection.deleteMany({
      roleId: "TREASURER",
      permissionId: { $in: permissionIds },
    })

    await permissionsCollection.deleteMany({
      permissionId: { $in: permissionIds },
    })
  },
}

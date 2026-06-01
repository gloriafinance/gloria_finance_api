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

    const permission = {
      permissionId: "members:registration_link",
      module: "members",
      action: "registration_link",
      description: "Obter link de autoregistro de membros",
      isSystem: true,
    }

    await permissionsCollection.updateOne(
      { permissionId: permission.permissionId },
      { $setOnInsert: permission },
      { upsert: true }
    )

    const targetRoles = ["ADMIN", "PASTOR", "TREASURER"]
    const roles = await rolesCollection
      .find({ roleId: { $in: targetRoles } }, { projection: { _id: 0, churchId: 1, roleId: 1 } })
      .toArray()

    for (const role of roles) {
      await rolePermissionsCollection.updateOne(
        {
          churchId: role.churchId,
          roleId: role.roleId,
          permissionId: permission.permissionId,
        },
        {
          $setOnInsert: {
            churchId: role.churchId,
            roleId: role.roleId,
            permissionId: permission.permissionId,
          },
        },
        { upsert: true }
      )
    }

    const churchesCollection = db.collection("churches")
    const indexExists = await churchesCollection.indexExists(
      "idx_church_member_registration_token"
    )
    if (!indexExists) {
      await churchesCollection.createIndex(
        { "memberRegistration.token": 1 },
        {
          unique: true,
          name: "idx_church_member_registration_token",
          partialFilterExpression: {
            "memberRegistration.token": { $exists: true, $type: "string" },
          },
        }
      )
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
    const churchesCollection = db.collection("churches")

    const permissionId = "members:registration_link"
    const targetRoles = ["ADMIN", "PASTOR", "TREASURER"]

    await rolePermissionsCollection.deleteMany({
      roleId: { $in: targetRoles },
      permissionId,
    })

    await permissionsCollection.deleteMany({ permissionId })

    const indexExists = await churchesCollection.indexExists(
      "idx_church_member_registration_token"
    )
    if (indexExists) {
      await churchesCollection.dropIndex("idx_church_member_registration_token")
    }
  },
}

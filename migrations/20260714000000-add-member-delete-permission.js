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
      permissionId: "members:delete",
      module: "members",
      action: "delete",
      description: "Eliminar membros de la iglesia y sus usuarios vinculados",
      isSystem: true,
    }

    await permissionsCollection.updateOne(
      { permissionId: permission.permissionId },
      { $setOnInsert: permission },
      { upsert: true }
    )

    const targetRoles = ["ADMIN", "PASTOR"]
    const roles = await rolesCollection
      .find(
        { roleId: { $in: targetRoles } },
        { projection: { _id: 0, churchId: 1, roleId: 1 } }
      )
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
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const rolePermissionsCollection = db.collection("role_permissions")
    const permissionsCollection = db.collection("permissions")

    const permissionId = "members:delete"
    const targetRoles = ["ADMIN", "PASTOR"]

    await rolePermissionsCollection.deleteMany({
      roleId: { $in: targetRoles },
      permissionId,
    })

    await permissionsCollection.deleteMany({ permissionId })
  },
}

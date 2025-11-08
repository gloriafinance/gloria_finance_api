import { IDefinitionQueue } from "@/Shared/domain"
import { BootstrapPermissionsJob } from "@/SecuritySystem/applications"
import {
  PermissionMongoRepository,
  RoleMongoRepository,
  RolePermissionMongoRepository,
  UserAssignmentMongoRepository,
  UserMongoRepository,
} from "@/SecuritySystem/infrastructure/persistence"
import { PasswordAdapter } from "@/SecuritySystem/infrastructure/adapters/Password.adapter"

export const SecuritySystemQueue = (): IDefinitionQueue[] => [
  {
    useClass: BootstrapPermissionsJob,
    inject: [
      PermissionMongoRepository.getInstance(),
      RoleMongoRepository.getInstance(),
      RolePermissionMongoRepository.getInstance(),
      UserAssignmentMongoRepository.getInstance(),
      UserMongoRepository.getInstance(),
      new PasswordAdapter(),
    ],
    delay: 5,
  },
]

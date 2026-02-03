import { BootstrapPermissionsJob } from "@/SecuritySystem/applications"
import {
  PermissionMongoRepository,
  RoleMongoRepository,
  RolePermissionMongoRepository,
  UserAssignmentMongoRepository,
  UserMongoRepository,
} from "@/SecuritySystem/infrastructure/persistence"
import { PasswordAdapter } from "@/SecuritySystem/infrastructure/adapters/Password.adapter"
import type { IListQueue } from "@/package/queue/domain"

export const SecuritySystemQueue = (): IListQueue[] => [
  {
    name: BootstrapPermissionsJob.name,
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

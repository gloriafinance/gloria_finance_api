import { DomainException } from "@/Shared/domain"

export class SupplierNotFound extends DomainException {
  name = "SUPPLIER_NOT_FOUND"
  message = "Supplier not found"
}

import { DomainException } from "@/Shared/domain"

export class SupplierFound extends DomainException {
  name = "SUPPLIER_FOUND"
  message = "Supplier already exists"
}

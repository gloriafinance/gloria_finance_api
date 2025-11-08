export interface ICreateCustomer {
  name: string
  email: string
  phone: string
  address: {
    street: string
    number: string
    city: string
    postalCode: string
    country: string
  }
  representative: {
    name: string
    email: string
    phone: string
    rol: string
  }
}

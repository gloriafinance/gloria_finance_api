import bcrypt from "bcryptjs"

export async function encrypt(plain: string): Promise<string> {
  return await bcrypt.hash(plain, 10)
}

export async function checkPassword(
  plainPassword: string,
  hashPassword: string
): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashPassword)
}

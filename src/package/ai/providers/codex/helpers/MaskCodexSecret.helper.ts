export const maskCodexSecret = (value?: string): string => {
  if (!value) return "missing"
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`
  return `${value.slice(0, 6)}...${value.slice(-3)}`
}

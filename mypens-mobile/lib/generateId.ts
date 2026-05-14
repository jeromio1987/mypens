export const generateId = (): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 9)
  return `${timestamp}${random}`
}

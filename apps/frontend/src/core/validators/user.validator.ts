export function assertUserId(userId: string) {
  if (!userId) throw new Error("User id wajib tersedia.");
}

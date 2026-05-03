export function assertEmailPassword(email: string, password: string) {
  if (!email.includes("@")) throw new Error("Email tidak valid.");
  if (password.length < 6) throw new Error("Password minimal 6 karakter.");
}

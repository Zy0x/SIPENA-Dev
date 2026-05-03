export function hasPermission(grants: string[], permission: string) {
  return grants.includes(permission);
}

export function preferLatest<T extends { updatedAt?: string }>(local: T, remote: T): T {
  if (!local.updatedAt || !remote.updatedAt) return remote;
  return new Date(local.updatedAt) > new Date(remote.updatedAt) ? local : remote;
}

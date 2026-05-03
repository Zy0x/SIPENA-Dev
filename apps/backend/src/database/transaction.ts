export async function runInTransaction<T>(callback: () => Promise<T>) {
  return callback();
}

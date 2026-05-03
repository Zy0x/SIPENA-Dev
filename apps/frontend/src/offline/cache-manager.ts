export async function clearOfflineCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("sipena-")).map((key) => caches.delete(key)));
}

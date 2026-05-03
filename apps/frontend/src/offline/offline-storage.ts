export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

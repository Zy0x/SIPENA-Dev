const breadcrumbs: Array<{ message: string; at: string; data?: unknown }> = [];

export function addBreadcrumb(message: string, data?: unknown) {
  breadcrumbs.push({ message, data, at: new Date().toISOString() });
  if (breadcrumbs.length > 50) breadcrumbs.shift();
}

export function getBreadcrumbs() {
  return [...breadcrumbs];
}

const ALLOWED_PARENT_PATHS = new Set([
  '/documents',
  '/presentations',
  '/calendar',
  '/todos',
  '/flow-diagrams',
  '/transcribe',
]);

function parentOrigins(): string[] {
  const values = (process.env.NEXT_PUBLIC_OMITECH_PARENT_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0 && process.env.NODE_ENV !== 'production') {
    values.push('http://127.0.0.1:1420', 'http://localhost:1420');
  }
  return values;
}

export function navigateOmitechParent(path: string): boolean {
  if (typeof window === 'undefined' || !ALLOWED_PARENT_PATHS.has(path)) return false;
  for (const origin of parentOrigins()) {
    window.parent.postMessage({ type: 'omitech:learning-studio:navigate', path }, origin);
  }
  return true;
}

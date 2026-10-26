// Next.js can construct request.url using an internal hostname. Compare the
// browser origin with the public host supplied by the request/reverse proxy.
export function isSameOriginRequest(request: Pick<Request, 'url' | 'headers'>): boolean {
  const suppliedOrigin = request.headers.get('origin');
  if (!suppliedOrigin || suppliedOrigin === 'null') return false;
  try {
    const origin = new URL(suppliedOrigin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== suppliedOrigin) return false;
    const internal = new URL(request.url);
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const protocol = forwardedProtocol ? `${forwardedProtocol}:` : internal.protocol;
    if (!['http:', 'https:'].includes(protocol) || protocol !== origin.protocol) return false;
    const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
      || request.headers.get('host')
      || internal.host;
    const publicOrigin = new URL(`${protocol}//${host}`);
    return publicOrigin.origin === origin.origin;
  } catch {
    return false;
  }
}

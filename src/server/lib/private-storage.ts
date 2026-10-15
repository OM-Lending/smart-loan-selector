/** Makes a server-only request to a private Supabase Storage object. */
export async function privateStorageRequest(path: string, init: RequestInit, operation: 'object' | 'sign' = 'object') {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error('PRIVATE_STORAGE_NOT_CONFIGURED');
  const bucket = process.env.SUPABASE_APPLICATION_DOCUMENTS_BUCKET || 'application-documents';
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const prefix = operation === 'sign' ? 'sign' : '';
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  // New Supabase secret keys are not JWTs and must never be sent as Bearer
  // tokens. Keep Bearer support only for the legacy service_role JWT.
  if (!key.startsWith('sb_secret_')) headers.set('Authorization', `Bearer ${key}`);
  return fetch(`${baseUrl.replace(/\/$/, '')}/storage/v1/object/${prefix ? `${prefix}/` : ''}${encodeURIComponent(bucket)}/${encodedPath}`, {
    ...init,
    headers,
  });
}

export function privateStorageSignedUrl(baseUrl: string, signedURL: string) {
  if (/^https?:\/\//i.test(signedURL)) return signedURL;
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/${signedURL.replace(/^\/+/, '')}`;
}

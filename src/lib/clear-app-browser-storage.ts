const APP_LOCAL_STORAGE_KEYS = ['application_id'] as const;
const APP_SESSION_STORAGE_KEYS = [
  'pending_loan_data',
  'recommendation_results',
  'recommendation_status',
] as const;

/** Clear app-owned browser state without touching Clerk's cookies or storage. */
export function clearAppBrowserStorage() {
  if (typeof window === 'undefined') return;

  try {
    for (const key of APP_LOCAL_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }

    for (const key of APP_SESSION_STORAGE_KEYS) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts; logout must continue.
  }
}

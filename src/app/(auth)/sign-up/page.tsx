'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';

type PendingApplication = Record<string, unknown> & { firstName?: string; lastName?: string; email?: string; phone?: string };

export default function SignUpPage() {
  const router = useRouter();
  const { user, isLoaded: clerkLoaded } = useUser();
  const [pending, setPending] = useState<PendingApplication | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const automaticSaveAttempt = useRef('');

  useEffect(() => {
    if (!saving) return;
    const preventAccidentalExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventAccidentalExit);
    return () => window.removeEventListener('beforeunload', preventAccidentalExit);
  }, [saving]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const value = sessionStorage.getItem('pending_loan_data');
        setPending(value ? JSON.parse(value) as PendingApplication : null);
      } catch { setPending(null); }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const saveApplication = useCallback(async (email: string) => {
    if (saveInFlight.current) return;
    if (!pending) throw new Error('Your application details have expired. Please return to the questionnaire and submit again.');
    saveInFlight.current = true;
    setSaving(true);
    setSaveError('');
    try {
      let response: Response | null = null;
      // Clerk finalizes the session before calling us, but a newly issued
      // session cookie can take a short moment to reach the app server.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        response = await fetch('/api/application/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pending, email }),
        });
        if (response.status !== 401 || attempt === 3) break;
        await new Promise(resolve => window.setTimeout(resolve, 350 * (2 ** attempt)));
      }
      if (!response) throw new Error('Could not connect to save your application.');
      const result = await response.json() as { error?: string; success?: boolean; applicationId?: string; recommendation?: unknown; recommendationStatus?: string; diagnostic?: { requestId?: string } };
      if (response.status === 401) {
        throw new Error('Your email is verified, but your secure sign-in is still syncing. Your application details are kept in this browser. Wait a moment, then choose Retry saving application; you do not need another verification code.');
      }
      if (!response.ok || !result.success || !result.applicationId) {
        const reference = result.diagnostic?.requestId ? ` Reference: ${result.diagnostic.requestId}` : '';
        throw new Error(`${result.error || 'Could not save your application.'}${reference}`);
      }
      localStorage.setItem('application_id', result.applicationId);
      if (result.recommendation) sessionStorage.setItem('recommendation_results', JSON.stringify(result.recommendation));
      sessionStorage.setItem('recommendation_status', result.recommendationStatus || 'PENDING');
      sessionStorage.removeItem('pending_loan_data');
      router.replace(`/applications/${result.applicationId}/recommendations`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save your application.';
      setSaveError(message);
      throw error;
    } finally { saveInFlight.current = false; setSaving(false); }
  }, [pending, router]);

  useEffect(() => {
    const pendingEmail = pending?.email?.trim().toLowerCase();
    const signedInEmail = user?.primaryEmailAddress?.emailAddress.trim().toLowerCase();
    if (!loaded || !clerkLoaded || !pendingEmail || !user || signedInEmail !== pendingEmail || user.primaryEmailAddress?.verification?.status !== 'verified') return;
    const attemptKey = `${user.id}:${pendingEmail}`;
    if (automaticSaveAttempt.current === attemptKey) return;
    automaticSaveAttempt.current = attemptKey;
    // If a customer refreshed after verifying their email, resume saving with
    // the existing verified Clerk session instead of asking for another code.
    void saveApplication(pendingEmail).catch(() => undefined);
  }, [clerkLoaded, loaded, pending, saveApplication, user]);

  const pendingEmail = pending?.email?.trim().toLowerCase();
  const signedInEmail = user?.primaryEmailAddress?.emailAddress.trim().toLowerCase();
  const hasVerifiedPendingSession = Boolean(
    loaded && clerkLoaded && user && pendingEmail && signedInEmail === pendingEmail
    && user.primaryEmailAddress?.verification?.status === 'verified',
  );

  if (!loaded) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">Loading…</main>;
  if (!pending) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><section className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-xl font-bold">Application details not found</h1><p className="mt-2 text-sm text-slate-600">Please complete the questionnaire first so we can save your details.</p><button className="mt-5 rounded-full bg-primary px-5 py-3 font-semibold text-white" onClick={() => router.replace('/get-started')}>Back to questionnaire</button></section></main>;

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl sm:p-10">
    <h1 className="text-2xl font-bold text-slate-900">Verify your email{pending.firstName ? `, ${pending.firstName}` : ''}</h1>
    <p className="mb-7 mt-2 text-sm text-slate-600">We’ll email you a one-time code. Your mobile number is saved as contact information and is not used for SMS verification.</p>
    {hasVerifiedPendingSession ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><p className="font-semibold">Email verified</p><p className="mt-1">We’ll finish saving your application using your current sign-in. You do not need another verification code.</p></div> : <EmailOtpForm initialEmail={pending.email} lockEmail createUser userMetadata={{ full_name: [pending.firstName, pending.lastName].filter(Boolean).join(' ') }} onVerified={saveApplication} />}
    {saving && <p role="status" className="mt-3 text-sm text-slate-500">Saving your application…</p>}
    {saveError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{saveError}</p><button type="button" onClick={() => pending.email && void saveApplication(pending.email)} disabled={saving} className="mt-2 font-semibold underline disabled:opacity-50">Retry saving application</button></div>}
  </section>{saving && <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="status" aria-live="assertive" aria-busy="true"><div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl"><span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"/><h2 className="mt-4 text-lg font-bold text-slate-900">Saving your application</h2><p className="mt-2 text-sm leading-6 text-slate-600">Please keep this page open. We’re securely saving your details and preparing your recommendations.</p></div></div>}</main>;
}

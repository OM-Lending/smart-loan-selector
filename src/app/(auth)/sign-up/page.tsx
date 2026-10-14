'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';

type PendingApplication = Record<string, unknown> & { firstName?: string; lastName?: string; email?: string; phone?: string };

export default function SignUpPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingApplication | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const saveApplication = async (email: string) => {
    if (!pending) throw new Error('Your application details have expired. Please return to the questionnaire and submit again.');
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch('/api/application/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending, email }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.applicationId) throw new Error(result.error || 'Could not save your application.');
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
    } finally { setSaving(false); }
  };

  if (!loaded) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">Loading…</main>;
  if (!pending) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><section className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-xl font-bold">Application details not found</h1><p className="mt-2 text-sm text-slate-600">Please complete the questionnaire first so we can save your details.</p><button className="mt-5 rounded-full bg-primary px-5 py-3 font-semibold text-white" onClick={() => router.replace('/get-started')}>Back to questionnaire</button></section></main>;

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl sm:p-10">
    <h1 className="text-2xl font-bold text-slate-900">Verify your email{pending.firstName ? `, ${pending.firstName}` : ''}</h1>
    <p className="mb-7 mt-2 text-sm text-slate-600">We’ll email you a one-time code. Your mobile number is saved as contact information and is not used for SMS verification.</p>
    <EmailOtpForm initialEmail={pending.email} lockEmail createUser userMetadata={{ full_name: [pending.firstName, pending.lastName].filter(Boolean).join(' ') }} onVerified={saveApplication} />
    {saving && <p role="status" className="mt-3 text-sm text-slate-500">Saving your application…</p>}
    {saveError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{saveError}</p><button type="button" onClick={() => pending.email && void saveApplication(pending.email)} disabled={saving} className="mt-2 font-semibold underline disabled:opacity-50">Retry saving application</button></div>}
  </section></main>;
}

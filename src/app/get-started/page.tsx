import { Suspense } from 'react';
import { LoanWizard } from '@/components/form/LoanWizard';
import { getAuthenticatedProfile } from '@/server/lib/auth';

export default async function GetStartedPage() {
  const identity = await getAuthenticatedProfile();
  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12 px-4 sm:px-6">
      <Suspense fallback={<div className="text-center mt-20 text-slate-500 font-medium">Loading your profile...</div>}>
        <LoanWizard account={identity ? { clerkUserId: identity.clerkUserId, hasProfile: Boolean(identity.profile), email: identity.email } : null} />
      </Suspense>
    </div>
  );
}

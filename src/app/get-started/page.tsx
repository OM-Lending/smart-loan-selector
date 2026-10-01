import { Suspense } from 'react';
import { LoanWizard } from '@/components/form/LoanWizard';

export default function GetStartedPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12 px-4 sm:px-6">
      <Suspense fallback={<div className="text-center mt-20 text-slate-500 font-medium">Loading your profile...</div>}>
        <LoanWizard />
      </Suspense>
    </div>
  );
}
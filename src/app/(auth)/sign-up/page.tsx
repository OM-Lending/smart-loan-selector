'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, ArrowLeft, Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstName = searchParams.get('name') || 'there';
  const email = searchParams.get('email') || '';
  
  const supabase = createClient();
  
  const [verifyStep, setVerifyStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0); 
  const [isLoading, setIsLoading] = useState(false);

  // Handle OTP resend countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Format local AU number to E.164 standard
  const getFormattedPhone = () => `+61${phone.replace(/^0+/, '')}`;

  const handleSendSMS = async () => {
    if (phone.length < 9) return alert('Please enter a valid mobile number.');
    
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ 
      phone: getFormattedPhone() 
    });
    
    if (error) { 
      alert(error.message); 
      setIsLoading(false); 
      return; 
    }

    setIsLoading(false);
    setVerifyStep('otp');
    setCountdown(60);
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    setIsLoading(true);
    
    const formattedPhone = getFormattedPhone();
    const { data, error } = await supabase.auth.verifyOtp({ 
      phone: formattedPhone, 
      token: otp, 
      type: 'sms' 
    });
    
    if (error || !data.user) { 
      alert(error?.message || 'Invalid verification code'); 
      setIsLoading(false); 
      return; 
    }
    
    const pendingData = JSON.parse(localStorage.getItem('pending_loan_data') || '{}');
    
    try {
      // Save application data linking to the authenticated user session
      const response = await fetch('/api/application/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone: formattedPhone,
          ...pendingData
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success || !result.applicationId) {
        throw new Error(result.error || 'Failed to save application data');
      }

      // Keep the generated result available to the next screen while it is
      // being built; the authenticated GET endpoint can reload it by id.
      localStorage.setItem('application_id', result.applicationId);
      if (result.recommendation) {
        sessionStorage.setItem('recommendation_results', JSON.stringify(result.recommendation));
      }
      sessionStorage.setItem('recommendation_status', result.recommendationStatus || 'PENDING');

      // Clear local cache and open this application's recommendation results.
      localStorage.removeItem('pending_loan_data');
      router.push(`/applications/${result.applicationId}/recommendations`);
      router.refresh(); 
    } catch (err) {
      console.error(err);
      alert(err instanceof Error
        ? `Your phone was verified, but we could not save the application: ${err.message}`
        : 'Your phone was verified, but we could not save the application. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-500">
        
        {verifyStep === 'phone' && (
          <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="h-14 w-14 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Smartphone className="h-7 w-7 text-primary" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Almost there, {firstName}!</h1>
            <p className="text-slate-500 text-sm mb-8">
              To secure your profile and unlock your personalised interest rates, please verify your mobile number.
            </p>

            <label className="text-sm font-bold text-slate-700 mb-2 block">Australian Mobile Number</label>
            <div className="flex gap-2 mb-8">
              <div className="flex items-center justify-center bg-slate-100 border border-border rounded-md px-4 text-sm font-medium text-slate-600">
                +61
              </div>
              <Input 
                type="tel" 
                className="flex-1 h-12 text-lg" 
                placeholder="400 000 000" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                maxLength={10}
              />
            </div>

            <Button 
              className="w-full h-12 text-base font-bold shadow-md hover:shadow-lg transition-all" 
              onClick={handleSendSMS}
              disabled={isLoading || phone.length < 9}
            >
              {isLoading ? 'Sending...' : 'Send verification code'}
            </Button>
            
            <p className="text-xs text-slate-400 text-center mt-6">
              By continuing, you agree to receive secure SMS communications for authentication.
            </p>
          </div>
        )}

        {verifyStep === 'otp' && (
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-right-4 duration-300">
            <button 
              onClick={() => { setVerifyStep('phone'); setOtp(''); }} 
              className="self-start flex items-center text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Change number
            </button>

            <div className="h-14 w-14 bg-green-50 rounded-full flex items-center justify-center mb-6">
              <ShieldCheck className="h-7 w-7 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Enter your code</h1>
            <p className="text-slate-500 text-sm mb-8">
              We&apos;ve sent a 6-digit secure code to <br />
              <span className="font-semibold text-slate-800">+61 {phone}</span>
            </p>

            <Input 
              type="text" 
              maxLength={6} 
              className="text-center tracking-[1em] text-2xl font-mono h-14 mb-6 shadow-sm focus:ring-primary focus:border-primary" 
              placeholder="------" 
              value={otp} 
              onChange={(e) => setOtp(e.target.value)} 
            />

            <Button 
              className="w-full h-12 text-lg font-bold shadow-md hover:shadow-lg transition-all" 
              disabled={otp.length !== 6 || isLoading}
              onClick={handleVerifyOTP}
            >
              {isLoading ? 'Verifying...' : 'Unlock My Rates'}
            </Button>

            <div className="mt-8">
              {countdown > 0 ? (
                <p className="text-sm text-slate-400 font-medium">
                  Resend code in <span className="text-slate-600">{countdown}s</span>
                </p>
              ) : (
                <button 
                  onClick={handleSendSMS} 
                  className="text-sm text-primary font-bold hover:underline transition-all"
                >
                  Didn&apos;t receive the SMS? Resend
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <SignUpContent />
    </Suspense>
  );
}

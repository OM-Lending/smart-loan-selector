'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth, useSignIn, useSignUp } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type EmailOtpFormProps = {
  initialEmail?: string;
  lockEmail?: boolean;
  createUser: boolean;
  userMetadata?: Record<string, string>;
  onVerified: (email: string) => Promise<void> | void;
};

export function EmailOtpForm({ initialEmail = '', lockEmail = false, createUser, userMetadata, onVerified }: EmailOtpFormProps) {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const signUpLoaded = signUpFetchStatus === 'idle';
  const signInLoaded = signInFetchStatus === 'idle';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [restartRequired, setRestartRequired] = useState(false);
  const [verifiedEmailPending, setVerifiedEmailPending] = useState<string | null>(null);
  const completionStarted = useRef(false);

  // Do not navigate or call protected APIs immediately after finalize(). Wait
  // until Clerk has propagated the new active session to its client state.
  useEffect(() => {
    if (!authLoaded || !isSignedIn || !verifiedEmailPending || completionStarted.current) return;
    completionStarted.current = true;
    void (async () => {
      try {
        await onVerified(verifiedEmailPending);
      } catch (cause) {
        setError(getErrorMessage(cause, 'Your email is verified, but the next step could not be completed.'));
      } finally {
        setVerifiedEmailPending(null);
        completionStarted.current = false;
      }
    })();
  }, [authLoaded, isSignedIn, onVerified, verifiedEmailPending]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (createUser ? !signUpLoaded : !signInLoaded) return;
    setBusy(true);
    setError('');
    setNotice('');
    setRestartRequired(false);
    try {
      if (createUser) {
        // Discard a previous attempt created while Clerk still required a password.
        if (signUp.status === 'missing_requirements' && signUp.missingFields.includes('password')) {
          const { error: resetError } = await signUp.reset();
          if (resetError) throw resetError;
        }
        const { error: createError } = await signUp.create({ emailAddress: normalizedEmail, unsafeMetadata: userMetadata });
        if (createError) throw createError;
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) throw sendError;
      } else {
        const { error: createError } = await signIn.create({ identifier: normalizedEmail });
        if (createError) throw createError;
        const { error: sendError } = await signIn.emailCode.sendCode();
        if (sendError) throw sendError;
      }
    } catch (cause) {
      setBusy(false);
      setError(getErrorMessage(cause));
      return;
    }
    setBusy(false);
    setEmail(normalizedEmail);
    setCodeSent(true);
    setCountdown(60);
    setNotice('A verification code has been sent. Check your inbox and spam folder.');
  };

  const verifyCode = async () => {
    if (code.trim().length !== 6) return;
    setBusy(true);
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (createUser) {
        const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
        if (verifyError) throw verifyError;
        if (signUp.status !== 'complete') {
          if (signUp.missingFields.includes('password')) {
            setRestartRequired(true);
            throw new Error('Clerk is still requiring a password for sign-up. In Clerk Dashboard, disable password sign-up, then restart this form.');
          }
          throw new Error('Your sign-up still needs additional information. Check the Clerk sign-up configuration.');
        }
        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) throw finalizeError;
      } else {
        const { error: verifyError } = await signIn.emailCode.verifyCode({ code: code.trim() });
        if (verifyError) throw verifyError;
        if (signIn.status !== 'complete') throw new Error('Sign-in requires an additional verification step. Check the Clerk sign-in configuration.');
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) throw finalizeError;
      }
      setVerified(true);
      setNotice('Email verified.');
      setVerifiedEmailPending(normalizedEmail);
    } catch (cause) {
      setError(getErrorMessage(cause, 'The next step could not be completed.'));
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-4">
    <div>
      <label htmlFor="auth-email" className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
      <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} readOnly={lockEmail || (codeSent && !verified)} disabled={busy || verified} placeholder="you@example.com" />
    </div>
    {createUser && <div id="clerk-captcha" data-cl-theme="light" />}
    {!codeSent ? <Button type="button" className="w-full" onClick={sendCode} disabled={busy || (createUser ? !signUpLoaded : !signInLoaded)}>
      {busy ? 'Sending…' : createUser ? 'Send email verification code' : 'Send login code'}
    </Button> : <>
      <div>
        <label htmlFor="email-otp" className="mb-2 block text-sm font-semibold text-slate-700">6-digit email code</label>
        <Input id="email-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy || verified} placeholder="000000" className="text-center font-mono text-xl tracking-[0.4em]" />
      </div>
      <Button type="button" className="w-full" onClick={verifyCode} disabled={busy || verified || code.length !== 6}>
        {busy ? 'Verifying…' : verified ? 'Email verified' : createUser ? 'Verify email and continue' : 'Verify and sign in'}
      </Button>
      {!verified && <div className="text-center text-sm">
        {countdown > 0 ? <p className="text-slate-500">Resend code in {countdown}s</p> : <button type="button" className="font-semibold text-primary hover:underline" onClick={sendCode} disabled={busy}>Resend code</button>}
        {!lockEmail && <button type="button" className="ml-4 text-slate-500 hover:underline" onClick={() => { setCodeSent(false); setCode(''); setNotice(''); setError(''); }}>Change email</button>}
      </div>}
    </>}
    {restartRequired && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={async () => {
      setBusy(true);
      const { error: resetError } = await signUp.reset();
      setBusy(false);
      if (resetError) { setError(getErrorMessage(resetError)); return; }
      setCode(''); setCodeSent(false); setVerified(false); setCountdown(0); setError(''); setNotice(''); setRestartRequired(false);
    }}>Restart sign-up</Button>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}

function getErrorMessage(error: unknown, fallback = 'Authentication could not be completed.') {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'errors' in error) {
    const errors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    if (errors?.[0]?.longMessage || errors?.[0]?.message) return errors[0].longMessage || errors[0].message!;
  }
  return fallback;
}

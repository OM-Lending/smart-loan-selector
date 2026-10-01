'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Home, RefreshCw, TrendingUp, CheckCircle2 } from 'lucide-react';

export function LoanWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    loanPurpose: 'BUY_NEW',
    propertyType: 'HOUSE',
    propertyPostcode: '2000',
    propertyValue: 900000,
    loanAmount: 720000,
    repaymentType: 'P_AND_I',
    employmentStatus: 'FULL_TIME',
    grossAnnualSalary: 125000,
    fullName: '',
    email: '',
    phone: '',
    maritalStatus: 'SINGLE',
  });

  const calculatedLvr = formData.propertyValue > 0 
    ? Math.round((formData.loanAmount / formData.propertyValue) * 100) 
    : 0;

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.email || !formData.phone) {
      setErrorMessage('Please fill in your contact information');
      return;
    }
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/applications/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to submit application');
      setSubmittedId(result.applicationId || 'SUCCESS');
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (submittedId) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border bg-card p-8 sm:p-12 text-center shadow-lg">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Your Rate Match is Ready!</h3>
        <p className="mt-3 text-muted-foreground">We have matched your profile with live lender rates.</p>
        <div className="mt-6 rounded-2xl bg-muted/50 p-4 border border-border">
          <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Reference ID</span>
          <p className="font-mono text-sm font-bold text-foreground mt-1">{submittedId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-6 sm:p-10 shadow-xl">
      <div className="mb-8 flex items-center justify-between border-b pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Step {step} of 4</span>
          <h3 className="text-sm font-medium text-muted-foreground">
            {step === 1 && 'Loan Purpose & Security'}
            {step === 2 && 'Loan Size & LVR'}
            {step === 3 && 'Income & Preference'}
            {step === 4 && 'Your Contact Details'}
          </h3>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-2 w-8 rounded-full transition-all duration-300 ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
          {errorMessage}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">What is your primary goal?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'BUY_NEW', label: 'Buy a Home', icon: Home },
              { id: 'REFINANCE', label: 'Refinance', icon: RefreshCw },
              { id: 'INVESTMENT', label: 'Invest', icon: TrendingUp },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFormData({ ...formData, loanPurpose: id })}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all ${
                  formData.loanPurpose === id
                    ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50 text-muted-foreground bg-background'
                }`}
              >
                <Icon className={`h-6 w-6 mb-2 ${formData.loanPurpose === id ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>
          <div>
            <Label className="mb-2 block">Property Location (Postcode)</Label>
            <Input
              type="text"
              maxLength={4}
              value={formData.propertyPostcode}
              onChange={(e) => setFormData({ ...formData, propertyPostcode: e.target.value })}
              placeholder="e.g. 2000"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8">
          <h2 className="text-xl font-bold text-foreground">Property & Loan Amount</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Estimated Property Value</Label>
              <span className="font-semibold font-mono">${formData.propertyValue.toLocaleString()}</span>
            </div>
            <Slider
              min={100000}
              max={3000000}
              step={10000}
              value={[formData.propertyValue]}
              onValueChange={(val) => setFormData({ ...formData, propertyValue: val[0] })}
            />
            <Input
              type="number"
              value={formData.propertyValue}
              onChange={(e) => setFormData({ ...formData, propertyValue: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Desired Loan Amount</Label>
              <span className="font-semibold font-mono">${formData.loanAmount.toLocaleString()}</span>
            </div>
            <Slider
              min={50000}
              max={formData.propertyValue}
              step={10000}
              value={[formData.loanAmount]}
              onValueChange={(val) => setFormData({ ...formData, loanAmount: val[0] })}
            />
            <Input
              type="number"
              value={formData.loanAmount}
              onChange={(e) => setFormData({ ...formData, loanAmount: Number(e.target.value) })}
            />
          </div>

          <div className="p-4 bg-muted/50 border rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-foreground">Estimated LVR</p>
              <p className="text-xs text-muted-foreground">Below 80% usually waives LMI</p>
            </div>
            <span className={`text-lg font-bold font-mono ${calculatedLvr > 80 ? 'text-destructive' : 'text-primary'}`}>
              {calculatedLvr}%
            </span>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">Employment & Repayments</h2>
          <div>
            <Label className="mb-2 block">Gross Annual Salary (AUD)</Label>
            <Input
              type="number"
              step={5000}
              value={formData.grossAnnualSalary}
              onChange={(e) => setFormData({ ...formData, grossAnnualSalary: Number(e.target.value) })}
            />
          </div>

          <div>
            <Label className="mb-2 block">Repayment Structure</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'P_AND_I', label: 'Principal & Interest' },
                { id: 'INTEREST_ONLY', label: 'Interest Only' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, repaymentType: item.id })}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                    formData.repaymentType === item.id
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border text-muted-foreground bg-background hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Receive Your Rate Comparison</h2>
          <p className="text-sm text-muted-foreground mb-4">No credit checks conducted.</p>
          <div>
            <Label className="mb-1 block">Full Legal Name</Label>
            <Input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="e.g. David Smith"
            />
          </div>
          <div>
            <Label className="mb-1 block">Email Address</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="david.smith@example.com.au"
            />
          </div>
          <div>
            <Label className="mb-1 block">Australian Mobile</Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0400 000 000"
            />
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between border-t pt-5">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
        ) : <div />}
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)}>Continue</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Matching Rates...' : 'See Matched Rates'}
          </Button>
        )}
      </div>
    </div>
  );
}
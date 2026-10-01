'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Home, RefreshCw, Minus, Plus } from 'lucide-react';
import { QUESTIONNAIRE } from '@/config/questionnaire';

export interface WizardFormData {
  goal: 'BUY' | 'REFINANCE' | '';
  buySituation: string;
  isFirstHomeBuyer: boolean | null;
  propertyUse: string;
  propertyStatus: string;
  propertyType: string;
  propertyPostcode: string;
  purchasePrice: number | '';
  deposit: number | '';
  refinanceGoal: string;
  cashOutPurpose: string;
  propertyAddress: string;
  currentLender: string;
  propertyValue: number | '';
  currentLoanBalance: number | '';
  currentInterestRate: number | '';
  currentRepaymentType: string;
  isFixedRate: boolean | null;
  fixedRateExpiry: string;
  repaymentStructure: string;
  interestOnlyYears: string;
  ratePreference: string;
  fixedYears: string;
  employmentStatus: string;
  employmentStartDate: string;
  grossAnnualSalary: number | '';
  relationshipStatus: string;
  partnerEmploymentStatus: string;
  partnerEmploymentStartDate: string;
  partnerGrossSalary: number | '';
  dependents: number;
  hasExistingLoans: boolean | null;
  existingMonthlyRepayment: number | '';
  hasCreditCard: boolean | null;
  creditCardLimit: number | '';
  firstName: string;
  lastName: string;
  email: string;
}

const STEP_URLS = ['your-goal', 'property-details', 'loan-preferences', 'personal-profile', 'contact-details'];

export function LoanWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q');
  
  const [prevQuery, setPrevQuery] = useState(currentQuery);
  const initialStep = Math.max(1, STEP_URLS.indexOf(currentQuery || '') + 1);
  const [step, setStep] = useState(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<WizardFormData>({
    goal: '', buySituation: '', isFirstHomeBuyer: null, propertyUse: '', propertyStatus: '', propertyType: '', propertyPostcode: '', purchasePrice: '', deposit: '',
    refinanceGoal: '', cashOutPurpose: '', propertyAddress: '', currentLender: '', propertyValue: '', currentLoanBalance: '', currentInterestRate: '', currentRepaymentType: '', isFixedRate: null, fixedRateExpiry: '',
    repaymentStructure: '', interestOnlyYears: '', ratePreference: '', fixedYears: '',
    employmentStatus: '', employmentStartDate: '', grossAnnualSalary: '', relationshipStatus: '', partnerEmploymentStatus: '', partnerEmploymentStartDate: '', partnerGrossSalary: '', dependents: 0, hasExistingLoans: null, existingMonthlyRepayment: '', hasCreditCard: null, creditCardLimit: '',
    firstName: '', lastName: '', email: ''
  });

  if (currentQuery !== prevQuery) {
    setPrevQuery(currentQuery);
    const queryIndex = STEP_URLS.indexOf(currentQuery || '');
    if (queryIndex !== -1 && queryIndex + 1 !== step) {
      setStep(queryIndex + 1);
    }
  }

  const updateForm = (updates: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const updateUrlAndStep = (newStep: number) => {
    const queryName = STEP_URLS[newStep - 1];
    setStep(newStep);
    router.push(`?q=${queryName}`, { scroll: false });
  };

  const handleRateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    if (val < 0.01) val = 0.01;
    if (val > 99.99) val = 99.99;
    updateForm({ currentInterestRate: Number(val.toFixed(2)) });
  };

  const incrementDependents = () => updateForm({ dependents: formData.dependents + 1 });
  const decrementDependents = () => updateForm({ dependents: Math.max(0, formData.dependents - 1) });

  const handleNext = () => {
    if (step === 1 && !formData.goal) {
      return alert('Please select your goal.');
    }
    
    if (step === 5) {
      if (!formData.firstName || !formData.lastName || !formData.email) {
        return alert('Please fill in your name and email before continuing.');
      }
      
      setIsSubmitting(true);
      
      // Save partial lead data to localStorage for retrieval after authentication
      localStorage.setItem('pending_loan_data', JSON.stringify(formData));
      
      setTimeout(() => {
        router.push(`/sign-up?name=${encodeURIComponent(formData.firstName)}&email=${encodeURIComponent(formData.email)}`);
      }, 800);
      return;
    }

    updateUrlAndStep(step + 1);
  };

  const handleBack = () => updateUrlAndStep(Math.max(1, step - 1));

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-6 sm:p-10 shadow-xl min-h-[600px] flex flex-col relative overflow-hidden">
      
      {isSubmitting && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
          <p className="font-semibold text-slate-700">Saving your preferences...</p>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between border-b pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Step {step} of 5
          </span>
          <h3 className="text-sm font-medium text-muted-foreground mt-1">
            {step === 1 && 'Your Goal'}
            {step === 2 && (formData.goal === 'REFINANCE' ? 'Refinance Details' : 'Buying Details')}
            {step === 3 && 'Loan Preferences'}
            {step === 4 && 'Personal & Financial Profile'}
            {step === 5 && 'Contact Details'}
          </h3>
        </div>
      </div>

      <div className="flex-1">
        
        {/* ================= STEP 1 ================= */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-bold text-foreground text-center">What are you looking to do?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <button
                onClick={() => { updateForm({ goal: 'BUY' }); updateUrlAndStep(2); }}
                className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all ${
                  formData.goal === 'BUY' ? 'border-primary bg-primary/5 ring-4 ring-primary/20' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Home className="h-8 w-8 text-primary" />
                </div>
                <span className="text-lg font-bold text-slate-800">Buy a home</span>
              </button>

              <button
                onClick={() => { updateForm({ goal: 'REFINANCE' }); updateUrlAndStep(2); }}
                className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all ${
                  formData.goal === 'REFINANCE' ? 'border-primary bg-primary/5 ring-4 ring-primary/20' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <RefreshCw className="h-8 w-8 text-primary" />
                </div>
                <span className="text-lg font-bold text-slate-800">Refinance</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: BUY ================= */}
        {step === 2 && formData.goal === 'BUY' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <Label className="text-base font-bold mb-3 block">What best describes your home buying situation?</Label>
              <div className="grid grid-cols-1 gap-2">
                {QUESTIONNAIRE.buySituations.map((item) => (
                  <button
                    key={item.id} onClick={() => updateForm({ buySituation: item.id })}
                    className={`p-3 rounded-xl border text-left font-medium transition-all ${formData.buySituation === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-bold mb-3 block">Are you a first home buyer?</Label>
              <div className="grid grid-cols-2 gap-3">
                {QUESTIONNAIRE.booleanOptions.map((opt) => (
                  <button key={opt.label} onClick={() => updateForm({ isFirstHomeBuyer: opt.value })} className={`p-3 rounded-xl border font-medium transition-all ${formData.isFirstHomeBuyer === opt.value ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{opt.label}</button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-bold mb-3 block">How will this property be used?</Label>
              <div className="grid grid-cols-2 gap-3">
                {QUESTIONNAIRE.propertyUses.map((item) => (
                  <button key={item.id} onClick={() => updateForm({ propertyUse: item.id })} className={`p-3 rounded-xl border font-medium transition-all ${formData.propertyUse === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-bold mb-3 block">What kind of property are you looking to buy?</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                {QUESTIONNAIRE.propertyStatuses.map((status) => (
                  <button key={status.id} onClick={() => updateForm({ propertyStatus: status.id, propertyType: status.id === 'VACANT_LAND' ? '' : formData.propertyType })} className={`p-3 rounded-xl border text-sm font-medium transition-all ${formData.propertyStatus === status.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{status.label}</button>
                ))}
              </div>
              
              {(formData.propertyStatus === 'ESTABLISHED' || formData.propertyStatus === 'NEW') && (
                <div className="p-4 bg-slate-50 rounded-xl border animate-in fade-in">
                  <p className="text-sm text-slate-500 mb-3 font-medium">Select property type:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {QUESTIONNAIRE.propertyTypes.map((type) => (
                      <button key={type.id} onClick={() => updateForm({ propertyType: type.id })} className={`p-2 rounded-lg border text-xs font-semibold transition-all ${formData.propertyType === type.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-600'}`}>{type.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-base font-bold mb-2 block">Property Location</Label>
              <Input type="text" placeholder="Australian Postcode e.g. 2000" maxLength={4} value={formData.propertyPostcode} onChange={(e) => updateForm({ propertyPostcode: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
              <div>
                <Label className="text-base font-bold mb-2 block">Expected purchase price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                  <Input type="number" className="pl-7" placeholder="0" value={formData.purchasePrice} onChange={(e) => updateForm({ purchasePrice: Number(e.target.value) || '' })} />
                </div>
              </div>
              <div>
                <Label className="text-base font-bold mb-2 block">Available deposit</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                  <Input type="number" className="pl-7" placeholder="0" value={formData.deposit} onChange={(e) => updateForm({ deposit: Number(e.target.value) || '' })} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: REFINANCE ================= */}
        {step === 2 && formData.goal === 'REFINANCE' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <Label className="text-base font-bold mb-3 block">What's your refinancing goal?</Label>
              <div className="grid grid-cols-1 gap-2">
                {QUESTIONNAIRE.refinanceGoals.map((item) => (
                  <button key={item.id} onClick={() => updateForm({ refinanceGoal: item.id })} className={`p-3 rounded-xl border text-left font-medium transition-all ${formData.refinanceGoal === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                ))}
              </div>
              {formData.refinanceGoal === 'CASH_OUT' && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border animate-in fade-in">
                  <Label className="text-sm font-semibold mb-2 block text-slate-600">Please state your purpose for cash out</Label>
                  <Input type="text" placeholder="e.g. Home renovation, Buying a car" value={formData.cashOutPurpose} onChange={(e) => updateForm({ cashOutPurpose: e.target.value })} />
                </div>
              )}
            </div>

            <div>
              <Label className="text-base font-bold mb-3 block">How will this property be used?</Label>
              <div className="grid grid-cols-2 gap-3">
                {QUESTIONNAIRE.propertyUses.map((item) => (
                  <button key={item.id} onClick={() => updateForm({ propertyUse: item.id })} className={`p-3 rounded-xl border font-medium transition-all ${formData.propertyUse === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-bold mb-2 block">Property Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {QUESTIONNAIRE.propertyTypes.map((type) => (
                  <button key={type.id} onClick={() => updateForm({ propertyType: type.id })} className={`p-2 rounded-lg border text-sm font-semibold transition-all ${formData.propertyType === type.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-slate-600'}`}>{type.label}</button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-bold mb-2 block">Property Address</Label>
              <Input type="text" placeholder="Full property address" value={formData.propertyAddress} onChange={(e) => updateForm({ propertyAddress: e.target.value })} />
            </div>

            <div>
              <Label className="text-base font-bold mb-2 block">Who is your current lender?</Label>
              <Input 
                type="text" 
                list="lenders-list" 
                placeholder="Search lender or type 'Other'" 
                value={formData.currentLender} 
                onChange={(e) => updateForm({ currentLender: e.target.value })} 
              />
              <datalist id="lenders-list">
                {QUESTIONNAIRE.lenders.map(lender => (
                  <option key={lender} value={lender} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
              <div>
                <Label className="text-base font-bold mb-2 block">Estimated property value</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                  <Input type="number" className="pl-7" placeholder="0" value={formData.propertyValue} onChange={(e) => updateForm({ propertyValue: Number(e.target.value) || '' })} />
                </div>
              </div>
              <div>
                <Label className="text-base font-bold mb-2 block">Current loan balance</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                  <Input type="number" className="pl-7" placeholder="0" value={formData.currentLoanBalance} onChange={(e) => updateForm({ currentLoanBalance: Number(e.target.value) || '' })} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label className="text-base font-bold mb-2 block">Current interest rate</Label>
                <div className="relative">
                  <Input type="number" className="pr-8" placeholder="0.00" value={formData.currentInterestRate} onChange={(e) => updateForm({ currentInterestRate: Number(e.target.value) || '' })} onBlur={handleRateBlur} />
                  <span className="absolute right-3 top-2.5 text-slate-500">%</span>
                </div>
              </div>
              <div>
                <Label className="text-base font-bold mb-2 block">Repayment Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {QUESTIONNAIRE.repaymentStructures.map((type) => (
                    <button key={type.id} onClick={() => updateForm({ currentRepaymentType: type.id })} className={`p-2 rounded-lg border text-sm font-semibold transition-all ${formData.currentRepaymentType === type.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-slate-600'}`}>{type.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-base font-bold mb-3 block">Are you currently on a fixed rate?</Label>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {QUESTIONNAIRE.booleanOptions.map((opt) => (
                  <button key={opt.label} onClick={() => updateForm({ isFixedRate: opt.value, fixedRateExpiry: opt.value === false ? '' : formData.fixedRateExpiry })} className={`p-3 rounded-xl border font-medium transition-all ${formData.isFixedRate === opt.value ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{opt.label}</button>
                ))}
              </div>
              
              {formData.isFixedRate === true && (
                <div className="animate-in fade-in max-w-[200px]">
                  <Label className="text-sm font-semibold mb-2 block text-slate-600">Fixed term expiry date</Label>
                  <Input type="text" placeholder="MM/YYYY" value={formData.fixedRateExpiry} onChange={(e) => updateForm({ fixedRateExpiry: e.target.value })} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 3: PREFERENCES ================= */}
        {step === 3 && (
           <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
             <div>
               <Label className="text-base font-bold mb-3 block">Repayment Structure</Label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {QUESTIONNAIRE.repaymentStructures.map((item) => (
                   <button key={item.id} onClick={() => updateForm({ repaymentStructure: item.id, interestOnlyYears: item.id === 'P_AND_I' ? '' : formData.interestOnlyYears })} className={`p-3 rounded-xl border font-medium transition-all ${formData.repaymentStructure === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                 ))}
               </div>
               
               {formData.repaymentStructure === 'INTEREST_ONLY' && (
                 <div className="mt-4 p-4 bg-slate-50 rounded-xl border animate-in fade-in">
                   <p className="text-sm text-slate-500 mb-3 font-medium">How many years?</p>
                   <div className="flex gap-2">
                     {QUESTIONNAIRE.interestOnlyYears.map(year => (
                       <button key={year} onClick={() => updateForm({ interestOnlyYears: year })} className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${formData.interestOnlyYears === year ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-600'}`}>{year}</button>
                     ))}
                   </div>
                 </div>
               )}
             </div>

             <div>
               <Label className="text-base font-bold mb-3 block">Rate Type Preference</Label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {QUESTIONNAIRE.ratePreferences.map((item) => (
                   <button key={item.id} onClick={() => updateForm({ ratePreference: item.id, fixedYears: item.id === 'VARIABLE' ? '' : formData.fixedYears })} className={`p-3 rounded-xl border font-medium transition-all ${formData.ratePreference === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                 ))}
               </div>

               {formData.ratePreference === 'FIXED' && (
                 <div className="mt-4 p-4 bg-slate-50 rounded-xl border animate-in fade-in">
                   <p className="text-sm text-slate-500 mb-3 font-medium">Fixed for how many years?</p>
                   <div className="flex gap-2">
                     {QUESTIONNAIRE.fixedYears.map(year => (
                       <button key={year} onClick={() => updateForm({ fixedYears: year })} className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${formData.fixedYears === year ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-600'}`}>{year}</button>
                     ))}
                   </div>
                 </div>
               )}
             </div>
           </div>
        )}
        
        {/* ================= STEP 4: PERSONAL & FINANCIAL ================= */}
        {step === 4 && (
           <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
             
             <div>
               <Label className="text-base font-bold mb-3 block">Employment Status</Label>
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                 {QUESTIONNAIRE.employmentStatuses.map((item) => (
                   <button key={item.id} onClick={() => updateForm({ employmentStatus: item.id })} className={`p-3 rounded-xl border text-sm font-medium transition-all ${formData.employmentStatus === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                 ))}
               </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div>
                 <Label className="text-base font-bold mb-2 block">Employment Start Date</Label>
                 <Input type="text" placeholder="MM/YYYY" value={formData.employmentStartDate} onChange={(e) => updateForm({ employmentStartDate: e.target.value })} />
               </div>
               <div>
                 <Label className="text-base font-bold mb-2 block">Gross Annual Salary</Label>
                 <div className="relative">
                   <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                   <Input type="number" className="pl-7" placeholder="Before tax" value={formData.grossAnnualSalary} onChange={(e) => updateForm({ grossAnnualSalary: Number(e.target.value) || '' })} />
                 </div>
               </div>
             </div>

             <div>
               <Label className="text-base font-bold mb-3 block">Relationship Status</Label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {QUESTIONNAIRE.relationshipStatuses.map((item) => (
                   <button key={item.id} onClick={() => updateForm({ relationshipStatus: item.id })} className={`p-3 rounded-xl border text-sm font-medium transition-all ${formData.relationshipStatus === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                 ))}
               </div>
             </div>

             {formData.relationshipStatus === 'MARRIED_DE_FACTO' && (
               <div className="p-6 bg-slate-50 rounded-xl border animate-in fade-in space-y-6">
                 <h4 className="font-bold text-slate-800">Partner's Employment Details</h4>
                 <div>
                   <Label className="text-sm font-semibold mb-3 block text-slate-600">Partner's Employment Status</Label>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                     {QUESTIONNAIRE.employmentStatuses.map((item) => (
                       <button key={item.id} onClick={() => updateForm({ partnerEmploymentStatus: item.id })} className={`p-2 rounded-lg border text-xs font-semibold transition-all ${formData.partnerEmploymentStatus === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-600'}`}>{item.label}</button>
                     ))}
                   </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <Label className="text-sm font-semibold mb-2 block text-slate-600">Start Date</Label>
                     <Input type="text" placeholder="MM/YYYY" value={formData.partnerEmploymentStartDate} onChange={(e) => updateForm({ partnerEmploymentStartDate: e.target.value })} />
                   </div>
                   <div>
                     <Label className="text-sm font-semibold mb-2 block text-slate-600">Gross Salary</Label>
                     <div className="relative">
                       <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                       <Input type="number" className="pl-7" placeholder="Before tax" value={formData.partnerGrossSalary} onChange={(e) => updateForm({ partnerGrossSalary: Number(e.target.value) || '' })} />
                     </div>
                   </div>
                 </div>
               </div>
             )}

             <div>
               <Label className="text-base font-bold mb-3 block">Do you have any financial dependents?</Label>
               <div className="flex items-center gap-4">
                 <button onClick={decrementDependents} className="h-10 w-10 flex items-center justify-center rounded-full border border-border hover:bg-slate-50 active:bg-slate-100 transition-colors">
                   <Minus className="h-4 w-4 text-slate-600" />
                 </button>
                 <span className="text-xl font-bold w-4 text-center">{formData.dependents}</span>
                 <button onClick={incrementDependents} className="h-10 w-10 flex items-center justify-center rounded-full border border-border hover:bg-slate-50 active:bg-slate-100 transition-colors">
                   <Plus className="h-4 w-4 text-slate-600" />
                 </button>
                 <span className="text-sm text-slate-500 ml-2">{formData.dependents >= 4 ? 'or more' : ''}</span>
               </div>
             </div>

             <div>
               <Label className="text-base font-bold mb-3 block">Do you have any existing home loan, car loan, or personal loan?</Label>
               <div className="grid grid-cols-2 gap-3 mb-4">
                 {QUESTIONNAIRE.booleanOptions.map((opt) => (
                   <button key={opt.label} onClick={() => updateForm({ hasExistingLoans: opt.value, existingMonthlyRepayment: opt.value === false ? '' : formData.existingMonthlyRepayment })} className={`p-3 rounded-xl border font-medium transition-all ${formData.hasExistingLoans === opt.value ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{opt.label}</button>
                 ))}
               </div>
               
               {formData.hasExistingLoans === true && (
                 <div className="animate-in fade-in max-w-sm">
                   <Label className="text-sm font-semibold mb-2 block text-slate-600">Total monthly repayment</Label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                     <Input type="number" className="pl-7" placeholder="0" value={formData.existingMonthlyRepayment} onChange={(e) => updateForm({ existingMonthlyRepayment: Number(e.target.value) || '' })} />
                   </div>
                 </div>
               )}
             </div>

             <div>
               <Label className="text-base font-bold mb-3 block">Do you have any credit card?</Label>
               <div className="grid grid-cols-2 gap-3 mb-4">
                 {QUESTIONNAIRE.booleanOptions.map((opt) => (
                   <button key={opt.label} onClick={() => updateForm({ hasCreditCard: opt.value, creditCardLimit: opt.value === false ? '' : formData.creditCardLimit })} className={`p-3 rounded-xl border font-medium transition-all ${formData.hasCreditCard === opt.value ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{opt.label}</button>
                 ))}
               </div>
               
               {formData.hasCreditCard === true && (
                 <div className="animate-in fade-in max-w-sm">
                   <Label className="text-sm font-semibold mb-2 block text-slate-600">Credit card limit</Label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                     <Input type="number" className="pl-7" placeholder="0" value={formData.creditCardLimit} onChange={(e) => updateForm({ creditCardLimit: Number(e.target.value) || '' })} />
                   </div>
                 </div>
               )}
             </div>

           </div>
        )}
        
        {/* ================= STEP 5: CONTACT (Name & Email Lead Capture) ================= */}
        {step === 5 && (
           <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="text-center mb-8">
               <h2 className="text-2xl font-bold text-foreground">Your home loan options await!</h2>
               <p className="text-slate-500 mt-2 text-sm">Where should we send your preliminary rate match?</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label className="mb-2 block font-semibold">First Name</Label>
                 <Input type="text" value={formData.firstName} onChange={(e) => updateForm({ firstName: e.target.value })} disabled={isSubmitting} />
               </div>
               <div>
                 <Label className="mb-2 block font-semibold">Last Name</Label>
                 <Input type="text" value={formData.lastName} onChange={(e) => updateForm({ lastName: e.target.value })} disabled={isSubmitting} />
               </div>
             </div>

             <div>
               <Label className="mb-2 block font-semibold">Email Address</Label>
               <Input type="email" placeholder="hello@example.com.au" value={formData.email} onChange={(e) => updateForm({ email: e.target.value })} disabled={isSubmitting} />
             </div>
           </div>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between border-t pt-6">
        {step > 1 ? (
          <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>Back</Button>
        ) : (
          <Button variant="ghost" onClick={() => router.push('/')} disabled={isSubmitting}>Cancel</Button>
        )}
        
        {step < 5 && (
          <Button onClick={handleNext} className="px-8">Continue</Button>
        )}

        {step === 5 && (
          <Button onClick={handleNext} disabled={isSubmitting} className="px-8 bg-primary hover:bg-primary/90 text-white font-bold">
            Get My Rates
          </Button>
        )}
      </div>
    </div>
  );
}
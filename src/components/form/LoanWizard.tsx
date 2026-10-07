'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Home, RefreshCw, Minus, Plus } from 'lucide-react';

import { ApplicationSchema, type ApplicationPayload } from '@/lib/validations/application';
import { QUESTIONNAIRE } from '@/config/questionnaire';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STEP_URLS = ['your-goal', 'property-details', 'loan-preferences', 'personal-profile', 'contact-details'];

export function LoanWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q');
  const initialStep = Math.max(1, STEP_URLS.indexOf(currentQuery || '') + 1);
  
  const [step, setStep] = useState(initialStep);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm<ApplicationPayload>({
    resolver: zodResolver(ApplicationSchema),
    mode: 'onChange',
    defaultValues: {
      goal: undefined,
      isFirstHomeBuyer: false,
      hasExistingLoans: false,
      hasCreditCard: false,
      dependents: 0,
      firstName: '',
      lastName: '',
      email: '',
    },
  });

  const formValues = watch();

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
    setValue('currentInterestRate', Number(val.toFixed(2)), { shouldValidate: true });
  };

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
      e.target.value = val.replace(/^0+/, '');
    }
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // only keep digits
    
    if (val.length > 0) {
      let month = val.substring(0, 2);
      // if the first digit is greater than 1, prepend a 0 to make it a valid month
      if (month.length === 1 && parseInt(month) > 1) {
        month = `0${month}`;
      } 
      // if the month is 2 digits, ensure it's between 01 and 12
      else if (month.length === 2) {
        if (parseInt(month) > 12) month = '12';
        if (parseInt(month) === 0) month = '01';
      }
      val = month + val.substring(2);
    }

    if (val.length >= 3) {
      val = val.substring(0, 2) + '/' + val.substring(2, 6);
    }
    e.target.value = val;
  };

  const handleNext = async () => {
    let isStepValid = false;

    if (step === 1) {
      isStepValid = await trigger(['goal']);
    } else if (step === 2) {
      if (formValues.goal === 'BUY') {
        isStepValid = await trigger(['buySituation', 'isFirstHomeBuyer', 'propertyUse', 'propertyStatus', 'propertyType', 'propertyPostcode', 'purchasePrice', 'deposit']);
      } else {
        isStepValid = await trigger(['refinanceGoal', 'cashOutPurpose', 'propertyUse', 'propertyType', 'propertyAddress', 'currentLender', 'propertyValue', 'currentLoanBalance', 'currentInterestRate', 'currentRepaymentType', 'isFixedRate', 'fixedRateExpiry']);
      }
    } else if (step === 3) {
      isStepValid = await trigger(['repaymentStructure', 'interestOnlyYears', 'ratePreference', 'fixedYears']);
    } else if (step === 4) {
      isStepValid = await trigger(['employmentStatus', 'employmentStartDate', 'grossAnnualSalary', 'relationshipStatus', 'partnerEmploymentStatus', 'partnerEmploymentStartDate', 'partnerGrossSalary', 'dependents', 'hasExistingLoans', 'existingMonthlyRepayment', 'hasCreditCard', 'creditCardLimit']);
    }

    if (isStepValid) {
      updateUrlAndStep(step + 1);
    }
  };

  const onSubmit = async (data: ApplicationPayload) => {
    localStorage.setItem('pending_loan_data', JSON.stringify(data));
    setTimeout(() => {
      router.push(`/sign-up?name=${encodeURIComponent(data.firstName || '')}&email=${encodeURIComponent(data.email || '')}`);
    }, 800);
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
            {step === 2 && (formValues.goal === 'REFINANCE' ? 'Refinance Details' : 'Buying Details')}
            {step === 3 && 'Loan Preferences'}
            {step === 4 && 'Personal & Financial Profile'}
            {step === 5 && 'Contact Details'}
          </h3>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
        <div className="flex-1">
          
          {/* ================= STEP 1 ================= */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-bold text-foreground text-center">What are you looking to do?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setValue('goal', 'BUY', { shouldValidate: true })}
                  className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all ${
                    formValues.goal === 'BUY' ? 'border-primary bg-primary/5 ring-4 ring-primary/20' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Home className="h-8 w-8 text-primary" />
                  </div>
                  <span className="text-lg font-bold text-slate-800">Buy a home</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('goal', 'REFINANCE', { shouldValidate: true })}
                  className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all ${
                    formValues.goal === 'REFINANCE' ? 'border-primary bg-primary/5 ring-4 ring-primary/20' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <RefreshCw className="h-8 w-8 text-primary" />
                  </div>
                  <span className="text-lg font-bold text-slate-800">Refinance</span>
                </button>
              </div>
              {errors.goal && <p className="text-red-500 text-center text-sm mt-2">{errors.goal.message}</p>}
            </div>
          )}

          {/* ================= STEP 2: BUY ================= */}
          {step === 2 && formValues.goal === 'BUY' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <Label className="text-base font-bold mb-3 block">What best describes your home buying situation?</Label>
                <div className="grid grid-cols-1 gap-2">
                  {QUESTIONNAIRE.buySituations.map((item) => (
                    <button
                      type="button"
                      key={item.id} 
                      onClick={() => setValue('buySituation', item.id, { shouldValidate: true })}
                      className={`p-3 rounded-xl border text-left font-medium transition-all ${formValues.buySituation === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}
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
                    <button type="button" key={opt.label} onClick={() => setValue('isFirstHomeBuyer', opt.value, { shouldValidate: true })} className={`p-3 rounded-xl border font-medium transition-all ${formValues.isFirstHomeBuyer === opt.value ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-bold mb-3 block">How will this property be used?</Label>
                <div className="grid grid-cols-2 gap-3">
                  {QUESTIONNAIRE.propertyUses.map((item) => (
                    <button type="button" key={item.id} onClick={() => setValue('propertyUse', item.id, { shouldValidate: true })} className={`p-3 rounded-xl border font-medium transition-all ${formValues.propertyUse === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                  ))}
                </div>
                {errors.propertyUse && <p className="text-red-500 text-sm mt-1">{errors.propertyUse.message}</p>}
              </div>

              <div>
                <Label className="text-base font-bold mb-3 block">What kind of property are you looking to buy?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  {QUESTIONNAIRE.propertyStatuses.map((status) => (
                    <button type="button" key={status.id} onClick={() => {
                      setValue('propertyStatus', status.id, { shouldValidate: true });
                      if (status.id === 'VACANT_LAND') setValue('propertyType', '', { shouldValidate: true });
                    }} className={`p-3 rounded-xl border text-sm font-medium transition-all ${formValues.propertyStatus === status.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{status.label}</button>
                  ))}
                </div>
                
                {(formValues.propertyStatus === 'ESTABLISHED' || formValues.propertyStatus === 'NEW') && (
                  <div className="p-4 bg-slate-50 rounded-xl border animate-in fade-in">
                    <p className="text-sm text-slate-500 mb-3 font-medium">Select property type:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {QUESTIONNAIRE.propertyTypes.map((type) => (
                        <button type="button" key={type.id} onClick={() => setValue('propertyType', type.id, { shouldValidate: true })} className={`p-2 rounded-lg border text-xs font-semibold transition-all ${formValues.propertyType === type.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-600'}`}>{type.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-base font-bold mb-2 block">Property Location</Label>
                <Input type="text" placeholder="Australian Postcode e.g. 2000" maxLength={4} {...register('propertyPostcode')} />
                {errors.propertyPostcode && <p className="text-red-500 text-sm mt-1">{errors.propertyPostcode.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
                <div>
                  <Label className="text-base font-bold mb-2 block">Expected purchase price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                    <Input type="number" className="pl-7" placeholder="0" {...register('purchasePrice', { onChange: handleNumberInput })} />
                  </div>
                  {errors.purchasePrice && <p className="text-red-500 text-sm mt-1">{errors.purchasePrice.message}</p>}
                </div>
                <div>
                  <Label className="text-base font-bold mb-2 block">Available deposit</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                    <Input type="number" className="pl-7" placeholder="0" {...register('deposit', { onChange: handleNumberInput })} />
                  </div>
                  {errors.deposit && <p className="text-red-500 text-sm mt-1">{errors.deposit.message}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: REFINANCE ================= */}
          {step === 2 && formValues.goal === 'REFINANCE' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <Label className="text-base font-bold mb-3 block">What's your refinancing goal?</Label>
                <div className="grid grid-cols-1 gap-2">
                  {QUESTIONNAIRE.refinanceGoals.map((item) => (
                    <button type="button" key={item.id} onClick={() => setValue('refinanceGoal', item.id, { shouldValidate: true })} className={`p-3 rounded-xl border text-left font-medium transition-all ${formValues.refinanceGoal === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                  ))}
                </div>
                {formValues.refinanceGoal === 'CASH_OUT' && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border animate-in fade-in">
                    <Label className="text-sm font-semibold mb-2 block text-slate-600">Please state your purpose for cash out</Label>
                    <Input type="text" placeholder="e.g. Home renovation, Buying a car" {...register('cashOutPurpose')} />
                  </div>
                )}
              </div>

              <div>
                <Label className="text-base font-bold mb-3 block">How will this property be used?</Label>
                <div className="grid grid-cols-2 gap-3">
                  {QUESTIONNAIRE.propertyUses.map((item) => (
                    <button type="button" key={item.id} onClick={() => setValue('propertyUse', item.id, { shouldValidate: true })} className={`p-3 rounded-xl border font-medium transition-all ${formValues.propertyUse === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-bold mb-2 block">Property Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {QUESTIONNAIRE.propertyTypes.map((type) => (
                    <button type="button" key={type.id} onClick={() => setValue('propertyType', type.id, { shouldValidate: true })} className={`p-2 rounded-lg border text-sm font-semibold transition-all ${formValues.propertyType === type.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-slate-600'}`}>{type.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-bold mb-2 block">Property Address</Label>
                <Input type="text" placeholder="Full property address" {...register('propertyAddress')} />
              </div>

              <div>
                <Label className="text-base font-bold mb-2 block">Who is your current lender?</Label>
                <Input 
                  type="text" 
                  list="lenders-list" 
                  placeholder="Search lender or type 'Other'" 
                  {...register('currentLender')}
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
                    <Input type="number" className="pl-7" placeholder="0" {...register('propertyValue', { onChange: handleNumberInput })} />
                  </div>
                </div>
                <div>
                  <Label className="text-base font-bold mb-2 block">Current loan balance</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                    <Input type="number" className="pl-7" placeholder="0" {...register('currentLoanBalance', { onChange: handleNumberInput })} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label className="text-base font-bold mb-2 block">Current interest rate</Label>
                  <div className="relative">
                    <Input type="number" className="pr-8" placeholder="0.00" {...register('currentInterestRate')} onBlur={handleRateBlur} />
                    <span className="absolute right-3 top-2.5 text-slate-500">%</span>
                  </div>
                </div>
                <div>
                  <Label className="text-base font-bold mb-2 block">Repayment Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {QUESTIONNAIRE.repaymentStructures.map((type) => (
                      <button type="button" key={type.id} onClick={() => setValue('currentRepaymentType', type.id, { shouldValidate: true })} className={`p-2 rounded-lg border text-sm font-semibold transition-all ${formValues.currentRepaymentType === type.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-slate-600'}`}>{type.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-base font-bold mb-3 block">Are you currently on a fixed rate?</Label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {QUESTIONNAIRE.booleanOptions.map((opt) => (
                    <button type="button" key={opt.label} onClick={() => {
                      setValue('isFixedRate', opt.value, { shouldValidate: true });
                      if (!opt.value) setValue('fixedRateExpiry', '');
                    }} className={`p-3 rounded-xl border font-medium transition-all ${formValues.isFixedRate === opt.value ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{opt.label}</button>
                  ))}
                </div>
                
                {formValues.isFixedRate === true && (
                  <div className="animate-in fade-in max-w-[200px]">
                    <Label className="text-sm font-semibold mb-2 block text-slate-600">Fixed term expiry date</Label>
                    <Input type="text" placeholder="MM/YYYY" maxLength={7} {...register('fixedRateExpiry', { onChange: handleDateInput })} />
                    {errors.fixedRateExpiry && <p className="text-red-500 text-sm mt-1">{errors.fixedRateExpiry.message}</p>}
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
                     <button type="button" key={item.id} onClick={() => {
                       setValue('repaymentStructure', item.id, { shouldValidate: true });
                       if (item.id === 'P_AND_I') setValue('interestOnlyYears', '');
                     }} className={`p-3 rounded-xl border font-medium transition-all ${formValues.repaymentStructure === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                   ))}
                 </div>
                 {errors.repaymentStructure && <p className="text-red-500 text-sm mt-1">{errors.repaymentStructure.message}</p>}
                 
                 {formValues.repaymentStructure === 'INTEREST_ONLY' && (
                   <div className="mt-4 p-4 bg-slate-50 rounded-xl border animate-in fade-in">
                     <p className="text-sm text-slate-500 mb-3 font-medium">How many years?</p>
                     <div className="flex gap-2">
                       {QUESTIONNAIRE.interestOnlyYears.map(year => (
                         <button type="button" key={year} onClick={() => setValue('interestOnlyYears', year, { shouldValidate: true })} className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${formValues.interestOnlyYears === year ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-600'}`}>{year}</button>
                       ))}
                     </div>
                   </div>
                 )}
               </div>

               <div>
                 <Label className="text-base font-bold mb-3 block">Rate Type Preference</Label>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {QUESTIONNAIRE.ratePreferences.map((item) => (
                     <button type="button" key={item.id} onClick={() => {
                       setValue('ratePreference', item.id, { shouldValidate: true });
                       if (item.id === 'VARIABLE') setValue('fixedYears', '');
                     }} className={`p-3 rounded-xl border font-medium transition-all ${formValues.ratePreference === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                   ))}
                 </div>
                 {errors.ratePreference && <p className="text-red-500 text-sm mt-1">{errors.ratePreference.message}</p>}

                 {formValues.ratePreference === 'FIXED' && (
                   <div className="mt-4 p-4 bg-slate-50 rounded-xl border animate-in fade-in">
                     <p className="text-sm text-slate-500 mb-3 font-medium">Fixed for how many years?</p>
                     <div className="flex gap-2">
                       {QUESTIONNAIRE.fixedYears.map(year => (
                         <button type="button" key={year} onClick={() => setValue('fixedYears', year, { shouldValidate: true })} className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${formValues.fixedYears === year ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-600'}`}>{year}</button>
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
                     <button type="button" key={item.id} onClick={() => setValue('employmentStatus', item.id, { shouldValidate: true })} className={`p-3 rounded-xl border text-sm font-medium transition-all ${formValues.employmentStatus === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                   ))}
                 </div>
                 {errors.employmentStatus && <p className="text-red-500 text-sm mt-1">{errors.employmentStatus.message}</p>}
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div>
                   <Label className="text-base font-bold mb-2 block">Employment Start Date</Label>
                   <Input type="text" placeholder="MM/YYYY" maxLength={7} {...register('employmentStartDate', { onChange: handleDateInput })} />
                   {errors.employmentStartDate && <p className="text-red-500 text-sm mt-1">{errors.employmentStartDate.message}</p>}
                 </div>
                 <div>
                   <Label className="text-base font-bold mb-2 block">Gross Annual Salary</Label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                     <Input type="number" className="pl-7" placeholder="Before tax" {...register('grossAnnualSalary', { onChange: handleNumberInput })} />
                   </div>
                   {errors.grossAnnualSalary && <p className="text-red-500 text-sm mt-1">{errors.grossAnnualSalary.message}</p>}
                 </div>
               </div>

               <div>
                 <Label className="text-base font-bold mb-3 block">Relationship Status</Label>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {QUESTIONNAIRE.relationshipStatuses.map((item) => (
                     <button type="button" key={item.id} onClick={() => setValue('relationshipStatus', item.id, { shouldValidate: true })} className={`p-3 rounded-xl border text-sm font-medium transition-all ${formValues.relationshipStatus === item.id ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{item.label}</button>
                   ))}
                 </div>
                 {errors.relationshipStatus && <p className="text-red-500 text-sm mt-1">{errors.relationshipStatus.message}</p>}
               </div>

               {formValues.relationshipStatus === 'MARRIED_DE_FACTO' && (
                 <div className="p-6 bg-slate-50 rounded-xl border animate-in fade-in space-y-6">
                   <h4 className="font-bold text-slate-800">Partner's Employment Details</h4>
                   <div>
                     <Label className="text-sm font-semibold mb-3 block text-slate-600">Partner's Employment Status</Label>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                       {QUESTIONNAIRE.employmentStatuses.map((item) => (
                         <button type="button" key={item.id} onClick={() => setValue('partnerEmploymentStatus', item.id, { shouldValidate: true })} className={`p-2 rounded-lg border text-xs font-semibold transition-all ${formValues.partnerEmploymentStatus === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-600'}`}>{item.label}</button>
                       ))}
                     </div>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                       <Label className="text-sm font-semibold mb-2 block text-slate-600">Start Date</Label>
                       <Input type="text" placeholder="MM/YYYY" maxLength={7} {...register('partnerEmploymentStartDate', { onChange: handleDateInput })} />
                       {errors.partnerEmploymentStartDate && <p className="text-red-500 text-sm mt-1">{errors.partnerEmploymentStartDate.message}</p>}
                     </div>
                     <div>
                       <Label className="text-sm font-semibold mb-2 block text-slate-600">Gross Salary</Label>
                       <div className="relative">
                         <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                         <Input type="number" className="pl-7" placeholder="Before tax" {...register('partnerGrossSalary', { onChange: handleNumberInput })} />
                       </div>
                     </div>
                   </div>
                 </div>
               )}

               <div>
                 <Label className="text-base font-bold mb-3 block">Do you have any financial dependents?</Label>
                 <div className="flex items-center gap-4">
                   <button type="button" onClick={() => setValue('dependents', Math.max(0, (formValues.dependents || 0) - 1), { shouldValidate: true })} className="h-10 w-10 flex items-center justify-center rounded-full border border-border hover:bg-slate-50 active:bg-slate-100 transition-colors">
                     <Minus className="h-4 w-4 text-slate-600" />
                   </button>
                   <span className="text-xl font-bold w-4 text-center">{formValues.dependents || 0}</span>
                   <button type="button" onClick={() => setValue('dependents', (formValues.dependents || 0) + 1, { shouldValidate: true })} className="h-10 w-10 flex items-center justify-center rounded-full border border-border hover:bg-slate-50 active:bg-slate-100 transition-colors">
                     <Plus className="h-4 w-4 text-slate-600" />
                   </button>
                   <span className="text-sm text-slate-500 ml-2">{(formValues.dependents || 0) >= 4 ? 'or more' : ''}</span>
                 </div>
               </div>

               <div>
                 <Label className="text-base font-bold mb-3 block">Do you have any existing home loan, car loan, or personal loan?</Label>
                 <div className="grid grid-cols-2 gap-3 mb-4">
                   {QUESTIONNAIRE.booleanOptions.map((opt) => (
                     <button type="button" key={opt.label} onClick={() => {
                       setValue('hasExistingLoans', opt.value, { shouldValidate: true });
                       if (!opt.value) setValue('existingMonthlyRepayment', undefined);
                     }} className={`p-3 rounded-xl border font-medium transition-all ${formValues.hasExistingLoans === opt.value ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{opt.label}</button>
                   ))}
                 </div>
                 
                 {formValues.hasExistingLoans === true && (
                   <div className="animate-in fade-in max-w-sm">
                     <Label className="text-sm font-semibold mb-2 block text-slate-600">Total monthly repayment</Label>
                     <div className="relative">
                       <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                       <Input type="number" className="pl-7" placeholder="0" {...register('existingMonthlyRepayment', { onChange: handleNumberInput })} />
                     </div>
                   </div>
                 )}
               </div>

               <div>
                 <Label className="text-base font-bold mb-3 block">Do you have any credit card?</Label>
                 <div className="grid grid-cols-2 gap-3 mb-4">
                   {QUESTIONNAIRE.booleanOptions.map((opt) => (
                     <button type="button" key={opt.label} onClick={() => {
                       setValue('hasCreditCard', opt.value, { shouldValidate: true });
                       if (!opt.value) setValue('creditCardLimit', undefined);
                     }} className={`p-3 rounded-xl border font-medium transition-all ${formValues.hasCreditCard === opt.value ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border hover:bg-slate-50 text-slate-600'}`}>{opt.label}</button>
                   ))}
                 </div>
                 
                 {formValues.hasCreditCard === true && (
                   <div className="animate-in fade-in max-w-sm">
                     <Label className="text-sm font-semibold mb-2 block text-slate-600">Credit card limit</Label>
                     <div className="relative">
                       <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                       <Input type="number" className="pl-7" placeholder="0" {...register('creditCardLimit', { onChange: handleNumberInput })} />
                     </div>
                   </div>
                 )}
               </div>

             </div>
          )}
          
          {/* ================= STEP 5: CONTACT ================= */}
          {step === 5 && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="text-center mb-8">
                 <h2 className="text-2xl font-bold text-foreground">Your home loan options await!</h2>
                 <p className="text-slate-500 mt-2 text-sm">Where should we send your preliminary rate match?</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <Label className="mb-2 block font-semibold">First Name</Label>
                   <Input type="text" placeholder="John" {...register('firstName')} disabled={isSubmitting} className={errors.firstName ? 'border-red-500' : ''} />
                   {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName.message}</p>}
                 </div>
                 <div>
                   <Label className="mb-2 block font-semibold">Last Name</Label>
                   <Input type="text" placeholder="Doe" {...register('lastName')} disabled={isSubmitting} className={errors.lastName ? 'border-red-500' : ''} />
                   {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName.message}</p>}
                 </div>
               </div>

               <div>
                 <Label className="mb-2 block font-semibold">Email Address</Label>
                 <Input type="email" placeholder="hello@example.com.au" {...register('email')} disabled={isSubmitting} className={errors.email ? 'border-red-500' : ''} />
                 {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
               </div>
             </div>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between border-t pt-6">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>Back</Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => router.push('/')} disabled={isSubmitting}>Cancel</Button>
          )}
          
          {step < 5 && (
            <Button type="button" onClick={handleNext} className="px-8">Continue</Button>
          )}

          {step === 5 && (
            <Button type="submit" disabled={isSubmitting} className="px-8 bg-primary hover:bg-primary/90 text-white font-bold">
              Get My Rates
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
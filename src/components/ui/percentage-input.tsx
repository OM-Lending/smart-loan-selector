'use client';

import { Input } from '@/components/ui/input';

type Props = Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange' | 'inputMode'> & {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
};

export function PercentageInput({ value, onValueChange, onBlur, className, ...props }: Props) {
  return <div className="relative">
    <Input {...props} type="text" inputMode="decimal" className={`pr-9 ${className ?? ''}`} value={value ?? ''} onChange={event => {
      const next = event.target.value;
      if (/^(?:0|[1-9]\d?)?(?:\.\d{0,2})?$/.test(next)) onValueChange(next);
    }} onBlur={event => {
      const raw = event.target.value;
      if (raw !== '' && Number.isFinite(Number(raw))) onValueChange(Number(raw).toFixed(2));
      onBlur?.(event);
    }} />
    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
  </div>;
}

'use client';

import { Input } from '@/components/ui/input';
import { formatCurrencyInput, normalizeCurrencyInput } from '@/lib/currency-input';

type Props = Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange' | 'inputMode'> & {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  fractionDigits?: 0 | 2;
};

export function CurrencyInput({ value, onValueChange, fractionDigits = 2, ...props }: Props) {
  return <Input {...props} type="text" inputMode={fractionDigits === 0 ? 'numeric' : 'decimal'} value={formatCurrencyInput(value)} onChange={event => {
    const next = normalizeCurrencyInput(event.target.value, fractionDigits);
    if (next === null) return;
    const input = event.currentTarget;
    const significantBeforeCaret = input.value.slice(0, input.selectionStart ?? 0).replace(/[$,\s]/g, '').length;
    onValueChange(next);
    requestAnimationFrame(() => {
      let significant = 0;
      let caret = 0;
      while (caret < input.value.length && significant < significantBeforeCaret) {
        if (input.value[caret] !== ',') significant++;
        caret++;
      }
      input.setSelectionRange(caret, caret);
    });
  }} />;
}

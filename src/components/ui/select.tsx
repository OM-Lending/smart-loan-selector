'use client';

import * as React from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from 'cn';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" className={cn('flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-left text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-slate-400', className)} {...props}>
    {children}<SelectPrimitive.Icon asChild><ChevronDown className="h-4 w-4 text-slate-500" /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>;
}

function SelectContent({ className, children, position = 'popper', ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content data-slot="select-content" position={position} className={cn('z-[200] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out', className)} {...props}>
    <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
  </SelectPrimitive.Content></SelectPrimitive.Portal>;
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn('relative flex w-full cursor-default select-none items-center rounded-lg py-2.5 pl-3 pr-9 text-sm outline-none focus:bg-primary/5 focus:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText><span className="absolute right-3 flex h-4 w-4 items-center justify-center"><SelectPrimitive.ItemIndicator><Check className="h-4 w-4" /></SelectPrimitive.ItemIndicator></span>
  </SelectPrimitive.Item>;
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };

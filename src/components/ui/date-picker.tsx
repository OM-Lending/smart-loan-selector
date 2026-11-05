'use client';

import * as React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover } from 'radix-ui';
import { cn } from 'cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  maxDate?: string;
  allowClear?: boolean;
  disabled?: boolean;
};

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const toDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
};
const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en-AU', { month: 'long' }).format(new Date(2020, index, 1)));
const toKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function DatePicker({ value, onChange, placeholder = 'Select a date', ariaLabel, maxDate, disabled, allowClear = false }: DatePickerProps) {
  const selected = toDate(value);
  const maximum = maxDate ? toDate(maxDate) : null;
  const lastYear = maximum?.getFullYear() ?? Math.max(new Date().getFullYear() + 20, selected?.getFullYear() ?? 0);
  const firstYear = Math.min(1900, selected?.getFullYear() ?? 1900, lastYear);
  const lastMonth = maximum?.getMonth() ?? 11;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index);
  function visibleMonth(date: Date) {
    const nextYear = Math.max(firstYear, Math.min(lastYear, date.getFullYear()));
    return new Date(nextYear, nextYear === lastYear ? Math.min(date.getMonth(), lastMonth) : date.getMonth(), 1);
  }
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(() => {
    const initial = selected ?? new Date();
    return visibleMonth(initial);
  });

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leadingDays = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const canGoBack = year > firstYear || monthIndex > 0;
  const canGoForward = year < lastYear || monthIndex < lastMonth;
  const displayValue = selected ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(selected) : placeholder;

  return <Popover.Root open={open} onOpenChange={nextOpen => { if (nextOpen) setMonth(visibleMonth(selected ?? new Date())); setOpen(nextOpen); }}>
    <Popover.Trigger asChild><button type="button" aria-label={ariaLabel} aria-haspopup="dialog" disabled={disabled} className="mt-1.5 flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-left text-sm outline-none transition hover:border-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-100"><span className={cn(!selected && 'text-slate-400')}>{displayValue}</span><CalendarDays className="h-4 w-4 text-slate-500" /></button></Popover.Trigger>
    <Popover.Portal><Popover.Content sideOffset={6} align="start" className="z-[200] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" aria-label={`${ariaLabel} calendar`}>
      <div className="mb-3 grid grid-cols-[2rem_minmax(0,1fr)_5rem_2rem] items-center gap-1">
        <button type="button" aria-label="Previous month" disabled={!canGoBack} onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
        <Select value={String(monthIndex)} onValueChange={value => setMonth(new Date(year, Number(value), 1))}>
          <SelectTrigger aria-label={`${ariaLabel} month`} className="h-9 min-w-0 gap-1 px-2 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{monthNames.map((name, index) => <SelectItem key={name} value={String(index)} disabled={year === lastYear && index > lastMonth}>{name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={value => setMonth(visibleMonth(new Date(Number(value), monthIndex, 1)))}>
          <SelectTrigger aria-label={`${ariaLabel} year`} className="h-9 min-w-0 gap-1 px-2 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
        </Select>
        <button type="button" aria-label="Next month" disabled={!canGoForward} onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">{weekdays.map(day => <span key={day} className="py-1 text-xs font-medium text-slate-500">{day}</span>)}{calendarCells.map((day, index) => {
        if (!day) return <span key={`empty-${index}`} />;
        const date = new Date(year, monthIndex, day);
        const key = toKey(date);
        const isDisabled = Boolean(maxDate && key > maxDate);
        const isSelected = key === value;
        const isToday = key === toKey(new Date());
        return <button key={key} type="button" disabled={isDisabled} aria-pressed={isSelected} onClick={() => { onChange(key); setOpen(false); }} className={cn('mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:text-slate-300', isSelected && 'bg-primary font-semibold text-white hover:bg-primary hover:text-white', !isSelected && isToday && 'font-semibold text-primary')}>
          {day}
        </button>;
      })}</div>
      {allowClear && value && <button type="button" disabled={disabled} onClick={() => { onChange(''); setOpen(false); }} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Clear date</button>}
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}

export { DatePicker };

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays } from 'date-fns';
import { Calendar as CalendarIcon, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilterState } from '@/lib/analytics-helpers';

interface AnalyticsFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  instruments: string[];
  accounts: { id: string; name: string }[];
  playbooks: { id: string; name: string }[];
}

export function AnalyticsFilters({ filters, onFiltersChange, instruments, accounts, playbooks }: AnalyticsFiltersProps) {
  const datePresets = [
    { label: '7D', days: 7 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
    { label: 'YTD', days: 365 },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-card/50 rounded-lg border border-border/50">
      <div className="hidden sm:flex items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('justify-start text-left font-normal h-9 w-full sm:w-auto text-sm', !filters.dateRange && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {filters.dateRange.from && filters.dateRange.to
              ? `${format(filters.dateRange.from, 'MMM d')} - ${format(filters.dateRange.to, 'MMM d')}`
              : 'Select dates'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2 border-b border-border flex flex-wrap gap-1">
            {datePresets.map((preset) => (
              <Button key={preset.label} variant="ghost" size="sm" className="text-xs" onClick={() => onFiltersChange({ ...filters, dateRange: { from: subDays(new Date(), preset.days), to: new Date() } })}>
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            selected={{ from: filters.dateRange.from, to: filters.dateRange.to }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onFiltersChange({ ...filters, dateRange: { from: range.from, to: range.to } });
              }
            }}
            numberOfMonths={1}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
        <Select value={filters.instrument} onValueChange={(v) => onFiltersChange({ ...filters, instrument: v })}>
          <SelectTrigger className="w-full sm:w-[120px] h-9 text-sm"><SelectValue placeholder="Instrument" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Instruments</SelectItem>
            {instruments.map((inst) => <SelectItem key={inst} value={inst}>{inst}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.account} onValueChange={(v) => onFiltersChange({ ...filters, account: v })}>
          <SelectTrigger className="w-full sm:w-[120px] h-9 text-sm"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.direction} onValueChange={(v) => onFiltersChange({ ...filters, direction: v })}>
          <SelectTrigger className="w-full sm:w-[100px] h-9 text-sm"><SelectValue placeholder="Direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="LONG">Long</SelectItem>
            <SelectItem value="SHORT">Short</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.playbook} onValueChange={(v) => onFiltersChange({ ...filters, playbook: v })}>
          <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm"><SelectValue placeholder="Playbook" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Playbooks</SelectItem>
            {playbooks.map((pb) => <SelectItem key={pb.id} value={pb.id}>{pb.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

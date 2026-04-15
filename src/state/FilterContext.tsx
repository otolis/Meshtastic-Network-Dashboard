import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TimeRange } from '../types';
import { TIME_RANGE_PRESETS, rangeEndingNow } from '../lib/time';

interface FilterValue {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  setTimeRangePreset: (label: string) => void;
  query: string;
  setQuery: (q: string) => void;
}

const FilterContext = createContext<FilterValue | null>(null);

const DEFAULT_RANGE_LABEL = '1h';

function defaultRange(): TimeRange {
  const preset = TIME_RANGE_PRESETS.find((p) => p.label === DEFAULT_RANGE_LABEL) ?? TIME_RANGE_PRESETS[2];
  if (!preset) throw new Error('No default time range preset available');
  return rangeEndingNow(preset.label, preset.durationMs);
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>(() => defaultRange());
  const [query, setQuery] = useState<string>('');

  const setTimeRangePreset = useCallback((label: string) => {
    const preset = TIME_RANGE_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setTimeRange(rangeEndingNow(preset.label, preset.durationMs));
  }, []);

  const value = useMemo<FilterValue>(
    () => ({ timeRange, setTimeRange, setTimeRangePreset, query, setQuery }),
    [timeRange, setTimeRangePreset, query],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useTimeRange() {
  return useFilter().timeRange;
}

export function useSetTimeRange() {
  const { setTimeRange, setTimeRangePreset } = useFilter();
  return { setTimeRange, setTimeRangePreset };
}

export function useQuery() {
  const { query, setQuery } = useFilter();
  return [query, setQuery] as const;
}

function useFilter(): FilterValue {
  const v = useContext(FilterContext);
  if (!v) throw new Error('Filter hooks must be used inside <FilterProvider>');
  return v;
}

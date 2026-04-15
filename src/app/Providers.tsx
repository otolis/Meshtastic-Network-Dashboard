import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { MeshDataSource } from '../data/source';
import { MockDataSource } from '../data/mock/MockDataSource';
import {
  DataProvider,
  DataSourceProvider,
  FilterProvider,
  SelectionProvider,
} from '../state/hooks';

/**
 * Composition root for every context the app depends on.
 *
 * ▶ v2 swap point ◀
 * Change the next line to `new LiveDataSource(...)` when real-device
 * adapters are ready. No other code has to change.
 */
function createDefaultSource(): MeshDataSource {
  return new MockDataSource();
}

export function Providers({ children }: { children: ReactNode }) {
  const source = useMemo(() => createDefaultSource(), []);
  return (
    <DataSourceProvider source={source}>
      <FilterProvider>
        <SelectionProvider>
          <DataProvider>{children}</DataProvider>
        </SelectionProvider>
      </FilterProvider>
    </DataSourceProvider>
  );
}

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { MeshDataSource } from '../data/source';

const DataSourceContext = createContext<MeshDataSource | null>(null);

export function DataSourceProvider({
  source,
  children,
}: {
  source: MeshDataSource;
  children: ReactNode;
}) {
  return <DataSourceContext.Provider value={source}>{children}</DataSourceContext.Provider>;
}

export function useDataSource(): MeshDataSource {
  const source = useContext(DataSourceContext);
  if (!source) {
    throw new Error('useDataSource must be called inside <DataSourceProvider>');
  }
  return source;
}

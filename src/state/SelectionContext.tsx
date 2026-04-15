import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { NodeId } from '../types';

export type SelectedKind = 'node' | 'message' | 'device' | null;

export interface SelectionState {
  kind: SelectedKind;
  id: string | NodeId | null;
}

interface SelectionValue extends SelectionState {
  selectNode: (id: NodeId | null) => void;
  selectMessage: (id: string | null) => void;
  selectDevice: (id: NodeId | null) => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SelectionState>({ kind: null, id: null });

  const selectNode = useCallback((id: NodeId | null) => {
    setState(id ? { kind: 'node', id } : { kind: null, id: null });
  }, []);
  const selectMessage = useCallback((id: string | null) => {
    setState(id ? { kind: 'message', id } : { kind: null, id: null });
  }, []);
  const selectDevice = useCallback((id: NodeId | null) => {
    setState(id ? { kind: 'device', id } : { kind: null, id: null });
  }, []);
  const clear = useCallback(() => setState({ kind: null, id: null }), []);

  const value = useMemo<SelectionValue>(
    () => ({ ...state, selectNode, selectMessage, selectDevice, clear }),
    [state, selectNode, selectMessage, selectDevice, clear],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionValue {
  const v = useContext(SelectionContext);
  if (!v) throw new Error('useSelection must be used inside <SelectionProvider>');
  return v;
}

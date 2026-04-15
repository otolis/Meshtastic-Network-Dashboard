import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import styles from './Shell.module.css';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import { Inspector } from './Inspector';
import { KeyboardShortcuts } from './KeyboardShortcuts';

const NAV_COLLAPSED_KEY = 'mdash:nav-collapsed';

export function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(NAV_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // Access denied / private mode — ignore
    }
  }, [collapsed]);

  return (
    <div className={clsx(styles.shell, collapsed && styles.collapsed)}>
      <TopBar className={styles.topbar} />
      <SideNav className={styles.nav} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main className={styles.main}>{children}</main>
      <Inspector className={styles.inspector} />
      <KeyboardShortcuts />
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import styles from './SideNav.module.css';

interface NavItem {
  to: string;
  label: string;
  hotkey: string;
  icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/network', label: 'Network', hotkey: '1', icon: 'network' },
  { to: '/messages', label: 'Messages', hotkey: '2', icon: 'messages' },
  { to: '/health', label: 'Health', hotkey: '3', icon: 'health' },
  { to: '/devices', label: 'Devices', hotkey: '4', icon: 'devices' },
];

export function SideNav({
  className,
  collapsed,
  onToggle,
}: {
  className?: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <nav className={clsx(styles.nav, collapsed && styles.collapsed, className)} aria-label="Primary">
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <span className={styles.brandMarkDot} />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandLine1}>Meshtastic</span>
          <span className={styles.brandLine2}>Dashboard</span>
        </span>
      </div>
      <ul className={styles.menu}>
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className={styles.menuItem}>
            <NavLink
              to={item.to}
              className={({ isActive }) => clsx(styles.menuLink, isActive && styles.active)}
              aria-label={`${item.label} (press ${item.hotkey})`}
              title={collapsed ? `${item.label} (${item.hotkey})` : undefined}
            >
              <span className={styles.menuIcon} aria-hidden="true">
                <NavIcon name={item.icon} />
              </span>
              <span className={styles.menuLabel}>{item.label}</span>
              <kbd className={styles.menuKey}>{item.hotkey}</kbd>
            </NavLink>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.toggle}
        onClick={onToggle}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        <span className={styles.toggleIcon} aria-hidden="true">
          ◀
        </span>
        <span className={styles.toggleLabel}>Collapse</span>
      </button>
    </nav>
  );
}

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case 'network':
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="4" r="2" />
          <circle cx="4" cy="12" r="2" />
          <circle cx="20" cy="12" r="2" />
          <circle cx="8" cy="20" r="2" />
          <circle cx="16" cy="20" r="2" />
          <path d="M12 6v3l-5 2m5-5l5 2m-5 1v3l-3 5m3-5l3 5" />
        </svg>
      );
    case 'messages':
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 5h16v10H7l-3 3z" />
          <path d="M8 9h8M8 12h5" strokeLinecap="round" />
        </svg>
      );
    case 'health':
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 13h4l2-5 3 9 2-4h7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'devices':
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M8 15h2m3 0h3" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

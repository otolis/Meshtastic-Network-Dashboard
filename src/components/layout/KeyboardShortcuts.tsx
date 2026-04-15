import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelection } from '../../state/hooks';

const NAV_MAP: Record<string, string> = {
  '1': '/network',
  '2': '/messages',
  '3': '/health',
  '4': '/devices',
};

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const { clear } = useSelection();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target && target.isContentEditable) return;

      const dest = NAV_MAP[e.key];
      if (dest) {
        navigate(dest);
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        clear();
        return;
      }
      if (e.key === '/') {
        const search = document.querySelector<HTMLInputElement>('[data-shortcut-search]');
        if (search) {
          search.focus();
          e.preventDefault();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, clear]);

  return null;
}

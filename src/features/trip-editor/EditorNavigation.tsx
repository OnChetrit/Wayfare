import { CalendarDays, Compass, MapPinned, Settings2, WalletCards } from 'lucide-react';
import styles from './EditorNavigation.module.scss';
import type { EditorMode } from './types';

type EditorNavigationProps = {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onOpenSettings: () => void;
};

const items = ['map', 'day', 'places', 'expenses', 'settings'] as const;

export function EditorNavigation({ mode, onModeChange, onOpenSettings }: EditorNavigationProps) {
  return (
    <nav className={styles.mobileNav} aria-label="Mobile navigation">
      {items.map(item => (
        <button
          key={item}
          className={item !== 'settings' && mode === item ? styles.mobileNavActive : ''}
          onClick={() => (item === 'settings' ? onOpenSettings() : onModeChange(item))}
        >
          <span>
            {item === 'map' ? (
              <MapPinned size={18} />
            ) : item === 'day' ? (
              <CalendarDays size={18} />
            ) : item === 'places' ? (
              <Compass size={18} />
            ) : item === 'expenses' ? (
              <WalletCards size={18} />
            ) : (
              <Settings2 size={18} />
            )}
          </span>
          {item[0].toUpperCase() + item.slice(1)}
        </button>
      ))}
    </nav>
  );
}

import { useEffect, type RefObject } from 'react';

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    function handlePointerDown(event: PointerEvent) {
      const element = ref.current;
      if (element && !element.contains(event.target as Node)) onOutside();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [enabled, onOutside, ref]);
}

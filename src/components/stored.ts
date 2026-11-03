"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "chorus-storage";

function subscribe(callback: () => void) {
  const onChange = () => callback();
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useStoredValue(key: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key),
    () => null,
  );
  const setValue = useCallback(
    (next: string | null) => {
      if (next == null) localStorage.removeItem(key);
      else localStorage.setItem(key, next);
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, setValue] as const;
}

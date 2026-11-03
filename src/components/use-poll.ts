"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function usePoll<T>(
  url: string | null,
  headers: Record<string, string>,
  onError?: (message: string) => void,
  interval = 1000,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headerKey = JSON.stringify(headers);
  const headersRef = useRef(headers);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    headersRef.current = headers;
    onErrorRef.current = onError;
  }, [headerKey, headers, onError]);

  const refresh = useCallback(async () => {
    if (!url) return null;
    const response = await fetch(url, { headers: headersRef.current, cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
    if (!response.ok) throw new Error(body.error || "The room could not be loaded.");
    return body;
  }, [url]);

  useEffect(() => {
    if (!url) return;
    let stop = false;
    let timer = 0;
    const tick = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try {
          const next = await refresh();
          if (!stop && next) {
            setData(next);
            setError(null);
          }
        } catch (caught) {
          if (!stop) {
            const message = caught instanceof Error ? caught.message : "The room could not be loaded.";
            setError(message);
            onErrorRef.current?.(message);
          }
        }
      }
      if (!stop) timer = window.setTimeout(tick, interval);
    };
    void tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [headerKey, interval, refresh, url]);

  const reload = useCallback(async () => {
    try {
      const next = await refresh();
      if (next) {
        setData(next);
        setError(null);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The room could not be loaded.";
      setError(message);
      onErrorRef.current?.(message);
    }
  }, [refresh]);

  return { data, error, refresh: reload };
}

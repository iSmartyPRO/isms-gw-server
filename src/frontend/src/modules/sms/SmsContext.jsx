import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { smsApi } from './api';

const SmsContext = createContext(null);

const POLL_MS = 5000;

/**
 * Module-wide state: settings for this person, their phones (refreshed every
 * few seconds while the tab is visible, so online dots and counters stay live)
 * and today's figures for the sidebar badges.
 */
export function SmsProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [devices, setDevices] = useState([]);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const busy = useRef(false);
  const everLoaded = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const [list, stats] = await Promise.all([smsApi.devices(), smsApi.overview({ days: 14 })]);
      setDevices(list.data.devices);
      setOverview(stats.data);
      setLoaded(true);
      everLoaded.current = true;
    } catch (err) {
      // Only the first load decides the error screen; a failed poll keeps the last data.
      if (!everLoaded.current) setError(err);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    smsApi
      .config()
      .then(({ data }) => setConfig(data.config))
      .catch(setError);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const value = useMemo(() => {
    const senders = devices.filter((device) => ['edit', 'manage'].includes(device.level));
    return {
      config,
      devices,
      senders,
      overview,
      loaded,
      error,
      refresh,
      online: devices.filter((device) => device.online).length,
      unread: overview?.today?.unread || 0,
      deviceById: (id) => devices.find((device) => device.id === Number(id)) || null,
    };
  }, [config, devices, overview, loaded, error, refresh]);

  return <SmsContext.Provider value={value}>{children}</SmsContext.Provider>;
}

export const useSms = () => useContext(SmsContext);

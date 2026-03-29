import { useState, useEffect, useMemo, useCallback } from 'react';
import type { HauptPrompt, Nachbesserung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [hauptPrompt, setHauptPrompt] = useState<HauptPrompt[]>([]);
  const [nachbesserung, setNachbesserung] = useState<Nachbesserung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [hauptPromptData, nachbesserungData] = await Promise.all([
        LivingAppsService.getHauptPrompt(),
        LivingAppsService.getNachbesserung(),
      ]);
      setHauptPrompt(hauptPromptData);
      setNachbesserung(nachbesserungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [hauptPromptData, nachbesserungData] = await Promise.all([
          LivingAppsService.getHauptPrompt(),
          LivingAppsService.getNachbesserung(),
        ]);
        setHauptPrompt(hauptPromptData);
        setNachbesserung(nachbesserungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const hauptPromptMap = useMemo(() => {
    const m = new Map<string, HauptPrompt>();
    hauptPrompt.forEach(r => m.set(r.record_id, r));
    return m;
  }, [hauptPrompt]);

  return { hauptPrompt, setHauptPrompt, nachbesserung, setNachbesserung, loading, error, fetchAll, hauptPromptMap };
}
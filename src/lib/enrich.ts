import type { EnrichedNachbesserung } from '@/types/enriched';
import type { HauptPrompt, Nachbesserung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface NachbesserungMaps {
  hauptPromptMap: Map<string, HauptPrompt>;
}

export function enrichNachbesserung(
  nachbesserung: Nachbesserung[],
  maps: NachbesserungMaps
): EnrichedNachbesserung[] {
  return nachbesserung.map(r => ({
    ...r,
    haupt_prompt_linkName: resolveDisplay(r.fields.haupt_prompt_link, maps.hauptPromptMap, 'prompt_id'),
  }));
}

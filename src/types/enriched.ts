import type { Nachbesserung } from './app';

export type EnrichedNachbesserung = Nachbesserung & {
  haupt_prompt_linkName: string;
};

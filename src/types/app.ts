// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface HauptPrompt {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    prompt_id?: string;
    name?: string;
    zweck_kontext?: string;
    prompt_text?: string;
    status?: LookupValue;
    erstellt_am?: string; // Format: YYYY-MM-DD oder ISO String
    zuletzt_geaendert?: string; // Format: YYYY-MM-DD oder ISO String
    vollstaendiger_prompt?: string;
    prompt_email_action?: LookupValue;
  };
}

export interface Nachbesserung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    haupt_prompt_link?: string; // applookup -> URL zu 'HauptPrompt' Record
    versionsnummer?: string;
    nachbesserungs_text?: string;
    aenderungsnotiz?: string;
    erstellt_am_nb?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export const APP_IDS = {
  HAUPT_PROMPT: '69c6386b31076725d66a18c5',
  NACHBESSERUNG: '69c6386f252dfa516befa887',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'haupt_prompt': {
    status: [{ key: "aktiv", label: "Aktiv" }, { key: "archiviert", label: "Archiviert" }, { key: "entwurf", label: "Entwurf" }],
    prompt_email_action: [{ key: "send_email", label: "E-Mail mit vollständigem Prompt versenden" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'haupt_prompt': {
    'prompt_id': 'string/text',
    'name': 'string/text',
    'zweck_kontext': 'string/textarea',
    'prompt_text': 'string/textarea',
    'status': 'lookup/radio',
    'erstellt_am': 'date/date',
    'zuletzt_geaendert': 'date/date',
    'vollstaendiger_prompt': 'string/textarea',
    'prompt_email_action': 'lookup/radio',
  },
  'nachbesserung': {
    'haupt_prompt_link': 'applookup/select',
    'versionsnummer': 'string/text',
    'nachbesserungs_text': 'string/textarea',
    'aenderungsnotiz': 'string/textarea',
    'erstellt_am_nb': 'date/date',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateHauptPrompt = StripLookup<HauptPrompt['fields']>;
export type CreateNachbesserung = StripLookup<Nachbesserung['fields']>;
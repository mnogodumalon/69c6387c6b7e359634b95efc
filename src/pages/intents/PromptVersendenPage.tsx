import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { HauptPromptDialog } from '@/components/dialogs/HauptPromptDialog';
import type { HauptPrompt, Nachbesserung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import {
  IconSend,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconAlertTriangle,
  IconCopy,
} from '@tabler/icons-react';

const STEPS = [
  { label: 'Prompt auswählen' },
  { label: 'Prompt prüfen' },
  { label: 'Per E-Mail versenden' },
];

export default function PromptVersendenPage() {
  const [searchParams] = useSearchParams();

  // Derive initial step from URL
  const urlStep = parseInt(searchParams.get('step') ?? '', 10);
  const urlPromptId = searchParams.get('promptId') ?? '';

  const [currentStep, setCurrentStep] = useState<number>(
    urlStep >= 1 && urlStep <= 3 ? urlStep : 1
  );
  const [hauptPrompts, setHauptPrompts] = useState<HauptPrompt[]>([]);
  const [nachbesserungen, setNachbesserungen] = useState<Nachbesserung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [selectedPrompt, setSelectedPrompt] = useState<HauptPrompt | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [p, n] = await Promise.all([
        LivingAppsService.getHauptPrompt(),
        LivingAppsService.getNachbesserung(),
      ]);
      setHauptPrompts(p);
      setNachbesserungen(n);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Auto-select prompt from URL param once data is loaded
  useEffect(() => {
    if (!loading && urlPromptId && hauptPrompts.length > 0 && !selectedPrompt) {
      const found = hauptPrompts.find((p) => p.record_id === urlPromptId);
      if (found) {
        setSelectedPrompt(found);
        setCurrentStep(urlStep >= 2 && urlStep <= 3 ? urlStep : 2);
      }
    }
  }, [loading, hauptPrompts, urlPromptId, selectedPrompt, urlStep]);

  // Revision counts per prompt
  const revisionCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const nb of nachbesserungen) {
      const promptId = extractRecordId(nb.fields.haupt_prompt_link);
      if (promptId) {
        map[promptId] = (map[promptId] ?? 0) + 1;
      }
    }
    return map;
  }, [nachbesserungen]);

  // Revisionen for selected prompt, sorted descending by date
  const selectedRevisions = useMemo(() => {
    if (!selectedPrompt) return [];
    return nachbesserungen
      .filter(
        (nb) =>
          extractRecordId(nb.fields.haupt_prompt_link) === selectedPrompt.record_id
      )
      .sort((a, b) => {
        const da = a.fields.erstellt_am_nb ?? '';
        const db = b.fields.erstellt_am_nb ?? '';
        return db.localeCompare(da);
      })
      .slice(0, 3);
  }, [nachbesserungen, selectedPrompt]);

  const handleSelectPrompt = (id: string) => {
    const found = hauptPrompts.find((p) => p.record_id === id) ?? null;
    setSelectedPrompt(found);
    setSendSuccess(false);
    setSendError(null);
    setCurrentStep(2);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSend = async () => {
    if (!selectedPrompt) return;
    setSending(true);
    setSendError(null);
    try {
      await LivingAppsService.updateHauptPromptEntry(selectedPrompt.record_id, {
        prompt_email_action: 'send_email',
      });
      setSendSuccess(true);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setSelectedPrompt(null);
    setSendSuccess(false);
    setSendError(null);
    setCurrentStep(1);
  };

  const promptContent =
    selectedPrompt?.fields.vollstaendiger_prompt ||
    selectedPrompt?.fields.prompt_text ||
    '';

  const hasVollstaendiger = !!(selectedPrompt?.fields.vollstaendiger_prompt);

  return (
    <IntentWizardShell
      title="Prompt versenden"
      subtitle="Prüfe deinen Prompt und versende ihn per E-Mail."
      steps={STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Prompt auswählen ── */}
      {currentStep === 1 && (
        <EntitySelectStep
          items={hauptPrompts.map((p) => ({
            id: p.record_id,
            title: p.fields.name ?? 'Kein Name',
            subtitle: p.fields.prompt_id ?? p.fields.zweck_kontext ?? '',
            status: p.fields.status
              ? { key: p.fields.status.key, label: p.fields.status.label }
              : undefined,
            stats: [
              {
                label: 'Revisionen',
                value: revisionCountMap[p.record_id] ?? 0,
              },
              {
                label: 'Status',
                value: p.fields.status?.label ?? '—',
              },
            ],
          }))}
          onSelect={handleSelectPrompt}
          searchPlaceholder="Prompt suchen..."
          emptyText="Kein Prompt gefunden."
          createLabel="Neuen Prompt anlegen"
          onCreateNew={() => setDialogOpen(true)}
          createDialog={
            <HauptPromptDialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              onSubmit={async (fields) => {
                await LivingAppsService.createHauptPromptEntry(fields);
                await fetchAll();
                setDialogOpen(false);
              }}
              enablePhotoScan={AI_PHOTO_SCAN['HauptPrompt']}
              enablePhotoLocation={AI_PHOTO_LOCATION['HauptPrompt']}
            />
          }
        />
      )}

      {/* ── Step 2: Prompt prüfen ── */}
      {currentStep === 2 && selectedPrompt && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-card rounded-2xl border overflow-hidden p-5 space-y-2">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate min-w-0 flex-1">
                {selectedPrompt.fields.name ?? 'Kein Name'}
              </h2>
              <StatusBadge
                statusKey={selectedPrompt.fields.status?.key ?? ''}
                label={selectedPrompt.fields.status?.label ?? ''}
              />
            </div>
            {selectedPrompt.fields.prompt_id && (
              <p className="text-xs text-muted-foreground font-mono">
                ID: {selectedPrompt.fields.prompt_id}
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1">
              <span>Erstellt: {formatDate(selectedPrompt.fields.erstellt_am)}</span>
              <span>
                Geändert: {formatDate(selectedPrompt.fields.zuletzt_geaendert)}
              </span>
            </div>
          </div>

          {/* Zweck & Kontext */}
          {selectedPrompt.fields.zweck_kontext && (
            <div className="bg-card rounded-2xl border overflow-hidden p-5 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Zweck &amp; Kontext
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {selectedPrompt.fields.zweck_kontext}
              </p>
            </div>
          )}

          {/* Vollständiger Prompt */}
          <div className="bg-card rounded-2xl border overflow-hidden p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">
                Vollständiger Prompt
              </h3>
              {promptContent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(promptContent)}
                  className="shrink-0"
                >
                  {copySuccess ? (
                    <>
                      <IconCheck size={14} stroke={2} className="mr-1 text-green-600" />
                      Kopiert
                    </>
                  ) : (
                    <>
                      <IconCopy size={14} stroke={2} className="mr-1" />
                      In Zwischenablage kopieren
                    </>
                  )}
                </Button>
              )}
            </div>

            {!hasVollstaendiger && (
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                <IconAlertTriangle size={16} stroke={2} className="text-yellow-600 shrink-0" />
                <p className="text-xs text-yellow-700">
                  Kein finalisierter Prompt vorhanden. Es wird der Prompt-Text angezeigt.
                </p>
              </div>
            )}

            {promptContent ? (
              <pre className="bg-secondary rounded-lg p-4 text-xs font-mono text-foreground whitespace-pre-wrap overflow-x-auto max-h-64 leading-relaxed">
                {promptContent}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Kein Prompt-Text vorhanden.
              </p>
            )}
          </div>

          {/* Letzte Revisionen */}
          {selectedRevisions.length > 0 && (
            <div className="bg-card rounded-2xl border overflow-hidden p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Letzte Revisionen
              </h3>
              <ul className="space-y-3">
                {selectedRevisions.map((nb) => (
                  <li
                    key={nb.record_id}
                    className="border-b last:border-b-0 pb-3 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary">
                        {nb.fields.versionsnummer
                          ? `v${nb.fields.versionsnummer}`
                          : 'Revision'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(nb.fields.erstellt_am_nb)}
                      </span>
                    </div>
                    {nb.fields.nachbesserungs_text && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {nb.fields.nachbesserungs_text}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              <IconArrowLeft size={16} stroke={2} className="mr-2" />
              Zurück
            </Button>
            <Button onClick={() => setCurrentStep(3)}>
              Weiter zum Versand
              <IconArrowRight size={16} stroke={2} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Per E-Mail versenden ── */}
      {currentStep === 3 && selectedPrompt && (
        <div className="space-y-6">
          {sendSuccess ? (
            /* Success state */
            <div className="bg-card rounded-2xl border overflow-hidden p-8 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <IconCheck size={28} stroke={2} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Prompt wurde versendet!
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedPrompt.fields.name ?? 'Kein Name'} wurde am{' '}
                  {formatDate(new Date().toISOString().split('T')[0])} per E-Mail
                  versendet.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReset}
                >
                  Weiteren Prompt versenden
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    window.location.hash = '#/haupt-prompt';
                  }}
                >
                  Zur Prompt-Übersicht
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Summary card */}
              <div className="bg-card rounded-2xl border overflow-hidden p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                  <h2 className="text-base font-semibold text-foreground truncate min-w-0 flex-1">
                    {selectedPrompt.fields.name ?? 'Kein Name'}
                  </h2>
                  <StatusBadge
                    statusKey={selectedPrompt.fields.status?.key ?? ''}
                    label={selectedPrompt.fields.status?.label ?? ''}
                  />
                </div>
                {promptContent ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {promptContent}
                  </p>
                ) : null}
              </div>

              {/* No content warning */}
              {!promptContent && (
                <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                  <IconAlertTriangle
                    size={18}
                    stroke={2}
                    className="text-yellow-600 shrink-0 mt-0.5"
                  />
                  <p className="text-sm text-yellow-700">
                    Kein Prompt-Text vorhanden. Bitte zunächst den Prompt finalisieren.
                  </p>
                </div>
              )}

              {/* Explanation */}
              <div className="bg-secondary rounded-xl px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Der vollständige Prompt wird per E-Mail versendet. Bestätige den
                  Versand unten.
                </p>
              </div>

              {/* Send error */}
              {sendError && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                  <IconAlertTriangle
                    size={18}
                    stroke={2}
                    className="text-destructive shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-destructive font-medium">
                      Fehler beim Versenden
                    </p>
                    <p className="text-xs text-destructive/80 mt-0.5 break-words">
                      {sendError}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={handleSend}
                    disabled={sending || !promptContent}
                  >
                    Erneut versuchen
                  </Button>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <IconArrowLeft size={16} stroke={2} className="mr-2" />
                  Zurück
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={sending || !promptContent}
                  className="min-w-40"
                >
                  {sending ? (
                    <>
                      <span className="animate-spin mr-2 inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                      Wird versendet...
                    </>
                  ) : (
                    <>
                      <IconSend size={16} stroke={2} className="mr-2" />
                      Prompt versenden
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}

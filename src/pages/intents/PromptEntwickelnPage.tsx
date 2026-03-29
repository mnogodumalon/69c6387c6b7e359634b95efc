import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { HauptPromptDialog } from '@/components/dialogs/HauptPromptDialog';
import { NachbesserungDialog } from '@/components/dialogs/NachbesserungDialog';
import type { HauptPrompt, Nachbesserung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { IconCheck, IconPlus, IconArrowLeft, IconArrowRight, IconFileText, IconPencil } from '@tabler/icons-react';

const STEPS = [
  { label: 'Prompt wählen' },
  { label: 'Revision hinzufügen' },
  { label: 'Finalisieren' },
];

const STATUS_OPTIONS = [
  { key: 'aktiv', label: 'Aktiv' },
  { key: 'entwurf', label: 'Entwurf' },
  { key: 'archiviert', label: 'Archiviert' },
];

export default function PromptEntwickelnPage() {
  const [searchParams] = useSearchParams();

  // All state hooks before any early returns
  const [currentStep, setCurrentStep] = useState(1);
  const [hauptPrompt, setHauptPrompt] = useState<HauptPrompt[]>([]);
  const [nachbesserung, setNachbesserung] = useState<Nachbesserung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [selectedPrompt, setSelectedPrompt] = useState<HauptPrompt | null>(null);
  const [hauptPromptDialogOpen, setHauptPromptDialogOpen] = useState(false);
  const [nachbesserungDialogOpen, setNachbesserungDialogOpen] = useState(false);

  // Step 3 state
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [chosenStatus, setChosenStatus] = useState<string>('aktiv');
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);

  const fetchAll = async () => {
    try {
      const [p, n] = await Promise.all([
        LivingAppsService.getHauptPrompt(),
        LivingAppsService.getNachbesserung(),
      ]);
      setHauptPrompt(p);
      setNachbesserung(n);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Deep-link: read ?promptId=xxx from URL to pre-select a prompt
  useEffect(() => {
    const promptId = searchParams.get('promptId');
    if (promptId && hauptPrompt.length > 0 && !selectedPrompt) {
      const found = hauptPrompt.find(p => p.record_id === promptId);
      if (found) {
        setSelectedPrompt(found);
        setCurrentStep(2);
      }
    }
  }, [searchParams, hauptPrompt, selectedPrompt]);

  // Revisions for the selected prompt
  const promptRevisions = useMemo(() => {
    if (!selectedPrompt) return [];
    const promptUrl = createRecordUrl(APP_IDS.HAUPT_PROMPT, selectedPrompt.record_id);
    return nachbesserung.filter(n => n.fields.haupt_prompt_link === promptUrl);
  }, [selectedPrompt, nachbesserung]);

  // Count revisions per prompt for Step 1 stats
  const revisionCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of nachbesserung) {
      const link = n.fields.haupt_prompt_link ?? '';
      // Extract record id from URL
      const parts = link.split('/');
      const id = parts[parts.length - 1];
      if (id) map[id] = (map[id] ?? 0) + 1;
    }
    return map;
  }, [nachbesserung]);

  // Selected revision object
  const selectedRevision = useMemo(() => {
    if (!selectedRevisionId) return null;
    return promptRevisions.find(r => r.record_id === selectedRevisionId) ?? null;
  }, [selectedRevisionId, promptRevisions]);

  // Preview text: selected revision text OR original prompt text
  const previewText = selectedRevision?.fields.nachbesserungs_text
    ?? selectedPrompt?.fields.prompt_text
    ?? '';

  function handleSelectPrompt(id: string) {
    const found = hauptPrompt.find(p => p.record_id === id);
    if (found) {
      setSelectedPrompt(found);
      setSelectedRevisionId(null);
      setFinalized(false);
      setCurrentStep(2);
    }
  }

  async function handleFinalize() {
    if (!selectedPrompt) return;
    setFinalizing(true);
    try {
      await LivingAppsService.updateHauptPromptEntry(selectedPrompt.record_id, {
        vollstaendiger_prompt: previewText,
        status: chosenStatus,
      });
      await fetchAll();
      setFinalized(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setFinalizing(false);
    }
  }

  function handleReset() {
    setSelectedPrompt(null);
    setSelectedRevisionId(null);
    setFinalized(false);
    setChosenStatus('aktiv');
    setCurrentStep(1);
  }

  return (
    <IntentWizardShell
      title="Prompt entwickeln"
      subtitle="Wähle einen Prompt, füge Revisionen hinzu und finalisiere ihn."
      steps={STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Prompt wählen */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <EntitySelectStep
            items={hauptPrompt.map(p => ({
              id: p.record_id,
              title: p.fields.name ?? 'Kein Name',
              subtitle: p.fields.prompt_id ?? '',
              status: p.fields.status
                ? { key: p.fields.status.key, label: p.fields.status.label }
                : undefined,
              stats: [
                { label: 'Revisionen', value: revisionCountMap[p.record_id] ?? 0 },
              ],
              icon: <IconFileText size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectPrompt}
            searchPlaceholder="Prompt suchen..."
            emptyText="Noch keine Prompts vorhanden."
            createLabel="Neuen Prompt anlegen"
            onCreateNew={() => setHauptPromptDialogOpen(true)}
            createDialog={
              <HauptPromptDialog
                open={hauptPromptDialogOpen}
                onClose={() => setHauptPromptDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createHauptPromptEntry(fields);
                  await fetchAll();
                }}
                enablePhotoScan={AI_PHOTO_SCAN['HauptPrompt']}
                enablePhotoLocation={AI_PHOTO_LOCATION['HauptPrompt']}
              />
            }
          />
        </div>
      )}

      {/* Step 2: Revision hinzufügen */}
      {currentStep === 2 && selectedPrompt && (
        <div className="space-y-5">
          {/* Selected prompt info card */}
          <div className="rounded-2xl border bg-card p-4 space-y-2 overflow-hidden">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base truncate">{selectedPrompt.fields.name ?? 'Kein Name'}</h2>
                {selectedPrompt.fields.prompt_id && (
                  <p className="text-xs text-muted-foreground truncate">{selectedPrompt.fields.prompt_id}</p>
                )}
              </div>
              {selectedPrompt.fields.status && (
                <StatusBadge
                  statusKey={selectedPrompt.fields.status.key}
                  label={selectedPrompt.fields.status.label}
                />
              )}
            </div>
            {selectedPrompt.fields.zweck_kontext && (
              <p className="text-sm text-muted-foreground line-clamp-2">{selectedPrompt.fields.zweck_kontext}</p>
            )}
          </div>

          {/* Live counter */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {promptRevisions.length} {promptRevisions.length === 1 ? 'Revision' : 'Revisionen'} bisher
            </span>
            <Button
              variant="default"
              size="sm"
              onClick={() => setNachbesserungDialogOpen(true)}
              className="gap-1.5"
            >
              <IconPlus size={15} stroke={2} />
              Neue Revision hinzufügen
            </Button>
          </div>

          {/* Existing revisions list */}
          {promptRevisions.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {promptRevisions.map(rev => (
                <div
                  key={rev.record_id}
                  className="rounded-xl border bg-card p-4 overflow-hidden"
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                      v{rev.fields.versionsnummer ?? '?'}
                    </span>
                    {rev.fields.erstellt_am_nb && (
                      <span className="text-xs text-muted-foreground">{formatDate(rev.fields.erstellt_am_nb)}</span>
                    )}
                  </div>
                  {rev.fields.nachbesserungs_text && (
                    <p className="text-sm text-foreground line-clamp-2 min-w-0">{rev.fields.nachbesserungs_text}</p>
                  )}
                  {rev.fields.aenderungsnotiz && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{rev.fields.aenderungsnotiz}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              <IconPencil size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Noch keine Revisionen vorhanden.</p>
              <p className="text-xs mt-1">Füge eine erste Revision hinzu, um den Prompt zu verbessern.</p>
            </div>
          )}

          {/* NachbesserungDialog */}
          <NachbesserungDialog
            open={nachbesserungDialogOpen}
            onClose={() => setNachbesserungDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createNachbesserungEntry(fields);
              await fetchAll();
            }}
            defaultValues={{
              haupt_prompt_link: createRecordUrl(APP_IDS.HAUPT_PROMPT, selectedPrompt.record_id),
            }}
            haupt_promptList={hauptPrompt}
            enablePhotoScan={AI_PHOTO_SCAN['Nachbesserung']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Nachbesserung']}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-1.5">
              <IconArrowLeft size={15} stroke={2} />
              Zurück
            </Button>
            <Button variant="outline" onClick={() => setCurrentStep(3)} className="gap-1.5">
              Weiter ohne Revision
              <IconArrowRight size={15} stroke={2} />
            </Button>
            {promptRevisions.length > 0 && (
              <Button onClick={() => setCurrentStep(3)} className="gap-1.5">
                Weiter zu Finalisieren
                <IconArrowRight size={15} stroke={2} />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Finalisieren */}
      {currentStep === 3 && selectedPrompt && (
        <div className="space-y-5">
          {finalized ? (
            /* Success state */
            <div className="rounded-2xl border bg-card p-8 text-center space-y-4 overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <IconCheck size={28} className="text-green-600" stroke={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Prompt finalisiert!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  "{selectedPrompt.fields.name ?? 'Kein Name'}" wurde erfolgreich gespeichert.
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 px-4 py-3 text-left space-y-1">
                <p className="text-xs text-muted-foreground">Status gesetzt auf</p>
                <p className="text-sm font-medium">
                  {STATUS_OPTIONS.find(s => s.key === chosenStatus)?.label ?? chosenStatus}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <Button variant="outline" onClick={handleReset} className="gap-1.5">
                  <IconArrowLeft size={15} stroke={2} />
                  Neuen Prompt entwickeln
                </Button>
                <Button asChild>
                  <a href="#/haupt-prompt">Alle Prompts ansehen</a>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Selected prompt summary */}
              <div className="rounded-2xl border bg-card p-4 overflow-hidden">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate min-w-0">{selectedPrompt.fields.name ?? 'Kein Name'}</span>
                  {selectedPrompt.fields.status && (
                    <StatusBadge
                      statusKey={selectedPrompt.fields.status.key}
                      label={selectedPrompt.fields.status.label}
                    />
                  )}
                </div>
              </div>

              {/* Revision selection */}
              {promptRevisions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Wähle eine Revision als finalen Prompt-Text:
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {promptRevisions.map(rev => {
                      const isSelected = selectedRevisionId === rev.record_id;
                      return (
                        <button
                          key={rev.record_id}
                          onClick={() => setSelectedRevisionId(isSelected ? null : rev.record_id)}
                          className={`w-full text-left rounded-xl border p-4 transition-colors overflow-hidden ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                              : 'border-border bg-card hover:bg-accent hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              isSelected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                            }`}>
                              v{rev.fields.versionsnummer ?? '?'}
                            </span>
                            {rev.fields.erstellt_am_nb && (
                              <span className="text-xs text-muted-foreground">{formatDate(rev.fields.erstellt_am_nb)}</span>
                            )}
                            {isSelected && (
                              <span className="ml-auto shrink-0">
                                <IconCheck size={14} className="text-primary" stroke={2.5} />
                              </span>
                            )}
                          </div>
                          {rev.fields.nachbesserungs_text && (
                            <p className="text-sm text-foreground line-clamp-2 min-w-0">{rev.fields.nachbesserungs_text}</p>
                          )}
                          {rev.fields.aenderungsnotiz && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{rev.fields.aenderungsnotiz}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {selectedRevisionId === null && (
                    <p className="text-xs text-muted-foreground">
                      Keine Revision gewählt — der originale Prompt-Text wird verwendet.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                  <p className="text-sm">Keine Revisionen vorhanden.</p>
                  <p className="text-xs mt-1">Der originale Prompt-Text wird als vollständiger Prompt gespeichert.</p>
                </div>
              )}

              {/* Preview */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Vollständiger Prompt (Vorschau)
                </label>
                <textarea
                  readOnly
                  value={previewText}
                  rows={6}
                  className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm text-foreground resize-none focus:outline-none"
                  placeholder="Kein Text vorhanden."
                />
              </div>

              {/* Status selector */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Status setzen:</p>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setChosenStatus(opt.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        chosenStatus === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-accent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-1.5">
                  <IconArrowLeft size={15} stroke={2} />
                  Zurück
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="gap-1.5"
                >
                  {finalizing ? (
                    'Wird gespeichert...'
                  ) : (
                    <>
                      <IconCheck size={15} stroke={2.5} />
                      Prompt finalisieren
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

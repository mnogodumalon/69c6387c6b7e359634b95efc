import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { HauptPromptDialog } from '@/components/dialogs/HauptPromptDialog';
import { NachbesserungDialog } from '@/components/dialogs/NachbesserungDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { HauptPrompt, Nachbesserung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import {
  IconFileText,
  IconPlus,
  IconPencil,
  IconCircleCheck,
  IconHistory,
  IconRefresh,
  IconArrowRight,
  IconRotate,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Prompt wählen' },
  { label: 'Nachbesserung' },
  { label: 'Status & Abschluss' },
];

export default function PromptPflegePage() {
  const { hauptPrompt, nachbesserung, loading, error, fetchAll } = useDashboardData();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- All hooks before early returns ---
  const [step, setStep] = useState<number>(1);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  // Dialog states
  const [newPromptDialogOpen, setNewPromptDialogOpen] = useState(false);
  const [editPromptDialogOpen, setEditPromptDialogOpen] = useState(false);
  const [newNbDialogOpen, setNewNbDialogOpen] = useState(false);
  const [editNbDialogOpen, setEditNbDialogOpen] = useState(false);
  const [editNbRecord, setEditNbRecord] = useState<Nachbesserung | null>(null);

  // Step 3 feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Deep-link: read ?promptId= and ?step= from URL on mount
  useEffect(() => {
    const urlStep = parseInt(searchParams.get('step') ?? '', 10);
    const urlPromptId = searchParams.get('promptId');
    if (urlPromptId) setSelectedPromptId(urlPromptId);
    if (urlStep >= 1 && urlStep <= 3) setStep(urlStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync step and promptId to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (step > 1) {
      params.set('step', String(step));
    } else {
      params.delete('step');
    }
    if (selectedPromptId) {
      params.set('promptId', selectedPromptId);
    } else {
      params.delete('promptId');
    }
    setSearchParams(params, { replace: true });
  }, [step, selectedPromptId, searchParams, setSearchParams]);

  // Derived data
  const selectedPrompt: HauptPrompt | null = useMemo(() => {
    if (!selectedPromptId) return null;
    return hauptPrompt.find(p => p.record_id === selectedPromptId) ?? null;
  }, [hauptPrompt, selectedPromptId]);

  const promptNachbesserungen: Nachbesserung[] = useMemo(() => {
    if (!selectedPromptId) return [];
    return nachbesserung
      .filter(nb => extractRecordId(nb.fields.haupt_prompt_link) === selectedPromptId)
      .sort((a, b) => {
        const va = a.fields.versionsnummer ?? '';
        const vb = b.fields.versionsnummer ?? '';
        return va.localeCompare(vb, undefined, { numeric: true });
      });
  }, [nachbesserung, selectedPromptId]);

  const nextVersionSuggestion = useMemo(() => {
    if (promptNachbesserungen.length === 0) return '1';
    const nums = promptNachbesserungen.map(nb => {
      const v = nb.fields.versionsnummer ?? '0';
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    });
    const max = Math.max(...nums);
    return String(Math.floor(max) + 1);
  }, [promptNachbesserungen]);

  // Filter: show non-archived prompts first, then all
  const filteredPrompts = useMemo(() => {
    return hauptPrompt.filter(p => p.fields.status?.key !== 'archiviert');
  }, [hauptPrompt]);

  function handleSelectPrompt(id: string) {
    setSelectedPromptId(id);
    setSuccessMsg(null);
    setStep(2);
  }

  function handleRestart() {
    setSelectedPromptId(null);
    setSuccessMsg(null);
    setStep(1);
  }

  async function handleStatusChange(newStatus: string) {
    if (!selectedPrompt) return;
    setActionLoading(true);
    setSuccessMsg(null);
    try {
      await LivingAppsService.updateHauptPromptEntry(selectedPrompt.record_id, {
        status: newStatus,
      });
      await fetchAll();
      const label = newStatus === 'archiviert' ? 'archiviert' : 'aktiviert';
      setSuccessMsg(`Prompt erfolgreich ${label}.`);
    } catch (err) {
      setSuccessMsg(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateDate() {
    if (!selectedPrompt) return;
    setActionLoading(true);
    setSuccessMsg(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await LivingAppsService.updateHauptPromptEntry(selectedPrompt.record_id, {
        zuletzt_geaendert: today,
      });
      await fetchAll();
      setSuccessMsg(`Datum auf ${today} aktualisiert.`);
    } catch (err) {
      setSuccessMsg(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  }

  const statusKey = selectedPrompt?.fields.status?.key;
  const statusLabel = selectedPrompt?.fields.status?.label;

  return (
    <>
      <IntentWizardShell
        title="Prompt pflegen"
        subtitle="Aktive Prompts aktualisieren und versionieren"
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        {/* ---- STEP 1: Prompt wählen ---- */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-4 space-y-1 overflow-hidden">
              <h2 className="font-semibold text-base">Welchen Prompt möchtest du pflegen?</h2>
              <p className="text-sm text-muted-foreground">
                Aktive und Entwurfs-Prompts werden angezeigt. Archivierte Prompts sind ausgeblendet.
              </p>
            </div>

            <EntitySelectStep
              items={filteredPrompts.map(p => ({
                id: p.record_id,
                title: p.fields.name ?? '(Kein Name)',
                subtitle: p.fields.zweck_kontext ?? undefined,
                status: p.fields.status
                  ? { key: p.fields.status.key, label: p.fields.status.label }
                  : undefined,
                stats: [
                  { label: 'ID', value: p.fields.prompt_id ?? '—' },
                  { label: 'Geändert', value: formatDate(p.fields.zuletzt_geaendert) },
                ],
                icon: <IconFileText size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectPrompt}
              searchPlaceholder="Prompt suchen..."
              emptyIcon={<IconFileText size={32} />}
              emptyText="Keine aktiven Prompts gefunden."
              createLabel="Neuen Prompt anlegen"
              onCreateNew={() => setNewPromptDialogOpen(true)}
              createDialog={
                <HauptPromptDialog
                  open={newPromptDialogOpen}
                  onClose={() => setNewPromptDialogOpen(false)}
                  onSubmit={async (fields) => {
                    await LivingAppsService.createHauptPromptEntry(fields);
                    await fetchAll();
                  }}
                  enablePhotoScan={AI_PHOTO_SCAN['HauptPrompt']}
                />
              }
            />
          </div>
        )}

        {/* ---- STEP 2: Neue Nachbesserung ---- */}
        {step === 2 && selectedPrompt && (
          <div className="space-y-4">
            {/* Prompt info panel */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="p-4 border-b flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-base truncate">
                      {selectedPrompt.fields.name ?? '(Kein Name)'}
                    </h2>
                    {selectedPrompt.fields.status && (
                      <StatusBadge
                        statusKey={selectedPrompt.fields.status.key}
                        label={selectedPrompt.fields.status.label}
                      />
                    )}
                  </div>
                  {selectedPrompt.fields.zweck_kontext && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {selectedPrompt.fields.zweck_kontext}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectPrompt(selectedPromptId!)}
                  className="shrink-0"
                >
                  Wechseln
                </Button>
              </div>

              {/* Current prompt text */}
              {(selectedPrompt.fields.vollstaendiger_prompt || selectedPrompt.fields.prompt_text) && (
                <div className="p-4 bg-secondary/30">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Aktueller Prompt-Text
                  </p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono bg-background rounded-lg p-3 border max-h-40 overflow-y-auto">
                    {selectedPrompt.fields.vollstaendiger_prompt ?? selectedPrompt.fields.prompt_text}
                  </pre>
                </div>
              )}
            </div>

            {/* Nachbesserung history */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconHistory size={18} className="text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Versions-Historie</h3>
                  <Badge variant="secondary" className="text-xs">
                    {promptNachbesserungen.length} {promptNachbesserungen.length === 1 ? 'Version' : 'Versionen'}
                  </Badge>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setNewNbDialogOpen(true)}
                  className="gap-1.5"
                >
                  <IconPlus size={15} />
                  Neue Nachbesserung
                </Button>
              </div>

              {promptNachbesserungen.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="flex justify-center mb-3 opacity-40">
                    <IconHistory size={32} />
                  </div>
                  <p className="text-sm text-muted-foreground">Noch keine Nachbesserungen vorhanden.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Empfohlene erste Version: <span className="font-medium">v{nextVersionSuggestion}</span>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewNbDialogOpen(true)}
                    className="mt-3 gap-1.5"
                  >
                    <IconPlus size={14} />
                    Erste Nachbesserung anlegen
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {promptNachbesserungen.map((nb) => (
                    <div key={nb.record_id} className="p-4 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          v{nb.fields.versionsnummer ?? '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {nb.fields.aenderungsnotiz && (
                          <p className="text-sm font-medium truncate">{nb.fields.aenderungsnotiz}</p>
                        )}
                        {nb.fields.nachbesserungs_text && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {nb.fields.nachbesserungs_text}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(nb.fields.erstellt_am_nb)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditNbRecord(nb);
                          setEditNbDialogOpen(true);
                        }}
                        className="shrink-0 p-2 h-8 w-8"
                        title="Nachbesserung bearbeiten"
                      >
                        <IconPencil size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {promptNachbesserungen.length > 0 && (
                <div className="p-3 bg-secondary/20 border-t text-xs text-muted-foreground">
                  Nächste empfohlene Version: <span className="font-medium">v{nextVersionSuggestion}</span>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück
              </Button>
              <Button onClick={() => setStep(3)} className="gap-1.5">
                Status &amp; Abschluss
                <IconArrowRight size={16} />
              </Button>
            </div>

            {/* Dialogs */}
            <NachbesserungDialog
              open={newNbDialogOpen}
              onClose={() => setNewNbDialogOpen(false)}
              onSubmit={async (fields) => {
                await LivingAppsService.createNachbesserungEntry(fields);
                await fetchAll();
              }}
              defaultValues={{
                haupt_prompt_link: createRecordUrl(APP_IDS.HAUPT_PROMPT, selectedPrompt.record_id),
              }}
              haupt_promptList={hauptPrompt}
              enablePhotoScan={AI_PHOTO_SCAN['Nachbesserung']}
            />

            <NachbesserungDialog
              open={editNbDialogOpen}
              onClose={() => {
                setEditNbDialogOpen(false);
                setEditNbRecord(null);
              }}
              onSubmit={async (fields) => {
                if (!editNbRecord) return;
                await LivingAppsService.updateNachbesserungEntry(editNbRecord.record_id, fields);
                await fetchAll();
              }}
              defaultValues={editNbRecord?.fields}
              haupt_promptList={hauptPrompt}
              enablePhotoScan={AI_PHOTO_SCAN['Nachbesserung']}
            />
          </div>
        )}

        {/* ---- STEP 3: Status aktualisieren ---- */}
        {step === 3 && selectedPrompt && (
          <div className="space-y-4">
            {/* Summary card */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-base truncate">
                      {selectedPrompt.fields.name ?? '(Kein Name)'}
                    </h2>
                    {selectedPrompt.fields.prompt_id && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ID: {selectedPrompt.fields.prompt_id}
                      </p>
                    )}
                  </div>
                  {selectedPrompt.fields.status && (
                    <StatusBadge
                      statusKey={selectedPrompt.fields.status.key}
                      label={selectedPrompt.fields.status.label}
                    />
                  )}
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Versionen</p>
                  <p className="font-semibold text-lg">{promptNachbesserungen.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Zuletzt geändert</p>
                  <p className="font-medium">{formatDate(selectedPrompt.fields.zuletzt_geaendert)}</p>
                </div>
              </div>
            </div>

            {/* Version timeline */}
            {promptNachbesserungen.length > 0 && (
              <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="p-4 border-b flex items-center gap-2">
                  <IconHistory size={16} className="text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Alle Versionen</h3>
                  <Badge variant="secondary" className="text-xs">
                    {promptNachbesserungen.length}
                  </Badge>
                </div>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {promptNachbesserungen.map((nb) => (
                    <div key={nb.record_id} className="p-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">
                          v{nb.fields.versionsnummer ?? '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {nb.fields.aenderungsnotiz && (
                          <p className="text-sm font-medium">{nb.fields.aenderungsnotiz}</p>
                        )}
                        {nb.fields.nachbesserungs_text && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {nb.fields.nachbesserungs_text}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(nb.fields.erstellt_am_nb)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-sm">Aktionen</h3>

              <div className="flex flex-col gap-2">
                {statusKey === 'aktiv' && (
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange('archiviert')}
                    disabled={actionLoading}
                    className="w-full justify-start gap-2"
                  >
                    <IconHistory size={16} className="text-muted-foreground" />
                    Prompt archivieren
                  </Button>
                )}

                {statusKey === 'entwurf' && (
                  <Button
                    variant="default"
                    onClick={() => handleStatusChange('aktiv')}
                    disabled={actionLoading}
                    className="w-full justify-start gap-2"
                  >
                    <IconCircleCheck size={16} />
                    Prompt aktivieren
                  </Button>
                )}

                {statusKey === 'archiviert' && (
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange('aktiv')}
                    disabled={actionLoading}
                    className="w-full justify-start gap-2"
                  >
                    <IconCircleCheck size={16} className="text-green-600" />
                    Prompt reaktivieren
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={handleUpdateDate}
                  disabled={actionLoading}
                  className="w-full justify-start gap-2"
                >
                  <IconRefresh size={16} className="text-muted-foreground" />
                  Datum auf heute aktualisieren
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setEditPromptDialogOpen(true)}
                  disabled={actionLoading}
                  className="w-full justify-start gap-2"
                >
                  <IconPencil size={16} className="text-muted-foreground" />
                  Prompt-Text aktualisieren
                </Button>
              </div>

              {/* Success feedback */}
              {successMsg && (
                <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
                  successMsg.startsWith('Fehler')
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                }`}>
                  {!successMsg.startsWith('Fehler') && <IconCircleCheck size={16} />}
                  {successMsg}
                </div>
              )}
            </div>

            {/* Status summary */}
            <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 overflow-hidden">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedPrompt.fields.name ?? '(Kein Name)'}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge statusKey={statusKey} label={statusLabel} />
                  <span className="text-xs text-muted-foreground">
                    {promptNachbesserungen.length} {promptNachbesserungen.length === 1 ? 'Version' : 'Versionen'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Zurück
              </Button>
              <Button variant="outline" onClick={handleRestart} className="gap-1.5">
                <IconRotate size={16} />
                Anderen Prompt pflegen
              </Button>
            </div>

            {/* Edit prompt dialog */}
            <HauptPromptDialog
              open={editPromptDialogOpen}
              onClose={() => setEditPromptDialogOpen(false)}
              onSubmit={async (fields) => {
                await LivingAppsService.updateHauptPromptEntry(selectedPrompt.record_id, fields);
                await fetchAll();
              }}
              defaultValues={selectedPrompt.fields}
              enablePhotoScan={AI_PHOTO_SCAN['HauptPrompt']}
            />
          </div>
        )}

        {/* Fallback: no prompt selected but on step 2/3 */}
        {(step === 2 || step === 3) && !selectedPrompt && (
          <div className="text-center py-16 space-y-3">
            <div className="flex justify-center opacity-40">
              <IconFileText size={40} />
            </div>
            <p className="text-sm text-muted-foreground">Kein Prompt ausgewählt.</p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Zurück zur Auswahl
            </Button>
          </div>
        )}
      </IntentWizardShell>
    </>
  );
}

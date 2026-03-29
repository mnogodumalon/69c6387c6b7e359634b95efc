import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HauptPrompt, Nachbesserung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { HauptPromptDialog } from '@/components/dialogs/HauptPromptDialog';
import { NachbesserungDialog } from '@/components/dialogs/NachbesserungDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import {
  IconPlus,
  IconArrowRight,
  IconCircleCheck,
  IconRotate,
  IconLoader2,
  IconFileText,
  IconEdit,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Prompt auswählen' },
  { label: 'Nachbesserungen' },
  { label: 'Aktivieren' },
];

export default function PromptEntwicklungPage() {
  const { hauptPrompt, nachbesserung, loading, error, fetchAll } = useDashboardData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPrompt, setSelectedPrompt] = useState<HauptPrompt | null>(null);
  const [hauptPromptDialogOpen, setHauptPromptDialogOpen] = useState(false);
  const [nachbesserungDialogOpen, setNachbesserungDialogOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Deep-linking: read ?step= and ?promptId= from URL on mount
  useEffect(() => {
    const urlStep = parseInt(searchParams.get('step') ?? '', 10);
    const urlPromptId = searchParams.get('promptId');

    if (urlPromptId && hauptPrompt.length > 0) {
      const found = hauptPrompt.find(p => p.record_id === urlPromptId);
      if (found) {
        setSelectedPrompt(found);
        if (urlStep >= 2 && urlStep <= 3) {
          setCurrentStep(urlStep);
        }
      }
    } else if (urlStep >= 1 && urlStep <= 3) {
      setCurrentStep(urlStep);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hauptPrompt]);

  // Sync step and promptId to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedPrompt) {
      params.set('promptId', selectedPrompt.record_id);
    } else {
      params.delete('promptId');
    }
    setSearchParams(params, { replace: true });
  }, [currentStep, selectedPrompt, searchParams, setSearchParams]);

  // Filter prompts with status "entwurf" for selection
  const entwurfPrompts = useMemo(
    () => hauptPrompt.filter(p => p.fields.status?.key === 'entwurf'),
    [hauptPrompt]
  );

  // Filter Nachbesserungen linked to the selected prompt
  const linkedNachbesserungen = useMemo((): Nachbesserung[] => {
    if (!selectedPrompt) return [];
    return nachbesserung.filter(n => {
      const linkedId = extractRecordId(n.fields.haupt_prompt_link);
      return linkedId === selectedPrompt.record_id;
    });
  }, [nachbesserung, selectedPrompt]);

  function handleSelectPrompt(id: string) {
    const found = hauptPrompt.find(p => p.record_id === id) ?? null;
    setSelectedPrompt(found);
    setCurrentStep(2);
  }

  async function handleActivate() {
    if (!selectedPrompt) return;
    setActivating(true);
    setActivateError(null);
    const today = new Date().toISOString().slice(0, 10);
    try {
      await LivingAppsService.updateHauptPromptEntry(selectedPrompt.record_id, {
        status: 'aktiv',
        zuletzt_geaendert: today,
      });
      await fetchAll();
      setActivated(true);
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : 'Aktivierung fehlgeschlagen');
    } finally {
      setActivating(false);
    }
  }

  function handleRestart() {
    setSelectedPrompt(null);
    setActivated(false);
    setActivateError(null);
    setCurrentStep(1);
  }

  // --- Step 1: Prompt auswählen ---
  const step1 = (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Wähle einen bestehenden Prompt im Entwurfsstatus aus oder erstelle einen neuen.
        </p>
        <EntitySelectStep
          items={entwurfPrompts.map(p => ({
            id: p.record_id,
            title: p.fields.name ?? p.record_id,
            subtitle: p.fields.zweck_kontext,
            status: p.fields.status,
            icon: <IconFileText size={18} className="text-primary" />,
          }))}
          onSelect={handleSelectPrompt}
          searchPlaceholder="Prompt suchen..."
          emptyIcon={<IconFileText size={32} />}
          emptyText="Kein Prompt im Entwurfsstatus gefunden."
          createLabel="Neuen Prompt erstellen"
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
            />
          }
        />
      </div>
    </div>
  );

  // --- Step 2: Nachbesserungen hinzufügen ---
  const step2 = selectedPrompt ? (
    <div className="space-y-4">
      {/* Selected prompt info panel */}
      <div className="rounded-xl border bg-card p-4 space-y-3 overflow-hidden">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconFileText size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-base truncate">
                {selectedPrompt.fields.name ?? selectedPrompt.record_id}
              </h2>
              <StatusBadge
                statusKey={selectedPrompt.fields.status?.key}
                label={selectedPrompt.fields.status?.label}
              />
            </div>
            {selectedPrompt.fields.zweck_kontext && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {selectedPrompt.fields.zweck_kontext}
              </p>
            )}
          </div>
        </div>

        {(selectedPrompt.fields.prompt_text || selectedPrompt.fields.vollstaendiger_prompt) && (
          <div className="rounded-lg bg-muted/50 border p-3 overflow-hidden">
            <p className="text-xs font-medium text-muted-foreground mb-1">Prompt-Text</p>
            <pre className="text-xs text-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto font-mono">
              {selectedPrompt.fields.vollstaendiger_prompt ?? selectedPrompt.fields.prompt_text}
            </pre>
          </div>
        )}
      </div>

      {/* Nachbesserungen counter + add button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {linkedNachbesserungen.length}{' '}
            {linkedNachbesserungen.length === 1 ? 'Nachbesserung' : 'Nachbesserungen'}
          </span>
        </div>
        <Button
          onClick={() => setNachbesserungDialogOpen(true)}
          className="gap-2 shrink-0"
        >
          <IconPlus size={16} stroke={2} />
          Nachbesserung hinzufügen
        </Button>
      </div>

      {/* Linked Nachbesserungen list */}
      {linkedNachbesserungen.length > 0 ? (
        <div className="space-y-2">
          {linkedNachbesserungen.map(nb => (
            <div
              key={nb.record_id}
              className="rounded-xl border bg-card p-4 overflow-hidden"
            >
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {nb.fields.versionsnummer && (
                  <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    v{nb.fields.versionsnummer}
                  </span>
                )}
                {nb.fields.erstellt_am_nb && (
                  <span className="text-xs text-muted-foreground">{nb.fields.erstellt_am_nb}</span>
                )}
              </div>
              {nb.fields.aenderungsnotiz && (
                <p className="text-sm font-medium truncate">{nb.fields.aenderungsnotiz}</p>
              )}
              {nb.fields.nachbesserungs_text && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {nb.fields.nachbesserungs_text}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground rounded-xl border border-dashed">
          <IconEdit size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Noch keine Nachbesserungen vorhanden.</p>
          <p className="text-xs mt-1">Füge Verbesserungen hinzu, bevor du den Prompt aktivierst.</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => setCurrentStep(1)}>
          Zurück
        </Button>
        <Button onClick={() => setCurrentStep(3)} className="gap-2">
          Bereit zur Aktivierung
          <IconArrowRight size={16} stroke={2} />
        </Button>
      </div>

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
      />
    </div>
  ) : null;

  // --- Step 3: Prompt aktivieren ---
  const step3 = selectedPrompt ? (
    <div className="space-y-4">
      {activated ? (
        /* Success state */
        <div className="rounded-xl border bg-card p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <IconCircleCheck size={32} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-green-700">Prompt ist jetzt aktiv!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              "{selectedPrompt.fields.name}" wurde erfolgreich aktiviert.
            </p>
          </div>
          <Button variant="outline" onClick={handleRestart} className="gap-2 mt-2">
            <IconRotate size={16} stroke={2} />
            Weiteren Prompt entwickeln
          </Button>
        </div>
      ) : (
        <>
          {/* Summary panel */}
          <div className="rounded-xl border bg-card p-4 space-y-4 overflow-hidden">
            <h2 className="font-semibold text-base">Zusammenfassung</h2>

            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  {selectedPrompt.fields.name ?? selectedPrompt.record_id}
                </span>
                <StatusBadge
                  statusKey={selectedPrompt.fields.status?.key}
                  label={selectedPrompt.fields.status?.label}
                />
              </div>

              {selectedPrompt.fields.zweck_kontext && (
                <p className="text-sm text-muted-foreground">
                  {selectedPrompt.fields.zweck_kontext}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-lg">{linkedNachbesserungen.length}</span>
                <span className="text-muted-foreground">
                  {linkedNachbesserungen.length === 1 ? 'Nachbesserung' : 'Nachbesserungen'}
                </span>
              </div>
            </div>

            {(selectedPrompt.fields.vollstaendiger_prompt ?? selectedPrompt.fields.prompt_text) && (
              <div className="rounded-lg bg-muted/50 border p-3 overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground mb-1">Vollständiger Prompt</p>
                <pre className="text-xs text-foreground whitespace-pre-wrap break-words max-h-60 overflow-y-auto font-mono">
                  {selectedPrompt.fields.vollstaendiger_prompt ?? selectedPrompt.fields.prompt_text}
                </pre>
              </div>
            )}
          </div>

          {activateError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {activateError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Zurück
            </Button>
            <Button
              onClick={handleActivate}
              disabled={activating}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {activating ? (
                <>
                  <IconLoader2 size={16} className="animate-spin" />
                  Aktiviere...
                </>
              ) : (
                <>
                  <IconCircleCheck size={16} stroke={2} />
                  Prompt aktivieren
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <IntentWizardShell
      title="Prompt entwickeln"
      subtitle="Entwurf verfassen, verfeinern und aktivieren"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {currentStep === 1 && step1}
      {currentStep === 2 && step2}
      {currentStep === 3 && step3}
    </IntentWizardShell>
  );
}

import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichNachbesserung } from '@/lib/enrich';
import type { EnrichedNachbesserung } from '@/types/enriched';
import type { HauptPrompt } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HauptPromptDialog } from '@/components/dialogs/HauptPromptDialog';
import { NachbesserungDialog } from '@/components/dialogs/NachbesserungDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import {
  IconAlertCircle, IconPlus, IconPencil, IconTrash, IconSearch,
  IconFileText, IconCheck, IconChevronRight, IconHistory,
  IconRocket, IconEdit, IconRefresh,
} from '@tabler/icons-react';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  aktiv:      { label: 'Aktiv',       className: 'bg-emerald-100 text-emerald-700' },
  archiviert: { label: 'Archiviert',  className: 'bg-gray-100 text-gray-600' },
  entwurf:    { label: 'Entwurf',     className: 'bg-amber-100 text-amber-700' },
};

export default function DashboardOverview() {
  const {
    hauptPrompt, nachbesserung,
    hauptPromptMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedNachbesserung = enrichNachbesserung(nachbesserung, { hauptPromptMap });

  const [searchQuery, setSearchQuery]           = useState('');
  const [statusFilter, setStatusFilter]         = useState('all');
  const [selectedPrompt, setSelectedPrompt]     = useState<HauptPrompt | null>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editPrompt, setEditPrompt]             = useState<HauptPrompt | null>(null);
  const [nbDialogOpen, setNbDialogOpen]         = useState(false);
  const [editNb, setEditNb]                     = useState<EnrichedNachbesserung | null>(null);
  const [deletePromptTarget, setDeletePromptTarget] = useState<HauptPrompt | null>(null);
  const [deleteNbTarget, setDeleteNbTarget]     = useState<EnrichedNachbesserung | null>(null);

  const filteredPrompts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return hauptPrompt.filter(p => {
      const matchesSearch = !q ||
        p.fields.name?.toLowerCase().includes(q) ||
        p.fields.zweck_kontext?.toLowerCase().includes(q) ||
        p.fields.prompt_id?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.fields.status?.key === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [hauptPrompt, searchQuery, statusFilter]);

  const promptNachbesserungen = useMemo(() => {
    if (!selectedPrompt) return [];
    return enrichedNachbesserung
      .filter(nb => extractRecordId(nb.fields.haupt_prompt_link) === selectedPrompt.record_id)
      .sort((a, b) => (b.fields.versionsnummer ?? '').localeCompare(a.fields.versionsnummer ?? ''));
  }, [enrichedNachbesserung, selectedPrompt]);

  const stats = useMemo(() => ({
    total:       hauptPrompt.length,
    aktiv:       hauptPrompt.filter(p => p.fields.status?.key === 'aktiv').length,
    entwurf:     hauptPrompt.filter(p => p.fields.status?.key === 'entwurf').length,
    refinements: nachbesserung.length,
  }), [hauptPrompt, nachbesserung]);

  if (loading) return <DashboardSkeleton />;
  if (error)   return <DashboardError error={error} onRetry={fetchAll} />;

  const handleDeletePrompt = async () => {
    if (!deletePromptTarget) return;
    await LivingAppsService.deleteHauptPromptEntry(deletePromptTarget.record_id);
    if (selectedPrompt?.record_id === deletePromptTarget.record_id) setSelectedPrompt(null);
    setDeletePromptTarget(null);
    fetchAll();
  };

  const handleDeleteNb = async () => {
    if (!deleteNbTarget) return;
    await LivingAppsService.deleteNachbesserungEntry(deleteNbTarget.record_id);
    setDeleteNbTarget(null);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      {/* Workflows */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <IconRocket size={18} className="text-primary shrink-0" />
          <h2 className="font-semibold text-foreground">Workflows</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="#/intents/prompt-entwicklung" className="group flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconEdit size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">Prompt entwickeln</p>
              <p className="text-xs text-muted-foreground mt-0.5">Entwurf verfassen, verfeinern und aktivieren</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </a>
          <a href="#/intents/prompt-pflege" className="group flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconRefresh size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">Prompt pflegen</p>
              <p className="text-xs text-muted-foreground mt-0.5">Aktive Prompts versionieren und aktualisieren</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Prompts gesamt"
          value={String(stats.total)}
          description="in der Bibliothek"
          icon={<IconFileText size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Aktiv"
          value={String(stats.aktiv)}
          description="in Verwendung"
          icon={<IconCheck size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Entwürfe"
          value={String(stats.entwurf)}
          description="in Bearbeitung"
          icon={<IconPencil size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Nachbesserungen"
          value={String(stats.refinements)}
          description="Verbesserungen"
          icon={<IconHistory size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Master–Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left — Prompt List */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                placeholder="Suchen…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              size="sm"
              onClick={() => { setEditPrompt(null); setPromptDialogOpen(true); }}
            >
              <IconPlus size={16} className="shrink-0" />
              <span className="hidden sm:inline ml-1">Neu</span>
            </Button>
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'aktiv', 'entwurf', 'archiviert'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {s === 'all' ? 'Alle' : s === 'aktiv' ? 'Aktiv' : s === 'entwurf' ? 'Entwurf' : 'Archiviert'}
              </button>
            ))}
          </div>

          {/* Prompt Cards */}
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[560px]">
            {filteredPrompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <IconFileText size={48} className="text-muted-foreground mb-3" stroke={1.5} />
                <p className="text-sm text-muted-foreground">Keine Prompts gefunden</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => { setEditPrompt(null); setPromptDialogOpen(true); }}
                >
                  <IconPlus size={16} className="mr-1 shrink-0" />
                  Ersten Prompt erstellen
                </Button>
              </div>
            ) : (
              filteredPrompts.map(prompt => {
                const isSelected = selectedPrompt?.record_id === prompt.record_id;
                const sc = STATUS_CONFIG[prompt.fields.status?.key ?? 'entwurf'] ?? STATUS_CONFIG.entwurf;
                const nbCount = enrichedNachbesserung.filter(
                  nb => extractRecordId(nb.fields.haupt_prompt_link) === prompt.record_id
                ).length;
                return (
                  <div
                    key={prompt.record_id}
                    onClick={() => setSelectedPrompt(isSelected ? null : prompt)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          {prompt.fields.prompt_id && (
                            <span className="text-xs font-mono text-muted-foreground shrink-0">
                              {prompt.fields.prompt_id}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${sc.className}`}>
                            {sc.label}
                          </span>
                        </div>
                        <p className="font-medium text-sm truncate">
                          {prompt.fields.name ?? '(Kein Name)'}
                        </p>
                        {prompt.fields.zweck_kontext && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {prompt.fields.zweck_kontext}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {nbCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {nbCount} Nachbesserung{nbCount !== 1 ? 'en' : ''}
                            </span>
                          )}
                          {prompt.fields.erstellt_am && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(prompt.fields.erstellt_am)}
                            </span>
                          )}
                        </div>
                      </div>
                      <IconChevronRight
                        size={16}
                        className={`shrink-0 text-muted-foreground mt-1 transition-transform ${isSelected ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right — Detail Panel */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {selectedPrompt ? (
            <>
              {/* Prompt Detail Card */}
              <div className="rounded-2xl border bg-card p-5 space-y-4 overflow-hidden">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {selectedPrompt.fields.prompt_id && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {selectedPrompt.fields.prompt_id}
                        </span>
                      )}
                      {selectedPrompt.fields.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          (STATUS_CONFIG[selectedPrompt.fields.status.key] ?? STATUS_CONFIG.entwurf).className
                        }`}>
                          {selectedPrompt.fields.status.label}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-foreground truncate">
                      {selectedPrompt.fields.name ?? '(Kein Name)'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditPrompt(selectedPrompt); setPromptDialogOpen(true); }}
                    >
                      <IconPencil size={14} className="shrink-0" />
                      <span className="ml-1 hidden sm:inline">Bearbeiten</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletePromptTarget(selectedPrompt)}
                    >
                      <IconTrash size={14} className="shrink-0" />
                    </Button>
                  </div>
                </div>

                {selectedPrompt.fields.zweck_kontext && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Zweck / Kontext</p>
                    <p className="text-sm text-foreground">{selectedPrompt.fields.zweck_kontext}</p>
                  </div>
                )}

                {(selectedPrompt.fields.vollstaendiger_prompt || selectedPrompt.fields.prompt_text) && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {selectedPrompt.fields.vollstaendiger_prompt ? 'Vollständiger Prompt' : 'Prompt-Text'}
                    </p>
                    <div className="bg-muted/50 rounded-lg p-3 max-h-52 overflow-y-auto">
                      <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                        {selectedPrompt.fields.vollstaendiger_prompt ?? selectedPrompt.fields.prompt_text}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                  {selectedPrompt.fields.erstellt_am && (
                    <span>Erstellt: {formatDate(selectedPrompt.fields.erstellt_am)}</span>
                  )}
                  {selectedPrompt.fields.zuletzt_geaendert && (
                    <span>Geändert: {formatDate(selectedPrompt.fields.zuletzt_geaendert)}</span>
                  )}
                </div>
              </div>

              {/* Nachbesserungen Card */}
              <div className="rounded-2xl border bg-card p-5 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <IconHistory size={16} className="text-muted-foreground shrink-0" />
                    Nachbesserungen ({promptNachbesserungen.length})
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => { setEditNb(null); setNbDialogOpen(true); }}
                  >
                    <IconPlus size={14} className="shrink-0" />
                    <span className="ml-1 hidden sm:inline">Hinzufügen</span>
                  </Button>
                </div>

                {promptNachbesserungen.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <IconHistory size={36} className="text-muted-foreground mb-2" stroke={1.5} />
                    <p className="text-sm text-muted-foreground">Noch keine Nachbesserungen</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => { setEditNb(null); setNbDialogOpen(true); }}
                    >
                      <IconPlus size={16} className="mr-1 shrink-0" />
                      Erste Nachbesserung hinzufügen
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {promptNachbesserungen.map(nb => (
                      <div key={nb.record_id} className="border rounded-xl p-3 bg-muted/30">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {nb.fields.versionsnummer && (
                                <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  v{nb.fields.versionsnummer}
                                </span>
                              )}
                              {nb.fields.erstellt_am_nb && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(nb.fields.erstellt_am_nb)}
                                </span>
                              )}
                            </div>
                            {nb.fields.aenderungsnotiz && (
                              <p className="text-xs font-medium text-foreground mb-1">{nb.fields.aenderungsnotiz}</p>
                            )}
                            {nb.fields.nachbesserungs_text && (
                              <p className="text-xs text-muted-foreground line-clamp-3">{nb.fields.nachbesserungs_text}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => { setEditNb(nb); setNbDialogOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                            >
                              <IconPencil size={14} className="text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => setDeleteNbTarget(nb)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                            >
                              <IconTrash size={14} className="text-destructive" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center py-32 text-center">
              <IconFileText size={48} className="text-muted-foreground mb-3" stroke={1.5} />
              <p className="font-medium text-foreground">Prompt auswählen</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Wähle einen Prompt aus der Liste, um Details und Nachbesserungen zu sehen
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <HauptPromptDialog
        open={promptDialogOpen}
        onClose={() => { setPromptDialogOpen(false); setEditPrompt(null); }}
        onSubmit={async (fields) => {
          if (editPrompt) {
            await LivingAppsService.updateHauptPromptEntry(editPrompt.record_id, fields);
          } else {
            await LivingAppsService.createHauptPromptEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editPrompt?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['HauptPrompt']}
      />

      <NachbesserungDialog
        open={nbDialogOpen}
        onClose={() => { setNbDialogOpen(false); setEditNb(null); }}
        onSubmit={async (fields) => {
          if (editNb) {
            await LivingAppsService.updateNachbesserungEntry(editNb.record_id, fields);
          } else {
            const withLink = selectedPrompt
              ? { ...fields, haupt_prompt_link: createRecordUrl(APP_IDS.HAUPT_PROMPT, selectedPrompt.record_id) }
              : fields;
            await LivingAppsService.createNachbesserungEntry(withLink);
          }
          fetchAll();
        }}
        defaultValues={
          editNb
            ? editNb.fields
            : selectedPrompt
              ? { haupt_prompt_link: createRecordUrl(APP_IDS.HAUPT_PROMPT, selectedPrompt.record_id) }
              : undefined
        }
        haupt_promptList={hauptPrompt}
        enablePhotoScan={AI_PHOTO_SCAN['Nachbesserung']}
      />

      <ConfirmDialog
        open={!!deletePromptTarget}
        title="Prompt löschen"
        description={`"${deletePromptTarget?.fields.name ?? 'Dieser Prompt'}" wird dauerhaft gelöscht.`}
        onConfirm={handleDeletePrompt}
        onClose={() => setDeletePromptTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteNbTarget}
        title="Nachbesserung löschen"
        description="Diese Nachbesserung wird dauerhaft gelöscht."
        onConfirm={handleDeleteNb}
        onClose={() => setDeleteNbTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Erneut versuchen</Button>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichNachbesserung } from '@/lib/enrich';
import type { EnrichedNachbesserung } from '@/types/enriched';
import type { HauptPrompt } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HauptPromptDialog } from '@/components/dialogs/HauptPromptDialog';
import { NachbesserungDialog } from '@/components/dialogs/NachbesserungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle, IconPlus, IconPencil, IconTrash, IconCopy, IconCheck,
  IconFileText, IconSearch, IconArrowLeft, IconHistory, IconCircleCheck,
  IconLayoutList, IconRocket, IconChevronRight, IconEdit, IconSend,
} from '@tabler/icons-react';

const STATUS_COLORS: Record<string, string> = {
  aktiv: 'bg-emerald-100 text-emerald-700',
  entwurf: 'bg-amber-100 text-amber-700',
  archiviert: 'bg-gray-100 text-gray-500',
};

function StatusBadge({ status }: { status?: { key: string; label: string } | null }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[status.key] ?? 'bg-muted text-muted-foreground'}`}>
      {status.label}
    </span>
  );
}

const STATUS_OPTIONS = [
  { key: 'alle', label: 'Alle' },
  { key: 'aktiv', label: 'Aktiv' },
  { key: 'entwurf', label: 'Entwurf' },
  { key: 'archiviert', label: 'Archiviert' },
];

export default function DashboardOverview() {
  const {
    hauptPrompt, nachbesserung,
    hauptPromptMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedNachbesserung = enrichNachbesserung(nachbesserung, { hauptPromptMap });

  // UI state — ALL hooks before early returns
  const [selectedPrompt, setSelectedPrompt] = useState<HauptPrompt | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Prompt dialog state
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState<HauptPrompt | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<HauptPrompt | null>(null);

  // Nachbesserung dialog state
  const [nbDialogOpen, setNbDialogOpen] = useState(false);
  const [editNb, setEditNb] = useState<EnrichedNachbesserung | null>(null);
  const [deleteNb, setDeleteNb] = useState<EnrichedNachbesserung | null>(null);

  const filteredPrompts = useMemo(() => {
    return hauptPrompt.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        p.fields.name?.toLowerCase().includes(q) ||
        p.fields.prompt_id?.toLowerCase().includes(q) ||
        p.fields.zweck_kontext?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'alle' || p.fields.status?.key === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [hauptPrompt, searchQuery, statusFilter]);

  const promptNachbesserungen = useMemo(() => {
    if (!selectedPrompt) return [];
    return enrichedNachbesserung.filter(nb =>
      nb.fields.haupt_prompt_link?.includes(selectedPrompt.record_id)
    );
  }, [enrichedNachbesserung, selectedPrompt]);

  const stats = useMemo(() => ({
    total: hauptPrompt.length,
    aktiv: hauptPrompt.filter(p => p.fields.status?.key === 'aktiv').length,
    entwurf: hauptPrompt.filter(p => p.fields.status?.key === 'entwurf').length,
    nbTotal: nachbesserung.length,
  }), [hauptPrompt, nachbesserung]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSelectPrompt = (p: HauptPrompt) => {
    setSelectedPrompt(p);
    setShowDetail(true);
  };

  const handleOpenCreatePrompt = () => {
    setEditPrompt(null);
    setPromptDialogOpen(true);
  };

  const handleOpenEditPrompt = (p: HauptPrompt) => {
    setEditPrompt(p);
    setPromptDialogOpen(true);
  };

  const handleDeletePrompt = async () => {
    if (!deletePrompt) return;
    await LivingAppsService.deleteHauptPromptEntry(deletePrompt.record_id);
    if (selectedPrompt?.record_id === deletePrompt.record_id) {
      setSelectedPrompt(null);
      setShowDetail(false);
    }
    setDeletePrompt(null);
    fetchAll();
  };

  const handleOpenCreateNb = () => {
    setEditNb(null);
    setNbDialogOpen(true);
  };

  const handleOpenEditNb = (nb: EnrichedNachbesserung) => {
    setEditNb(nb);
    setNbDialogOpen(true);
  };

  const handleDeleteNb = async () => {
    if (!deleteNb) return;
    await LivingAppsService.deleteNachbesserungEntry(deleteNb.record_id);
    setDeleteNb(null);
    fetchAll();
  };

  const nbDefaultValues = editNb
    ? editNb.fields
    : selectedPrompt
      ? { haupt_prompt_link: createRecordUrl(APP_IDS.HAUPT_PROMPT, selectedPrompt.record_id) }
      : undefined;

  return (
    <div className="space-y-5">
      {/* Workflow Navigation */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <IconRocket size={18} className="text-primary shrink-0" />
          <h2 className="font-semibold text-base text-foreground">Workflows</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="#/intents/prompt-entwickeln"
            className="flex items-center gap-3 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconEdit size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">Prompt entwickeln</p>
              <p className="text-xs text-muted-foreground line-clamp-1">Revisionen hinzufügen &amp; Prompt finalisieren</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
          </a>
          <a
            href="#/intents/prompt-versenden"
            className="flex items-center gap-3 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconSend size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">Prompt versenden</p>
              <p className="text-xs text-muted-foreground line-clamp-1">Fertigen Prompt prüfen &amp; per E-Mail versenden</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
          </a>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Prompts"
          value={String(stats.total)}
          description="Gesamt"
          icon={<IconFileText size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Aktiv"
          value={String(stats.aktiv)}
          description="Prompts in Betrieb"
          icon={<IconCircleCheck size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Entwürfe"
          value={String(stats.entwurf)}
          description="In Bearbeitung"
          icon={<IconPencil size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Nachbesserungen"
          value={String(stats.nbTotal)}
          description="Revisionen gesamt"
          icon={<IconHistory size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Main Workspace */}
      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: '560px' }}>
        {/* Left: Prompt List */}
        <div className={`lg:w-80 lg:shrink-0 flex flex-col ${showDetail ? 'hidden lg:flex' : 'flex'}`}>
          <div className="rounded-2xl border bg-card overflow-hidden flex flex-col flex-1">
            {/* List Header */}
            <div className="px-4 pt-4 pb-3 border-b space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-foreground">Meine Prompts</h2>
                <Button size="sm" onClick={handleOpenCreatePrompt} className="h-8 gap-1">
                  <IconPlus size={14} className="shrink-0" />
                  <span className="hidden sm:inline">Neu</span>
                </Button>
              </div>
              <div className="relative">
                <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Suchen…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setStatusFilter(opt.key)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      statusFilter === opt.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List Items */}
            <div className="flex-1 overflow-y-auto divide-y">
              {filteredPrompts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                  <IconLayoutList size={32} stroke={1.5} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || statusFilter !== 'alle' ? 'Keine Prompts gefunden' : 'Noch keine Prompts vorhanden'}
                  </p>
                  {!searchQuery && statusFilter === 'alle' && (
                    <Button size="sm" variant="outline" onClick={handleOpenCreatePrompt} className="mt-1">
                      <IconPlus size={14} className="shrink-0 mr-1" /> Ersten Prompt erstellen
                    </Button>
                  )}
                </div>
              ) : (
                filteredPrompts.map(p => (
                  <button
                    key={p.record_id}
                    onClick={() => handleSelectPrompt(p)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-accent/50 focus:outline-none ${
                      selectedPrompt?.record_id === p.record_id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.fields.prompt_id && (
                            <span className="text-xs font-mono text-muted-foreground shrink-0">{p.fields.prompt_id}</span>
                          )}
                          <StatusBadge status={p.fields.status} />
                        </div>
                        <p className="font-medium text-sm text-foreground truncate mt-0.5">
                          {p.fields.name ?? 'Kein Name'}
                        </p>
                        {p.fields.zweck_kontext && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {p.fields.zweck_kontext}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className={`flex-1 min-w-0 flex flex-col ${!showDetail && !selectedPrompt ? 'hidden lg:flex' : 'flex'}`}>
          {selectedPrompt ? (
            <div className="rounded-2xl border bg-card overflow-hidden flex flex-col flex-1">
              {/* Detail Header */}
              <div className="px-4 pt-4 pb-3 border-b">
                <div className="flex items-start gap-2 flex-wrap">
                  {/* Back button (mobile) */}
                  <button
                    onClick={() => setShowDetail(false)}
                    className="lg:hidden p-1 -ml-1 rounded-lg hover:bg-accent text-muted-foreground shrink-0"
                  >
                    <IconArrowLeft size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={selectedPrompt.fields.status} />
                      {selectedPrompt.fields.prompt_id && (
                        <span className="text-xs font-mono text-muted-foreground">{selectedPrompt.fields.prompt_id}</span>
                      )}
                    </div>
                    <h2 className="font-semibold text-base text-foreground mt-0.5 truncate">
                      {selectedPrompt.fields.name ?? 'Kein Name'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleOpenEditPrompt(selectedPrompt)}>
                      <IconPencil size={14} />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeletePrompt(selectedPrompt)}>
                      <IconTrash size={14} />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  {selectedPrompt.fields.erstellt_am && (
                    <span>Erstellt: {formatDate(selectedPrompt.fields.erstellt_am)}</span>
                  )}
                  {selectedPrompt.fields.zuletzt_geaendert && (
                    <span>Geändert: {formatDate(selectedPrompt.fields.zuletzt_geaendert)}</span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Kontext */}
                {selectedPrompt.fields.zweck_kontext && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Zweck &amp; Kontext</p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedPrompt.fields.zweck_kontext}
                    </p>
                  </div>
                )}

                {/* Prompt Text */}
                {selectedPrompt.fields.prompt_text && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prompt-Text</p>
                      <button
                        onClick={() => handleCopy(selectedPrompt.fields.prompt_text!, `pt-${selectedPrompt.record_id}`)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent"
                      >
                        {copiedId === `pt-${selectedPrompt.record_id}` ? (
                          <><IconCheck size={12} className="shrink-0" /> Kopiert</>
                        ) : (
                          <><IconCopy size={12} className="shrink-0" /> Kopieren</>
                        )}
                      </button>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-sm font-mono whitespace-pre-wrap break-words text-foreground leading-relaxed max-h-48 overflow-y-auto">
                      {selectedPrompt.fields.prompt_text}
                    </div>
                  </div>
                )}

                {/* Vollständiger Prompt */}
                {selectedPrompt.fields.vollstaendiger_prompt && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vollständiger Prompt</p>
                      <button
                        onClick={() => handleCopy(selectedPrompt.fields.vollstaendiger_prompt!, `vp-${selectedPrompt.record_id}`)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent"
                      >
                        {copiedId === `vp-${selectedPrompt.record_id}` ? (
                          <><IconCheck size={12} className="shrink-0" /> Kopiert</>
                        ) : (
                          <><IconCopy size={12} className="shrink-0" /> Kopieren</>
                        )}
                      </button>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm font-mono whitespace-pre-wrap break-words text-foreground leading-relaxed max-h-48 overflow-y-auto">
                      {selectedPrompt.fields.vollstaendiger_prompt}
                    </div>
                  </div>
                )}

                {/* Nachbesserungen */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <IconHistory size={12} className="shrink-0" />
                      Nachbesserungen ({promptNachbesserungen.length})
                    </p>
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={handleOpenCreateNb}>
                      <IconPlus size={12} className="shrink-0" /> Hinzufügen
                    </Button>
                  </div>

                  {promptNachbesserungen.length === 0 ? (
                    <div className="text-center py-6 rounded-xl border border-dashed">
                      <p className="text-xs text-muted-foreground">Noch keine Nachbesserungen</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {promptNachbesserungen.map(nb => (
                        <div key={nb.record_id} className="rounded-xl border bg-background p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {nb.fields.versionsnummer && (
                                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    v{nb.fields.versionsnummer}
                                  </span>
                                )}
                                {nb.fields.erstellt_am_nb && (
                                  <span className="text-xs text-muted-foreground">{formatDate(nb.fields.erstellt_am_nb)}</span>
                                )}
                              </div>
                              {nb.fields.nachbesserungs_text && (
                                <p className="text-sm text-foreground line-clamp-2 leading-snug">
                                  {nb.fields.nachbesserungs_text}
                                </p>
                              )}
                              {nb.fields.aenderungsnotiz && (
                                <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
                                  {nb.fields.aenderungsnotiz}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleOpenEditNb(nb)}
                                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <IconPencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteNb(nb)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <IconTrash size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 rounded-2xl border bg-card flex flex-col items-center justify-center gap-3 py-20">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <IconFileText size={28} stroke={1.5} className="text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Prompt auswählen</p>
                <p className="text-sm text-muted-foreground mt-0.5">Wähle einen Prompt aus der Liste aus</p>
              </div>
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
        enablePhotoLocation={AI_PHOTO_LOCATION['HauptPrompt']}
      />

      <NachbesserungDialog
        open={nbDialogOpen}
        onClose={() => { setNbDialogOpen(false); setEditNb(null); }}
        onSubmit={async (fields) => {
          if (editNb) {
            await LivingAppsService.updateNachbesserungEntry(editNb.record_id, fields);
          } else {
            await LivingAppsService.createNachbesserungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={nbDefaultValues}
        haupt_promptList={hauptPrompt}
        enablePhotoScan={AI_PHOTO_SCAN['Nachbesserung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Nachbesserung']}
      />

      <ConfirmDialog
        open={!!deletePrompt}
        title="Prompt löschen"
        description={`„${deletePrompt?.fields.name ?? 'Dieser Prompt'}" wird dauerhaft gelöscht.`}
        onConfirm={handleDeletePrompt}
        onClose={() => setDeletePrompt(null)}
      />

      <ConfirmDialog
        open={!!deleteNb}
        title="Nachbesserung löschen"
        description="Diese Nachbesserung wird dauerhaft gelöscht."
        onConfirm={handleDeleteNb}
        onClose={() => setDeleteNb(null)}
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

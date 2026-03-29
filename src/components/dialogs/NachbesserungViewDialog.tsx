import type { Nachbesserung, HauptPrompt } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface NachbesserungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Nachbesserung | null;
  onEdit: (record: Nachbesserung) => void;
  haupt_promptList: HauptPrompt[];
}

export function NachbesserungViewDialog({ open, onClose, record, onEdit, haupt_promptList }: NachbesserungViewDialogProps) {
  function getHauptPromptDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return haupt_promptList.find(r => r.record_id === id)?.fields.prompt_id ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nachbesserung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verknüpfter Haupt-Prompt</Label>
            <p className="text-sm">{getHauptPromptDisplayName(record.fields.haupt_prompt_link)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Versionsnummer</Label>
            <p className="text-sm">{record.fields.versionsnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachbesserungs-Text</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.nachbesserungs_text ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Änderungsnotiz</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.aenderungsnotiz ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Erstellt am</Label>
            <p className="text-sm">{formatDate(record.fields.erstellt_am_nb)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
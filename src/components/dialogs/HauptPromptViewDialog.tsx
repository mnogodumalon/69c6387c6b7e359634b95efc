import type { HauptPrompt } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface HauptPromptViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: HauptPrompt | null;
  onEdit: (record: HauptPrompt) => void;
}

export function HauptPromptViewDialog({ open, onClose, record, onEdit }: HauptPromptViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Haupt-Prompt anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ID</Label>
            <p className="text-sm">{record.fields.prompt_id ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <p className="text-sm">{record.fields.name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zweck / Kontext</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.zweck_kontext ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prompt-Text</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.prompt_text ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="secondary">{record.fields.status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Erstellt am</Label>
            <p className="text-sm">{formatDate(record.fields.erstellt_am)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zuletzt geändert</Label>
            <p className="text-sm">{formatDate(record.fields.zuletzt_geaendert)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vollständiger Prompt (zusammengeführt)</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.vollstaendiger_prompt ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prompt per E-Mail versenden</Label>
            <Badge variant="secondary">{record.fields.prompt_email_action?.label ?? '—'}</Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
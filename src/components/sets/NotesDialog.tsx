import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  setName: string;
  initialNotes: string | null;
  onSuccess: () => void;
}

export function NotesDialog({
  open,
  onOpenChange,
  setId,
  setName,
  initialNotes,
  onSuccess,
}: NotesDialogProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    const { error } = await supabase
      .from("sets")
      .update({ notes: notes.trim() || null })
      .eq("id", setId);

    if (error) {
      toast.error("Failed to save notes");
      setSaving(false);
      return;
    }

    toast.success("Notes saved");
    setSaving(false);
    onSuccess();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Notes - {setName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this set..."
            rows={12}
            className="resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

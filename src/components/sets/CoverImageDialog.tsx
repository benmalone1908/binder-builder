import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CoverImageInput } from "@/components/shared/CoverImageInput";

type SetRow = Tables<"library_sets">;

interface CoverImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  set: SetRow | null;
  onSuccess: () => void;
}

export function CoverImageDialog({ open, onOpenChange, set, onSuccess }: CoverImageDialogProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (set) {
      setImageUrl(set.cover_image_url || "");
    }
  }, [set, open]);

  async function handleSave() {
    if (!set) return;

    setSaving(true);
    const { error } = await supabase
      .from("library_sets")
      .update({ cover_image_url: imageUrl || null })
      .eq("id", set.id);

    if (error) {
      toast.error("Failed to update cover image");
      setSaving(false);
      return;
    }

    toast.success("Cover image updated");
    setSaving(false);
    onOpenChange(false);
    onSuccess();
  }

  if (!set) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {set.cover_image_url ? "Edit Cover Image" : "Add Cover Image"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <CoverImageInput
            value={imageUrl}
            onChange={setImageUrl}
            setId={set.id}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

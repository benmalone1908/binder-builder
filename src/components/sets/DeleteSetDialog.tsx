import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SetRow = Tables<"sets">;

interface DeleteSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  set: SetRow | null;
  onSuccess: () => void;
}

export function DeleteSetDialog({ open, onOpenChange, set, onSuccess }: DeleteSetDialogProps) {
  async function handleDelete() {
    if (!set) return;

    const { error } = await supabase.from("sets").delete().eq("id", set.id);

    if (error) {
      toast.error("Failed to delete set: " + error.message);
      return;
    }

    toast.success(`"${set.name}" deleted`);
    onOpenChange(false);
    onSuccess();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Set</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{set?.name}"? This will also delete all
            checklist items in this set. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

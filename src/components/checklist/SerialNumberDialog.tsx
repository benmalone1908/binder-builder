import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SerialNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  parallel: string | null;
  printRun: string | null;
  onSuccess: () => void;
}

export function SerialNumberDialog({
  open,
  onOpenChange,
  itemId,
  parallel,
  printRun,
  onSuccess,
}: SerialNumberDialogProps) {
  const [serialNumber, setSerialNumber] = useState("");

  useEffect(() => {
    if (!open) {
      setSerialNumber("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase
      .from("library_checklist_items")
      .update({
        status: "owned",
        serial_owned: serialNumber.trim() || null,
      })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to update: " + error.message);
      return;
    }

    toast.success("Card marked as owned");
    onOpenChange(false);
    onSuccess();
  }

  function handleSkip() {
    // Mark as owned without serial number
    supabase
      .from("library_checklist_items")
      .update({ status: "owned" })
      .eq("id", itemId)
      .then(({ error }) => {
        if (error) {
          toast.error("Failed to update: " + error.message);
          return;
        }
        toast.success("Card marked as owned");
        onOpenChange(false);
        onSuccess();
      });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {parallel || "Card"} {printRun && `/${printRun}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serial">Which serial number did you get?</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="serial"
                type="text"
                placeholder="e.g., 17"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <span className="text-muted-foreground">/{printRun}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

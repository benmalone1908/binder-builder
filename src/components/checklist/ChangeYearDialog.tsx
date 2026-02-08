import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChangeYearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (year: number) => void;
}

export function ChangeYearDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: ChangeYearDialogProps) {
  const [yearValue, setYearValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const year = parseInt(yearValue, 10);
    if (isNaN(year) || year < 1900 || year > 2100) return;
    onConfirm(year);
    setYearValue("");
    onOpenChange(false);
  }

  function handleClose(open: boolean) {
    if (!open) {
      setYearValue("");
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Year</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Update the year for {selectedCount} selected card{selectedCount !== 1 ? "s" : ""}.
            </p>
            <div className="space-y-2">
              <Label htmlFor="year">New Year</Label>
              <Input
                id="year"
                type="number"
                placeholder="e.g. 2024"
                value={yearValue}
                onChange={(e) => setYearValue(e.target.value)}
                min={1900}
                max={2100}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!yearValue}>
              Update Year
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

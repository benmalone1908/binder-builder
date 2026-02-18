import { useState } from "react";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddParallelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  cardNumber: string;
  playerName: string;
  team: string | null;
  onSuccess: () => void;
}

interface FormData {
  parallel: string;
  parallel_print_run: string;
  serial_owned: string;
  status: string;
}

export function AddParallelDialog({
  open,
  onOpenChange,
  setId,
  cardNumber,
  playerName,
  team,
  onSuccess,
}: AddParallelDialogProps) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: {
      parallel: "",
      parallel_print_run: "",
      serial_owned: "",
      status: "need",
    },
  });

  const status = watch("status");

  async function onSubmit(data: FormData) {
    const { error } = await supabase
      .from("library_checklist_items")
      .insert({
        library_set_id: setId,
        card_number: cardNumber,
        player_name: playerName,
        team: team,
        year: null,
        parallel: data.parallel.trim() || null,
        parallel_print_run: data.parallel_print_run.trim() || null,
        serial_owned: data.serial_owned.trim() || null,
        status: data.status as "need" | "pending" | "owned",
      });

    if (error) {
      toast.error("Failed to add: " + error.message);
      return;
    }

    toast.success("Parallel added");
    reset();
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Add Parallel</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {cardNumber} - {playerName} {team && `• ${team}`}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parallel *</Label>
              <Input {...register("parallel", { required: true })} placeholder="e.g. Gold, Refractor" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setValue("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="need">Need</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="owned">Have</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Print Run</Label>
              <Input {...register("parallel_print_run")} placeholder='e.g. "50" for /50' />
            </div>
            <div className="space-y-2">
              <Label>Serial # Owned</Label>
              <Input {...register("serial_owned")} placeholder='e.g. "17" for 17/50' />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Parallel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ChecklistItem = Tables<"checklist_items">;

interface EditChecklistItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ChecklistItem | null;
  isMultiYear?: boolean;
  onSuccess: () => void;
}

interface FormData {
  card_number: string;
  player_name: string;
  team: string;
  subset_name: string;
  parallel: string;
  parallel_print_run: string;
  serial_owned: string;
  status: string;
  year: string;
}

export function EditChecklistItemDialog({
  open,
  onOpenChange,
  item,
  isMultiYear,
  onSuccess,
}: EditChecklistItemDialogProps) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>();

  const status = watch("status");

  useEffect(() => {
    if (item) {
      reset({
        card_number: item.card_number,
        player_name: item.player_name,
        team: item.team || "",
        subset_name: item.subset_name || "",
        parallel: item.parallel || "",
        parallel_print_run: item.parallel_print_run || "",
        serial_owned: item.serial_owned || "",
        status: item.status,
        year: item.year ? String(item.year) : "",
      });
    }
  }, [item, open]);

  async function onSubmit(data: FormData) {
    if (!item) return;

    const { error } = await supabase
      .from("library_checklist_items")
      .update({
        card_number: data.card_number,
        player_name: data.player_name,
        team: data.team || null,
        subset_name: data.subset_name || null,
        parallel: data.parallel || null,
        parallel_print_run: data.parallel_print_run || null,
        serial_owned: data.serial_owned || null,
        status: data.status as "need" | "pending" | "owned",
        year: data.year ? parseInt(data.year, 10) : null,
      })
      .eq("id", item.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
      return;
    }

    toast.success("Card updated");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className={`grid gap-4 ${isMultiYear ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="space-y-2">
              <Label>Card #</Label>
              <Input {...register("card_number")} />
            </div>
            {isMultiYear && (
              <div className="space-y-2">
                <Label>Year</Label>
                <Input {...register("year")} type="number" placeholder="e.g. 2024" />
              </div>
            )}
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

          <div className="space-y-2">
            <Label>Player Name</Label>
            <Input {...register("player_name")} />
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <Input {...register("team")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Subset</Label>
              <Input {...register("subset_name")} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Parallel</Label>
              <Input {...register("parallel")} placeholder='e.g. "Gold", "Refractor"' />
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
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

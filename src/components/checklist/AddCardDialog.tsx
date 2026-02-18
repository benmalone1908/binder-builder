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

interface AddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  isMultiYear?: boolean;
  onSuccess: () => void;
}

interface FormData {
  card_number: string;
  player_name: string;
  team: string;
  year: string;
  status: string;
}

export function AddCardDialog({
  open,
  onOpenChange,
  setId,
  isMultiYear,
  onSuccess,
}: AddCardDialogProps) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: {
      card_number: "",
      player_name: "",
      team: "",
      year: "",
      status: "need",
    },
  });

  const status = watch("status");

  async function onSubmit(data: FormData) {
    const { error } = await supabase
      .from("library_checklist_items")
      .insert({
        library_set_id: setId,
        card_number: data.card_number.trim(),
        player_name: data.player_name.trim(),
        team: data.team.trim() || null,
        subset_name: null,
        year: data.year ? parseInt(data.year, 10) : null,
        parallel: null,
        parallel_print_run: null,
        serial_owned: null,
        status: data.status as "need" | "pending" | "owned",
      });

    if (error) {
      toast.error("Failed to add card: " + error.message);
      return;
    }

    toast.success("Card added");
    reset();
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className={`grid gap-4 ${isMultiYear ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="space-y-2">
              <Label>Card # *</Label>
              <Input {...register("card_number", { required: true })} placeholder="e.g. 1" />
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
            <Label>Player Name *</Label>
            <Input {...register("player_name", { required: true })} placeholder="e.g. Aaron Judge" />
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <Input {...register("team")} placeholder="e.g. NYY" />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Card</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

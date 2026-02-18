import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

type SetRow = Tables<"sets">;

interface Collection {
  id: string;
  name: string;
}

interface CollectionSetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: Collection | null;
  onSuccess: () => void;
}

export function CollectionSetsDialog({
  open,
  onOpenChange,
  collection,
  onSuccess,
}: CollectionSetsDialogProps) {
  const [sets, setSets] = useState<SetRow[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (open && collection) {
      loadData();
    }
  }, [open, collection]);

  async function loadData() {
    if (!collection) return;
    setLoading(true);

    const [setsResult, assignmentsResult] = await Promise.all([
      supabase.from("library_sets").select("*").order("year", { ascending: false }),
      supabase
        .from("user_collection_sets")
        .select("library_set_id")
        .eq("user_collection_id", collection.id),
    ]);

    if (setsResult.data) {
      setSets(setsResult.data);
    }

    if (assignmentsResult.data) {
      setSelectedSetIds(new Set(assignmentsResult.data.map((a) => a.library_set_id)));
    }

    setLoading(false);
  }

  function handleToggle(setId: string) {
    setSelectedSetIds((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) {
        next.delete(setId);
      } else {
        next.add(setId);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!collection) return;
    setSaving(true);

    // Delete all existing assignments for this collection
    await supabase
      .from("user_collection_sets")
      .delete()
      .eq("user_collection_id", collection.id);

    // Insert new assignments
    if (selectedSetIds.size > 0) {
      const assignments = Array.from(selectedSetIds).map((setId) => ({
        library_set_id: setId,
        user_collection_id: collection.id,
      }));
      const { error } = await supabase.from("user_collection_sets").insert(assignments);

      if (error) {
        toast.error("Failed to save: " + error.message);
        setSaving(false);
        return;
      }
    }

    toast.success(`Updated sets in "${collection.name}"`);
    setSaving(false);
    onOpenChange(false);
    onSuccess();
  }

  const selectedSets = sets.filter((s) => selectedSetIds.has(s.id));

  if (!collection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Sets in "{collection.name}"</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground py-4">Loading...</p>
        ) : (
          <div className="space-y-4">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between"
                >
                  Add sets to collection...
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search sets..." />
                  <CommandList>
                    <CommandEmpty>No sets found.</CommandEmpty>
                    <CommandGroup>
                      {sets.map((set) => (
                        <CommandItem
                          key={set.id}
                          value={`${set.name} ${set.year} ${set.brand}`}
                          onSelect={() => handleToggle(set.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSetIds.has(set.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{set.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {set.year} · {set.brand} · {set.product_line}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Sets in this collection ({selectedSets.length})
              </p>
              {selectedSets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No sets assigned yet. Use the dropdown above to add sets.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {selectedSets.map((set) => (
                    <Badge
                      key={set.id}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleToggle(set.id)}
                    >
                      {set.name} ({set.year})
                      <span className="ml-1 text-xs">×</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

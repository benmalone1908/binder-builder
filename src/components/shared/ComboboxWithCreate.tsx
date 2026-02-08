import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReferenceItem {
  id: string;
  name: string;
}

type TableName = "brands" | "product_lines" | "insert_sets";

interface ComboboxWithCreateProps {
  table: TableName;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const TABLE_LABELS: Record<TableName, string> = {
  brands: "Brand",
  product_lines: "Product Line",
  insert_sets: "Insert Set",
};

export function ComboboxWithCreate({
  table,
  value,
  onChange,
  placeholder,
}: ComboboxWithCreateProps) {
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const label = TABLE_LABELS[table];

  async function loadItems() {
    const { data, error } = await supabase
      .from(table)
      .select("id, name")
      .order("name");

    if (error) {
      console.error(`Failed to load ${table}:`, error);
      return;
    }

    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, [table]);

  function handleValueChange(val: string) {
    if (val === "__create_new__") {
      setDialogOpen(true);
    } else {
      onChange(val);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }

    setCreating(true);

    const { data, error } = await supabase
      .from(table)
      .insert({ name: newName.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error(`${label} "${newName}" already exists`);
      } else {
        toast.error(`Failed to create ${label.toLowerCase()}`);
      }
      setCreating(false);
      return;
    }

    toast.success(`${label} created`);
    setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setDialogOpen(false);
    setCreating(false);
    // Use setTimeout to ensure the Select re-renders with the new item before we set the value
    setTimeout(() => {
      onChange(data.name);
    }, 0);
  }

  // Find the display name for the current value
  const displayValue = items.find((item) => item.name === value)?.name || value;

  return (
    <>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`}>
            {value ? displayValue : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <SelectItem value="__loading__" disabled>
              Loading...
            </SelectItem>
          ) : (
            <>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.name}>
                  {item.name}
                </SelectItem>
              ))}
              <SelectItem
                value="__create_new__"
                className="text-primary font-medium"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-3 w-3" />
                  Add New {label}
                </span>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New {label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Enter ${label.toLowerCase()} name`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setNewName("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";

interface ReferenceItem {
  id: string;
  name: string;
  created_at: string;
}

type TableName = "brands" | "product_lines" | "insert_sets" | "collections";

interface ReferenceDataTabProps {
  table: TableName;
  title: string;
}

export function ReferenceDataTab({ table, title }: ReferenceDataTabProps) {
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReferenceItem | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ReferenceItem | null>(null);

  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("name");

    if (error) {
      toast.error(`Failed to load ${title.toLowerCase()}`);
      console.error(error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, [table]);

  function openAddDialog() {
    setEditingItem(null);
    setName("");
    setDialogOpen(true);
  }

  function openEditDialog(item: ReferenceItem) {
    setEditingItem(item);
    setName(item.name);
    setDialogOpen(true);
  }

  function openDeleteDialog(item: ReferenceItem) {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);

    if (editingItem) {
      const { error } = await supabase
        .from(table)
        .update({ name: name.trim() })
        .eq("id", editingItem.id);

      if (error) {
        if (error.code === "23505") {
          toast.error(`"${name}" already exists`);
        } else {
          toast.error("Failed to update");
        }
        setSaving(false);
        return;
      }

      toast.success(`${title.slice(0, -1)} updated`);
    } else {
      const { error } = await supabase
        .from(table)
        .insert({ name: name.trim() });

      if (error) {
        if (error.code === "23505") {
          toast.error(`"${name}" already exists`);
        } else {
          toast.error("Failed to create");
        }
        setSaving(false);
        return;
      }

      toast.success(`${title.slice(0, -1)} created`);
    }

    setDialogOpen(false);
    setName("");
    setEditingItem(null);
    setSaving(false);
    loadItems();
  }

  async function handleDelete() {
    if (!deletingItem) return;

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", deletingItem.id);

    if (error) {
      toast.error("Failed to delete");
      console.error(error);
    } else {
      toast.success(`${title.slice(0, -1)} deleted`);
      loadItems();
    }

    setDeleteDialogOpen(false);
    setDeletingItem(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage {title.toLowerCase()} that appear in dropdown menus when creating sets.
        </p>
        <Button onClick={openAddDialog} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add {title.slice(0, -1)}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground py-8 text-center">Loading...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-4">
            No {title.toLowerCase()} yet.
          </p>
          <Button onClick={openAddDialog} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add First {title.slice(0, -1)}
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Edit ${title.slice(0, -1)}` : `Add ${title.slice(0, -1)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Enter ${title.slice(0, -1).toLowerCase()} name`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title.slice(0, -1)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingItem?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

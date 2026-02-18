import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { CollectionSetsDialog } from "./CollectionSetsDialog";

interface Collection {
  id: string;
  name: string;
  created_at: string;
}

interface CollectionWithCount extends Collection {
  setCount: number;
}

export function CollectionsTab() {
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);

  const [setsDialogOpen, setSetsDialogOpen] = useState(false);
  const [managingCollection, setManagingCollection] = useState<Collection | null>(null);

  async function loadCollections() {
    setLoading(true);

    const [collectionsResult, countsResult] = await Promise.all([
      supabase.from("user_collections").select("*").order("name"),
      supabase.from("user_collection_sets").select("user_collection_id"),
    ]);

    if (collectionsResult.error) {
      toast.error("Failed to load collections");
      console.error(collectionsResult.error);
      setLoading(false);
      return;
    }

    // Count sets per collection
    const countMap = new Map<string, number>();
    if (countsResult.data) {
      for (const row of countsResult.data) {
        countMap.set(row.user_collection_id, (countMap.get(row.user_collection_id) || 0) + 1);
      }
    }

    const collectionsWithCounts = (collectionsResult.data || []).map((c) => ({
      ...c,
      setCount: countMap.get(c.id) || 0,
    }));

    setCollections(collectionsWithCounts);
    setLoading(false);
  }

  useEffect(() => {
    loadCollections();
  }, []);

  function openAddDialog() {
    setEditingCollection(null);
    setName("");
    setDialogOpen(true);
  }

  function openEditDialog(collection: Collection) {
    setEditingCollection(collection);
    setName(collection.name);
    setDialogOpen(true);
  }

  function openDeleteDialog(collection: Collection) {
    setDeletingCollection(collection);
    setDeleteDialogOpen(true);
  }

  function openSetsDialog(collection: Collection) {
    setManagingCollection(collection);
    setSetsDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);

    if (editingCollection) {
      const { error } = await supabase
        .from("user_collections")
        .update({ name: name.trim() })
        .eq("id", editingCollection.id);

      if (error) {
        if (error.code === "23505") {
          toast.error(`"${name}" already exists`);
        } else {
          toast.error("Failed to update");
        }
        setSaving(false);
        return;
      }

      toast.success("Collection updated");
    } else {
      const { error } = await supabase
        .from("user_collections")
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

      toast.success("Collection created");
    }

    setDialogOpen(false);
    setName("");
    setEditingCollection(null);
    setSaving(false);
    loadCollections();
  }

  async function handleDelete() {
    if (!deletingCollection) return;

    const { error } = await supabase
      .from("user_collections")
      .delete()
      .eq("id", deletingCollection.id);

    if (error) {
      toast.error("Failed to delete");
      console.error(error);
    } else {
      toast.success("Collection deleted");
      loadCollections();
    }

    setDeleteDialogOpen(false);
    setDeletingCollection(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage collections to group related sets together.
        </p>
        <Button onClick={openAddDialog} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Collection
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground py-8 text-center">Loading...</p>
      ) : collections.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-4">No collections yet.</p>
          <Button onClick={openAddDialog} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add First Collection
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Sets</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((collection) => (
                <TableRow key={collection.id}>
                  <TableCell className="font-medium">{collection.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{collection.setCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openSetsDialog(collection)}
                        title="Manage Sets"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(collection)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(collection)}
                        title="Delete"
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
              {editingCollection ? "Edit Collection" : "Add Collection"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter collection name"
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
            <AlertDialogTitle>Delete Collection?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCollection?.name}"? Sets in this
              collection will not be deleted, only the collection grouping.
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

      <CollectionSetsDialog
        open={setsDialogOpen}
        onOpenChange={setSetsDialogOpen}
        collection={managingCollection}
        onSuccess={loadCollections}
      />
    </div>
  );
}

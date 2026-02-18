import { useState, useEffect } from "react";
import { Plus, X, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Collection {
  id: string;
  name: string;
}

interface CollectionMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function CollectionMultiSelect({
  value,
  onChange,
  placeholder = "Select collections...",
}: CollectionMultiSelectProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadCollections() {
    const { data, error } = await supabase
      .from("user_collections")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Failed to load collections:", error);
      return;
    }

    setCollections(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadCollections();
  }, []);

  function handleToggle(collectionId: string) {
    if (value.includes(collectionId)) {
      onChange(value.filter((id) => id !== collectionId));
    } else {
      onChange([...value, collectionId]);
    }
  }

  function handleRemove(collectionId: string) {
    onChange(value.filter((id) => id !== collectionId));
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }

    setCreating(true);

    const { data, error } = await supabase
      .from("user_collections")
      .insert({ name: newName.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error(`Collection "${newName}" already exists`);
      } else {
        toast.error("Failed to create collection");
      }
      setCreating(false);
      return;
    }

    toast.success("Collection created");
    setCollections((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    );
    onChange([...value, data.id]);
    setNewName("");
    setDialogOpen(false);
    setCreating(false);
  }

  const selectedCollections = collections.filter((c) => value.includes(c.id));

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10"
          >
            <div className="flex flex-wrap gap-1">
              {selectedCollections.length > 0 ? (
                selectedCollections.map((collection) => (
                  <Badge
                    key={collection.id}
                    variant="secondary"
                    className="mr-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(collection.id);
                    }}
                  >
                    {collection.name}
                    <X className="ml-1 h-3 w-3 cursor-pointer" />
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search collections..." />
            <CommandList>
              {loading ? (
                <CommandEmpty>Loading...</CommandEmpty>
              ) : (
                <>
                  <CommandEmpty>No collection found.</CommandEmpty>
                  <CommandGroup>
                    {collections.map((collection) => (
                      <CommandItem
                        key={collection.id}
                        value={collection.name}
                        onSelect={() => handleToggle(collection.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value.includes(collection.id)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {collection.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        setDialogOpen(true);
                      }}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add New Collection
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-collection-name">Name</Label>
              <Input
                id="new-collection-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter collection name"
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

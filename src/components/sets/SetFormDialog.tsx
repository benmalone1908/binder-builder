import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setFormSchema, type SetFormValues } from "@/lib/schemas";
import type { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboboxWithCreate } from "@/components/shared/ComboboxWithCreate";
import { CoverImageInput } from "@/components/shared/CoverImageInput";
import { CollectionMultiSelect } from "@/components/shared/CollectionMultiSelect";

type SetRow = Tables<"sets">;

const SET_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  insert: "Insert",
  rainbow: "Rainbow",
  multi_year_insert: "Multi-Year Insert",
};

interface SetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  set?: SetRow | null;
  onSuccess: () => void;
}

export function SetFormDialog({ open, onOpenChange, set, onSuccess }: SetFormDialogProps) {
  const isEditing = !!set;
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  const form = useForm<SetFormValues>({
    resolver: zodResolver(setFormSchema),
    defaultValues: {
      name: "",
      year: new Date().getFullYear(),
      brand: "",
      product_line: "",
      set_type: "base",
      insert_set_name: "",
      cover_image_url: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (set) {
      form.reset({
        name: set.name,
        year: set.year,
        brand: set.brand,
        product_line: set.product_line,
        set_type: set.set_type,
        insert_set_name: set.insert_set_name || "",
        cover_image_url: set.cover_image_url || "",
        notes: set.notes || "",
      });
      // Load existing collection associations
      supabase
        .from("user_collection_sets")
        .select("user_collection_id")
        .eq("library_set_id", set.id)
        .then(({ data }) => {
          if (data) {
            setCollectionIds(data.map((sc) => sc.user_collection_id));
          }
        });
    } else {
      form.reset({
        name: "",
        year: new Date().getFullYear(),
        brand: "",
        product_line: "",
        set_type: "base",
        insert_set_name: "",
        cover_image_url: "",
        notes: "",
      });
      setCollectionIds([]);
    }
  }, [set, open]);

  const isMultiYear = form.watch("set_type") === "multi_year_insert";

  async function onSubmit(values: SetFormValues) {
    let setId: string;

    if (isEditing) {
      const { error } = await supabase
        .from("library_sets")
        .update(values)
        .eq("id", set!.id);

      if (error) {
        toast.error("Failed to update set: " + error.message);
        return;
      }
      setId = set!.id;

      // Update collection associations: delete existing and insert new
      await supabase.from("user_collection_sets").delete().eq("library_set_id", setId);
      toast.success("Set updated");
    } else {
      const { data, error } = await supabase
        .from("library_sets")
        .insert(values)
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Failed to create set: " + (error?.message || "Unknown error"));
        return;
      }
      setId = data.id;
      toast.success("Set created");
    }

    // Insert collection associations
    if (collectionIds.length > 0) {
      const associations = collectionIds.map((collectionId) => ({
        library_set_id: setId,
        user_collection_id: collectionId,
      }));
      await supabase.from("user_collection_sets").insert(associations);
    }

    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Set" : "New Set"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="2024 Topps Series 1 Base" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={isMultiYear ? "" : "grid grid-cols-2 gap-4"}>
              {!isMultiYear && (
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="set_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(SET_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <ComboboxWithCreate
                      table="brands"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select brand"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product_line"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Line</FormLabel>
                  <FormControl>
                    <ComboboxWithCreate
                      table="product_lines"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select product line"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(form.watch("set_type") === "insert" || form.watch("set_type") === "multi_year_insert") && (
              <FormField
                control={form.control}
                name="insert_set_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insert Set</FormLabel>
                    <FormControl>
                      <ComboboxWithCreate
                        table="insert_sets"
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Select insert set"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="cover_image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Image</FormLabel>
                  <FormControl>
                    <CoverImageInput
                      value={field.value || ""}
                      onChange={field.onChange}
                      setId={set?.id}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional notes..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Collections</label>
              <CollectionMultiSelect
                value={collectionIds}
                onChange={setCollectionIds}
                placeholder="Add to collections..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? "Save" : "Create"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

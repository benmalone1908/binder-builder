import { useState, useEffect, useMemo } from "react";
import { Plus, Check, Search, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SetDetailSheet } from "@/components/sets/SetDetailSheet";

type LibrarySet = Tables<"library_sets">;

const SET_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  insert: "Insert",
  rainbow: "Rainbow",
  multi_year_insert: "Multi-Year Insert",
};

export default function BrowseLibrary() {
  const { user } = useAuth();
  const [librarySets, setLibrarySets] = useState<LibrarySet[]>([]);
  const [userSetIds, setUserSetIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [previewSetId, setPreviewSetId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [setsResult, userSetsResult] = await Promise.all([
        supabase.from("library_sets").select("*").order("year", { ascending: false }),
        user
          ? supabase.from("user_sets").select("library_set_id").eq("user_id", user.id)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (setsResult.error) console.error("Library sets error:", setsResult.error);
      if (userSetsResult.error) console.error("User sets error:", userSetsResult.error);

      setLibrarySets(setsResult.data || []);
      setUserSetIds(new Set((userSetsResult.data || []).map((r) => r.library_set_id)));
    } catch (err) {
      console.error("loadData error:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [user]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    librarySets.forEach((s) => years.add(s.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [librarySets]);

  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    librarySets.forEach((s) => brands.add(s.brand));
    return Array.from(brands).sort();
  }, [librarySets]);

  const filtered = useMemo(() => {
    let result = librarySets;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.brand.toLowerCase().includes(term) ||
          s.product_line.toLowerCase().includes(term)
      );
    }

    if (yearFilter !== "all") {
      result = result.filter((s) => s.year === parseInt(yearFilter));
    }
    if (brandFilter !== "all") {
      result = result.filter((s) => s.brand === brandFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter((s) => s.set_type === typeFilter);
    }

    return result;
  }, [librarySets, searchTerm, yearFilter, brandFilter, typeFilter]);

  async function handleAddToCollection(librarySetId: string) {
    if (!user) return;
    setAdding(librarySetId);

    const { error } = await supabase.from("user_sets").insert({
      user_id: user.id,
      library_set_id: librarySetId,
    });

    if (error) {
      if (error.code === "23505") {
        toast.info("Set already in your collection");
      } else {
        toast.error("Failed to add set");
        console.error(error);
      }
    } else {
      setUserSetIds((prev) => new Set([...prev, librarySetId]));
      toast.success("Set added to your collection!");
    }

    setAdding(null);
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading library...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Browse Library</h1>
        <p className="text-sm text-muted-foreground">
          Explore the card set catalog and add sets to your collection.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {availableBrands.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="base">Base</SelectItem>
            <SelectItem value="insert">Insert</SelectItem>
            <SelectItem value="rainbow">Rainbow</SelectItem>
            <SelectItem value="multi_year_insert">Multi-Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} set{filtered.length !== 1 ? "s" : ""} found
      </p>

      {/* Set grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((set) => {
          const inCollection = userSetIds.has(set.id);
          const isAdding = adding === set.id;

          return (
            <div
              key={set.id}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-card"
            >
              {/* Cover image area */}
              <button
                type="button"
                className="w-full h-32 bg-muted flex items-center justify-center cursor-pointer"
                onClick={() => setPreviewSetId(set.id)}
              >
                {set.cover_image_url ? (
                  <img
                    src={set.cover_image_url}
                    alt={set.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageOff className="w-8 h-8 text-muted-foreground/30" />
                )}
              </button>

              {/* Set info */}
              <div className="p-3 space-y-2">
                <button
                  type="button"
                  className="text-left w-full"
                  onClick={() => setPreviewSetId(set.id)}
                >
                  <h3 className="font-semibold text-sm truncate">{set.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <span>{set.year}</span>
                    <span>{set.brand}</span>
                    <span>{set.product_line}</span>
                  </div>
                </button>

                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {SET_TYPE_LABELS[set.set_type] || set.set_type}
                  </Badge>

                  {inCollection ? (
                    <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                      <Check className="h-3 w-3 mr-1" />
                      In Collection
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={isAdding}
                      onClick={() => handleAddToCollection(set.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {isAdding ? "Adding..." : "Add"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground">No sets match your filters.</p>
        </div>
      )}

      {/* Set detail preview sheet */}
      <SetDetailSheet
        setId={previewSetId}
        open={!!previewSetId}
        onOpenChange={(open) => {
          if (!open) setPreviewSetId(null);
        }}
      />
    </div>
  );
}

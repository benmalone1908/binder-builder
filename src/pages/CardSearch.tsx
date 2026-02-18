import { useState, useEffect, useMemo } from "react";
import { Search, Image, CheckCircle2, Ban, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SetRow = Tables<"sets">;
type ChecklistItem = Tables<"checklist_items">;

interface SearchResult extends ChecklistItem {
  set: SetRow;
}

const SET_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  insert: "Insert",
  rainbow: "Rainbow",
  multi_year_insert: "Multi-Year Insert",
};

export default function CardSearch() {
  const [sets, setSets] = useState<SetRow[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const [playerSearch, setPlayerSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [setTypeFilter, setSetTypeFilter] = useState<string>("all");
  const [insertSetFilter, setInsertSetFilter] = useState<string>("all");


  // Load sets for filter options
  useEffect(() => {
    async function loadSets() {
      const { data } = await supabase.from("library_sets").select("*");
      if (data) setSets(data);
    }
    loadSets();
  }, []);

  // Derive unique filter options from sets
  const filterOptions = useMemo(() => {
    const years = [...new Set(sets.map((s) => s.year))].sort((a, b) => b - a);
    const brands = [...new Set(sets.map((s) => s.brand))].sort();
    const setTypes = [...new Set(sets.map((s) => s.set_type))];
    const insertSets = [...new Set(sets.map((s) => s.insert_set_name).filter(Boolean))].sort() as string[];
    return { years, brands, setTypes, insertSets };
  }, [sets]);

  async function handleSearch() {
    if (!playerSearch.trim()) {
      toast.error("Please enter a player name to search");
      return;
    }

    setLoading(true);
    setHasSearched(true);

    // Build list of set IDs that match our filters
    let filteredSetIds = sets.map((s) => s.id);

    if (yearFilter !== "all") {
      filteredSetIds = sets
        .filter((s) => s.year === parseInt(yearFilter))
        .map((s) => s.id);
    }

    if (brandFilter !== "all") {
      filteredSetIds = sets
        .filter((s) => filteredSetIds.includes(s.id) && s.brand === brandFilter)
        .map((s) => s.id);
    }

    if (setTypeFilter !== "all") {
      filteredSetIds = sets
        .filter((s) => filteredSetIds.includes(s.id) && s.set_type === setTypeFilter)
        .map((s) => s.id);
    }

    if (insertSetFilter !== "all") {
      filteredSetIds = sets
        .filter((s) => filteredSetIds.includes(s.id) && s.insert_set_name === insertSetFilter)
        .map((s) => s.id);
    }

    if (filteredSetIds.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Search checklist items
    const { data, error } = await supabase
      .from("library_checklist_items")
      .select("*")
      .in("library_set_id", filteredSetIds)
      .ilike("player_name", `%${playerSearch.trim()}%`);

    if (error) {
      toast.error("Search failed: " + error.message);
      setLoading(false);
      return;
    }

    // Join with set data
    const resultsWithSets: SearchResult[] = (data || []).map((item) => ({
      ...item,
      set: sets.find((s) => s.id === item.library_set_id)!,
    }));

    // Sort by year desc, then product line
    resultsWithSets.sort((a, b) => {
      if (a.set.year !== b.set.year) return b.set.year - a.set.year;
      return a.set.product_line.localeCompare(b.set.product_line);
    });

    setResults(resultsWithSets);
    setLoading(false);
  }

  async function setStatus(item: SearchResult, newStatus: "need" | "pending" | "owned") {
    if (item.status === newStatus) return;

    const { error } = await supabase
      .from("library_checklist_items")
      .update({ status: newStatus })
      .eq("id", item.id);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    setResults((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, status: newStatus } : r))
    );
  }

  function openImageSearch(item: SearchResult) {
    const year = item.year || item.set.year;
    const query = `${year} ${item.set.brand} ${item.set.product_line} ${item.player_name} #${item.card_number} baseball card`;
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`, "_blank");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSearch();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Card Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search across multiple sets to identify cards
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-[32rem]">
          <label className="text-sm font-medium mb-1.5 block">Player Name</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search player..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
        </div>

        <div className="w-24">
          <label className="text-sm font-medium mb-1.5 block">Year</label>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {filterOptions.years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-32">
          <label className="text-sm font-medium mb-1.5 block">Brand</label>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {filterOptions.brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-36">
          <label className="text-sm font-medium mb-1.5 block">Set Type</label>
          <Select value={setTypeFilter} onValueChange={setSetTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {filterOptions.setTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {SET_TYPE_LABELS[type] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filterOptions.insertSets.length > 0 && (
          <div className="w-40">
            <label className="text-sm font-medium mb-1.5 block">Insert Set</label>
            <Select value={insertSetFilter} onValueChange={setInsertSetFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {filterOptions.insertSets.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {/* Results */}
      {loading ? (
        <p className="text-muted-foreground">Searching...</p>
      ) : hasSearched && results.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground">
            No cards found matching your search criteria.
          </p>
        </div>
      ) : results.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            Found {results.length} card{results.length !== 1 ? "s" : ""} across{" "}
            {new Set(results.map((r) => r.library_set_id)).size} set
            {new Set(results.map((r) => r.library_set_id)).size !== 1 ? "s" : ""}
          </p>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Card #</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="w-16">Year</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Product Line</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">
                      {item.card_number}
                    </TableCell>
                    <TableCell className="font-medium">{item.player_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.year || item.set.year}
                    </TableCell>
                    <TableCell>{item.set.brand}</TableCell>
                    <TableCell className="font-medium">{item.set.product_line}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="secondary" className="text-xs w-fit">
                          {SET_TYPE_LABELS[item.set.set_type] || item.set.set_type}
                        </Badge>
                        {item.set.insert_set_name && (
                          <span className="text-xs text-muted-foreground">
                            {item.set.insert_set_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7",
                            item.status === "owned"
                              ? "text-green-600 bg-green-100 hover:bg-green-200"
                              : "text-muted-foreground hover:text-green-600"
                          )}
                          onClick={() => setStatus(item, "owned")}
                          title="Have"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7",
                            item.status === "pending"
                              ? "text-yellow-600 bg-yellow-100 hover:bg-yellow-200"
                              : "text-muted-foreground hover:text-yellow-600"
                          )}
                          onClick={() => setStatus(item, "pending")}
                          title="Pending"
                        >
                          <Timer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7",
                            item.status === "need"
                              ? "text-red-600 bg-red-100 hover:bg-red-200"
                              : "text-muted-foreground hover:text-red-600"
                          )}
                          onClick={() => setStatus(item, "need")}
                          title="Need"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openImageSearch(item)}
                        title="Search for card image"
                      >
                        <Image className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Search, LayoutGrid, List, MoreVertical, Pencil, Trash2, ImagePlus, FolderOpen, Calendar, Layers, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SetCard } from "@/components/sets/SetCard";
import { SetFormDialog } from "@/components/sets/SetFormDialog";
import { DeleteSetDialog } from "@/components/sets/DeleteSetDialog";
import { CoverImageDialog } from "@/components/sets/CoverImageDialog";
import { SetDetailSheet } from "@/components/sets/SetDetailSheet";
import { GlobalSearchModal } from "@/components/sets/GlobalSearchModal";

type SetRow = Tables<"library_sets">;
type CollectionRow = Tables<"user_collections">;
type ViewMode = "grid" | "list";
type GroupBy = "year" | "collection";
type SetTab = "regular" | "multi_year" | "rainbow";

interface SetStats {
  total: number;
  owned: number;
  pending: number;
}

interface SetCollectionJoin {
  library_set_id: string;
  user_collection_id: string;
}

interface CollectionWithStats extends CollectionRow {
  sets: SetRow[];
  totalCards: number;
  ownedCards: number;
  pendingCards: number;
  percentage: number;
}

const SET_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  insert: "Insert",
  rainbow: "Rainbow",
  multi_year_insert: "Multi-Year",
};

export default function SetsIndex() {
  const { user, isAdmin } = useAuth();
  const [sets, setSets] = useState<SetRow[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, SetStats>>(new Map());
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [setCollectionJoins, setSetCollectionJoins] = useState<SetCollectionJoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<SetTab>("regular");
  const [groupBy, setGroupBy] = useState<GroupBy>("year");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [formOpen, setFormOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<SetRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSet, setDeletingSet] = useState<SetRow | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageSet, setImageSet] = useState<SetRow | null>(null);
  const [flyoutSetId, setFlyoutSetId] = useState<string | null>(null);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [searchCollectionId, setSearchCollectionId] = useState<string | null>(null);
  const [searchCollectionName, setSearchCollectionName] = useState<string | null>(null);

  async function loadSetStats(setId: string) {
    if (!user) return;

    // Get total cards for this set
    const { data: items } = await supabase
      .from("library_checklist_items")
      .select("id")
      .eq("library_set_id", setId);

    const total = items?.length || 0;

    // Get user's statuses for cards in this set
    const { data: userStatuses } = await supabase
      .from("user_card_status")
      .select("status, library_checklist_items!inner(library_set_id)")
      .eq("user_id", user.id)
      .eq("library_checklist_items.library_set_id", setId);

    let owned = 0;
    let pending = 0;
    if (userStatuses) {
      for (const row of userStatuses) {
        if (row.status === "owned") owned++;
        if (row.status === "pending") pending++;
      }
    }

    setStatsMap((prev) => {
      const next = new Map(prev);
      next.set(setId, { total, owned, pending });
      return next;
    });
  }

  async function loadData() {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch user's sets (via user_sets join), collections, and collection-set joins
      const [userSetsResult, collectionsResult, setCollectionsResult] = await Promise.all([
        supabase
          .from("user_sets")
          .select("library_set_id, library_sets!inner(*)")
          .eq("user_id", user.id),
        supabase.from("user_collections").select("*").order("name"),
        supabase.from("user_collection_sets").select("library_set_id, user_collection_id"),
      ]);

      if (userSetsResult.error) console.error("User sets query error:", userSetsResult.error);
      if (collectionsResult.error) console.error("Collections query error:", collectionsResult.error);
      if (setCollectionsResult.error) console.error("Collection sets query error:", setCollectionsResult.error);

      const userSets = (userSetsResult.data || []).map(
        (r) => r.library_sets as unknown as SetRow
      );
      setSets(userSets);
      if (collectionsResult.data) setCollections(collectionsResult.data);
      if (setCollectionsResult.data) setSetCollectionJoins(setCollectionsResult.data);

      // Get set IDs for filtering
      const setIds = userSets.map((s) => s.id);

      if (setIds.length === 0) {
        setStatsMap(new Map());
        setLoading(false);
        return;
      }

      // Fetch total card counts per set and build item→set lookup (paginated)
      const totalCounts = new Map<string, number>();
      const itemToSet = new Map<string, string>();
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("library_checklist_items")
          .select("id, library_set_id")
          .in("library_set_id", setIds)
          .range(offset, offset + pageSize - 1);

        if (error || !data) {
          if (error) console.error("Checklist items query error:", error);
          hasMore = false;
        } else {
          for (const item of data) {
            totalCounts.set(item.library_set_id, (totalCounts.get(item.library_set_id) || 0) + 1);
            itemToSet.set(item.id, item.library_set_id);
          }
          hasMore = data.length === pageSize;
          offset += pageSize;
        }
      }

      // Fetch user's card statuses (paginated, no join needed)
      const ownedCounts = new Map<string, number>();
      const pendingCounts = new Map<string, number>();
      offset = 0;
      hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("user_card_status")
          .select("status, library_checklist_item_id")
          .eq("user_id", user.id)
          .range(offset, offset + pageSize - 1);

        if (error || !data) {
          if (error) console.error("User card status error:", error);
          hasMore = false;
        } else {
          for (const row of data) {
            const setId = itemToSet.get(row.library_checklist_item_id);
            if (!setId) continue;
            if (row.status === "owned") {
              ownedCounts.set(setId, (ownedCounts.get(setId) || 0) + 1);
            } else if (row.status === "pending") {
              pendingCounts.set(setId, (pendingCounts.get(setId) || 0) + 1);
            }
          }
          hasMore = data.length === pageSize;
          offset += pageSize;
        }
      }

      // Build combined stats map
      const map = new Map<string, SetStats>();
      for (const setId of setIds) {
        map.set(setId, {
          total: totalCounts.get(setId) || 0,
          owned: ownedCounts.get(setId) || 0,
          pending: pendingCounts.get(setId) || 0,
        });
      }
      setStatsMap(map);
    } catch (err) {
      console.error("loadData error:", err);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [user]);

  const filteredSets = useMemo(() => {
    let result = sets;

    // Filter by tab (regular vs multi-year vs rainbow)
    if (activeTab === "regular") {
      result = result.filter((s) => s.set_type !== "multi_year_insert" && s.set_type !== "rainbow");
    } else if (activeTab === "multi_year") {
      result = result.filter((s) => s.set_type === "multi_year_insert");
    } else if (activeTab === "rainbow") {
      result = result.filter((s) => s.set_type === "rainbow");
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.brand.toLowerCase().includes(term) ||
          s.product_line.toLowerCase().includes(term) ||
          (s.insert_set_name && s.insert_set_name.toLowerCase().includes(term)) ||
          String(s.year).includes(term)
      );
    }

    return result;
  }, [sets, searchTerm, activeTab]);

  const setsByYear = useMemo(() => {
    const grouped = new Map<number, SetRow[]>();
    for (const set of filteredSets) {
      const existing = grouped.get(set.year) || [];
      existing.push(set);
      grouped.set(set.year, existing);
    }
    // Sort years descending (most recent first)
    const years = [...grouped.keys()].sort((a, b) => b - a);
    // Sort sets within each year alphabetically by name
    return years.map((year) => ({
      year,
      sets: grouped.get(year)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [filteredSets]);

  const setsByCollection = useMemo(() => {
    // Build a map of collection ID to set IDs
    const collectionSetMap = new Map<string, Set<string>>();
    for (const join of setCollectionJoins) {
      if (!collectionSetMap.has(join.user_collection_id)) {
        collectionSetMap.set(join.user_collection_id, new Set());
      }
      collectionSetMap.get(join.user_collection_id)!.add(join.library_set_id);
    }

    // Build collection groups with stats
    const result: CollectionWithStats[] = [];
    for (const collection of collections) {
      const setIds = collectionSetMap.get(collection.id) || new Set();
      const collectionSets = filteredSets.filter((s) => setIds.has(s.id));

      if (collectionSets.length === 0 && searchTerm) continue; // Hide empty collections when searching

      let totalCards = 0;
      let ownedCards = 0;
      let pendingCards = 0;
      for (const set of collectionSets) {
        const stats = statsMap.get(set.id);
        if (stats) {
          totalCards += stats.total;
          ownedCards += stats.owned;
          pendingCards += stats.pending;
        }
      }
      const percentage = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;

      result.push({
        ...collection,
        sets: collectionSets.sort((a, b) => a.name.localeCompare(b.name)),
        totalCards,
        ownedCards,
        pendingCards,
        percentage,
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [collections, setCollectionJoins, filteredSets, statsMap, searchTerm]);

  // For multi-year sets, just sort alphabetically by name
  const multiYearSetsSorted = useMemo(() => {
    return [...filteredSets].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSets]);

  function handleEdit(set: SetRow) {
    setEditingSet(set);
    setFormOpen(true);
  }

  function handleDelete(set: SetRow) {
    setDeletingSet(set);
    setDeleteOpen(true);
  }

  function handleEditImage(set: SetRow) {
    setImageSet(set);
    setImageOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Sets</h1>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SetTab)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="regular" className="gap-2">
              <Calendar className="h-4 w-4" />
              Regular Sets
            </TabsTrigger>
            <TabsTrigger value="multi_year" className="gap-2">
              <Layers className="h-4 w-4" />
              Multi-Year Sets
            </TabsTrigger>
            <TabsTrigger value="rainbow" className="gap-2">
              <Palette className="h-4 w-4" />
              Rainbows
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {activeTab === "regular" && collections.length > 0 && (
              <div className="flex items-center border rounded-md">
                <Button
                  variant={groupBy === "year" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-r-none gap-2"
                  onClick={() => setGroupBy("year")}
                >
                  <Calendar className="h-4 w-4" />
                  By Year
                </Button>
                <Button
                  variant={groupBy === "collection" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-l-none gap-2"
                  onClick={() => setGroupBy("collection")}
                >
                  <FolderOpen className="h-4 w-4" />
                  By Collection
                </Button>
              </div>
            )}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="regular" className="mt-6">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filteredSets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No sets match your search." : "No sets in your collection yet."}
              </p>
              {!searchTerm && (
                <Button onClick={() => window.location.href = "/library"} variant="outline">
                  Browse Library
                </Button>
              )}
            </div>
          ) : groupBy === "collection" ? (
            <div className="space-y-6">
              {setsByCollection.map((collection) => (
                <div key={collection.id} className="rounded-xl border-2 border-muted-foreground/20 bg-muted p-4 space-y-4">
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">{collection.name}</h2>
                        <Badge variant="secondary">{collection.sets.length} sets</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchCollectionId(collection.id);
                            setSearchCollectionName(collection.name);
                            setGlobalSearchOpen(true);
                          }}
                          className="gap-2"
                        >
                          <Search className="h-3.5 w-3.5" />
                          Search
                        </Button>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold">{collection.percentage}%</span>
                        <p className="text-xs text-muted-foreground">
                          {collection.ownedCards} / {collection.totalCards} cards
                        </p>
                      </div>
                    </div>
                    <Progress value={collection.percentage} className="h-2" />
                    {collection.pendingCards > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {collection.pendingCards} cards pending
                      </p>
                    )}
                  </div>
                  {collection.sets.length > 0 && (
                    viewMode === "grid" ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {collection.sets.map((set) => (
                          <SetCard
                            key={set.id}
                            set={set}
                            stats={statsMap.get(set.id) || { total: 0, owned: 0, pending: 0 }}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onEditImage={handleEditImage}
                            onClick={() => setFlyoutSetId(set.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableBody>
                            {collection.sets.map((set) => {
                              const stats = statsMap.get(set.id) || { total: 0, owned: 0, pending: 0 };
                              const pct = stats.total > 0 ? Math.round((stats.owned / stats.total) * 100) : 0;
                              return (
                                <TableRow
                                  key={set.id}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => setFlyoutSetId(set.id)}
                                >
                                  <TableCell className="py-2 w-20">
                                    {set.cover_image_url ? (
                                      <img src={set.cover_image_url} alt="" className="w-16 h-22 object-contain rounded border bg-muted" />
                                    ) : (
                                      <div className="w-16 h-22 rounded border bg-muted" />
                                    )}
                                  </TableCell>
                                  <TableCell className="font-medium">{set.name}</TableCell>
                                  <TableCell className="w-16">{set.year}</TableCell>
                                  <TableCell>{set.brand}</TableCell>
                                  <TableCell className="w-40">
                                    {stats.total > 0 ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                          <span>{stats.owned}/{stats.total}</span>
                                          <span className="text-muted-foreground">{pct}%</span>
                                        </div>
                                        <Progress value={pct} className="h-1.5" />
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">No cards</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  )}
                </div>
              ))}
              {setsByCollection.length === 0 && (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <p className="text-muted-foreground">No collections yet. Create collections in Admin to group your sets.</p>
                </div>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="space-y-8">
              {setsByYear.map(({ year, sets: yearSets }) => (
                <div key={year}>
                  <h2 className="text-lg font-semibold mb-3 text-muted-foreground">{year}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {yearSets.map((set) => (
                      <SetCard
                        key={set.id}
                        set={set}
                        stats={statsMap.get(set.id) || { total: 0, owned: 0, pending: 0 }}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onEditImage={handleEditImage}
                        onClick={() => setFlyoutSetId(set.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-16">Year</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Product Line</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="w-40">Progress</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {setsByYear.flatMap(({ sets: yearSets }) =>
                    yearSets.map((set) => {
                      const stats = statsMap.get(set.id) || { total: 0, owned: 0, pending: 0 };
                      const pct = stats.total > 0 ? Math.round((stats.owned / stats.total) * 100) : 0;
                      return (
                        <TableRow
                          key={set.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setFlyoutSetId(set.id)}
                        >
                          <TableCell className="py-2">
                            {set.cover_image_url ? (
                              <img
                                src={set.cover_image_url}
                                alt=""
                                className="w-16 h-22 object-contain rounded border bg-muted"
                              />
                            ) : (
                              <div className="w-16 h-22 rounded border bg-muted" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{set.name}</TableCell>
                          <TableCell>{set.year}</TableCell>
                          <TableCell>{set.brand}</TableCell>
                          <TableCell>{set.product_line}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {SET_TYPE_LABELS[set.set_type] || set.set_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {stats.total > 0 ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span>{stats.owned}/{stats.total}</span>
                                  <span className="text-muted-foreground">{pct}%</span>
                                </div>
                                <Progress value={pct} className="h-1.5" />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No cards</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => handleEditImage(set)}>
                                  <ImagePlus className="h-4 w-4 mr-2" />
                                  {set.cover_image_url ? "Change Image" : "Add Image"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(set)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(set)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="multi_year" className="mt-6">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filteredSets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No multi-year sets match your search." : "No multi-year sets in your collection."}
              </p>
              {!searchTerm && (
                <Button onClick={() => window.location.href = "/library"} variant="outline">
                  Browse Library
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {multiYearSetsSorted.map((set) => (
                <SetCard
                  key={set.id}
                  set={set}
                  stats={statsMap.get(set.id) || { total: 0, owned: 0, pending: 0 }}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onEditImage={handleEditImage}
                  onClick={() => setFlyoutSetId(set.id)}
                />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Product Line</TableHead>
                    <TableHead>Insert Set</TableHead>
                    <TableHead className="w-40">Progress</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {multiYearSetsSorted.map((set) => {
                    const stats = statsMap.get(set.id) || { total: 0, owned: 0, pending: 0 };
                    const pct = stats.total > 0 ? Math.round((stats.owned / stats.total) * 100) : 0;
                    return (
                      <TableRow
                        key={set.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setFlyoutSetId(set.id)}
                      >
                        <TableCell className="py-2">
                          {set.cover_image_url ? (
                            <img
                              src={set.cover_image_url}
                              alt=""
                              className="w-16 h-22 object-contain rounded border bg-muted"
                            />
                          ) : (
                            <div className="w-16 h-22 rounded border bg-muted" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{set.name}</TableCell>
                        <TableCell>{set.brand}</TableCell>
                        <TableCell>{set.product_line}</TableCell>
                        <TableCell>
                          {set.insert_set_name && (
                            <Badge variant="outline">{set.insert_set_name}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {stats.total > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span>{stats.owned}/{stats.total}</span>
                                <span className="text-muted-foreground">{pct}%</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No cards</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => handleEditImage(set)}>
                                <ImagePlus className="h-4 w-4 mr-2" />
                                {set.cover_image_url ? "Change Image" : "Add Image"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(set)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(set)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rainbow" className="mt-6">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filteredSets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No rainbow sets match your search." : "No rainbow sets in your collection."}
              </p>
              {!searchTerm && (
                <Button onClick={() => window.location.href = "/library"} variant="outline">
                  Browse Library
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {multiYearSetsSorted.map((set) => (
                <SetCard
                  key={set.id}
                  set={set}
                  stats={statsMap.get(set.id) || { total: 0, owned: 0, pending: 0 }}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onEditImage={handleEditImage}
                  onClick={() => setFlyoutSetId(set.id)}
                />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20"></TableHead>
                    <TableHead>Player / Card</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Product Line</TableHead>
                    <TableHead className="w-40">Progress</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {multiYearSetsSorted.map((set) => {
                    const stats = statsMap.get(set.id) || { total: 0, owned: 0, pending: 0 };
                    const pct = stats.total > 0 ? Math.round((stats.owned / stats.total) * 100) : 0;
                    return (
                      <TableRow
                        key={set.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setFlyoutSetId(set.id)}
                      >
                        <TableCell className="py-2">
                          {set.cover_image_url ? (
                            <img
                              src={set.cover_image_url}
                              alt=""
                              className="w-16 h-22 object-contain rounded border bg-muted"
                            />
                          ) : (
                            <div className="w-16 h-22 rounded border bg-muted" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{set.name}</TableCell>
                        <TableCell>{set.year}</TableCell>
                        <TableCell>{set.brand}</TableCell>
                        <TableCell>{set.product_line}</TableCell>
                        <TableCell>
                          {stats.total > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span>{stats.owned}/{stats.total}</span>
                                <span className="text-muted-foreground">{pct}%</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No parallels</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => handleEditImage(set)}>
                                <ImagePlus className="h-4 w-4 mr-2" />
                                {set.cover_image_url ? "Change Image" : "Add Image"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(set)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(set)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        set={editingSet}
        onSuccess={loadData}
      />

      <DeleteSetDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        set={deletingSet}
        onSuccess={loadData}
      />

      <CoverImageDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        set={imageSet}
        onSuccess={loadData}
      />

      <SetDetailSheet
        setId={flyoutSetId}
        open={!!flyoutSetId}
        onOpenChange={(open) => {
          if (!open) {
            // Refresh only the specific set's stats
            if (flyoutSetId) {
              loadSetStats(flyoutSetId);
            }
            setFlyoutSetId(null);
          }
        }}
      />

      <GlobalSearchModal
        open={globalSearchOpen}
        onOpenChange={setGlobalSearchOpen}
        onNavigateToSet={(setId) => setFlyoutSetId(setId)}
        collectionId={searchCollectionId}
        collectionName={searchCollectionName}
      />
    </div>
  );
}

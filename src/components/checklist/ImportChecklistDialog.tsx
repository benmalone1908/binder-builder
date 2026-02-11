import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseChecklistText, parseRainbowText, type ParsedCard, type ParsedParallel } from "@/lib/checklist-parser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Phase = "paste" | "preview" | "importing";

interface ImportChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  setType?: string;
  isMultiYear?: boolean;
  onSuccess: () => void;
}

export function ImportChecklistDialog({
  open,
  onOpenChange,
  setId,
  setType,
  isMultiYear,
  onSuccess,
}: ImportChecklistDialogProps) {
  const isRainbow = setType === "rainbow";

  const [phase, setPhase] = useState<Phase>("paste");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedCard[]>([]);
  const [parsedParallels, setParsedParallels] = useState<ParsedParallel[]>([]);
  const [importYear, setImportYear] = useState("");
  const [isParallel, setIsParallel] = useState(false);
  const [parallelLabel, setParallelLabel] = useState("");

  // Rainbow mode specific state
  const [rainbowCardNumber, setRainbowCardNumber] = useState("");
  const [rainbowPlayerName, setRainbowPlayerName] = useState("");
  const [rainbowTeam, setRainbowTeam] = useState("");

  function handlePreview() {
    if (isRainbow) {
      const results = parseRainbowText(rawText);
      setParsedParallels(results);
    } else {
      const yearNum = importYear ? parseInt(importYear, 10) : null;
      const results = parseChecklistText(rawText, yearNum);
      setParsed(results);
    }
    setPhase("preview");
  }

  function handleBack() {
    setPhase("paste");
  }

  async function handleRainbowImport() {
    const validParallels = parsedParallels.filter((p) => !p.error);
    if (validParallels.length === 0) return;

    // Validate rainbow-specific fields
    if (!rainbowCardNumber.trim() || !rainbowPlayerName.trim()) {
      toast.error("Card number and player name are required for rainbow import");
      return;
    }

    setPhase("importing");

    // Fetch existing parallels to avoid duplicates
    const { data: existingCards, error: fetchError } = await supabase
      .from("checklist_items")
      .select("parallel")
      .eq("set_id", setId)
      .eq("card_number", rainbowCardNumber.trim());

    if (fetchError) {
      console.error("Error fetching existing cards:", fetchError);
      toast.error("Failed to check for duplicates: " + fetchError.message);
      setPhase("preview");
      return;
    }

    const existingParallels = new Set(
      existingCards?.map((c) => c.parallel?.toLowerCase() || "") || []
    );

    const newParallels = validParallels.filter(
      (p) => !existingParallels.has(p.parallel.toLowerCase())
    );
    const skipped = validParallels.length - newParallels.length;

    if (newParallels.length === 0) {
      toast.info(`All ${skipped} parallels already exist for this card`);
      setPhase("preview");
      return;
    }

    const rows = newParallels.map((p) => ({
      set_id: setId,
      card_number: rainbowCardNumber.trim(),
      player_name: rainbowPlayerName.trim(),
      team: rainbowTeam.trim() || null,
      year: null,
      parallel: p.parallel,
      parallel_print_run: p.parallel_print_run,
    }));

    const { data, error } = await supabase
      .from("checklist_items")
      .insert(rows)
      .select();

    if (error) {
      toast.error(`Import failed: ${error.message}`);
      setPhase("preview");
      return;
    }

    const message = skipped > 0
      ? `Imported ${data?.length || rows.length} parallels (${skipped} duplicates skipped)`
      : `Imported ${data?.length || rows.length} parallels`;
    toast.success(message);

    // Reset form
    setRawText("");
    setParsedParallels([]);
    setRainbowCardNumber("");
    setRainbowPlayerName("");
    setRainbowTeam("");
    setPhase("paste");
    onOpenChange(false);
    onSuccess();
  }

  async function handleImport() {
    if (isRainbow) {
      return handleRainbowImport();
    }

    const validCards = parsed.filter((c) => !c.error);
    if (validCards.length === 0) return;

    setPhase("importing");

    // Fetch existing cards to avoid duplicates
    // For multi-year sets, include year and parallel in the check
    const { data: existingCards, error: fetchError } = await supabase
      .from("checklist_items")
      .select("card_number, player_name, year, parallel")
      .eq("set_id", setId);

    if (fetchError) {
      console.error("Error fetching existing cards:", fetchError);
      toast.error("Failed to check for duplicates: " + fetchError.message);
      setPhase("preview");
      return;
    }

    // Normalize keys for comparison (trim whitespace)
    // For multi-year sets, include year and parallel in the key
    const normalizeKey = (cardNum: string, playerName: string, year?: number | null, parallel?: string | null) => {
      const base = `${cardNum.trim().toLowerCase()}|${playerName.trim().toLowerCase()}`;
      return isMultiYear ? `${base}|${year ?? ""}|${(parallel || "").toLowerCase()}` : base;
    };

    // Get the parallel value for this import batch
    const importParallel = isParallel && parallelLabel.trim() ? parallelLabel.trim() : null;

    const existingKeys = new Set(
      existingCards?.map((c) => normalizeKey(c.card_number, c.player_name, c.year, c.parallel)) || []
    );

    const newCards = validCards.filter(
      (card) => !existingKeys.has(normalizeKey(card.card_number, card.player_name, card.year, importParallel))
    );
    const skipped = validCards.length - newCards.length;

    if (newCards.length === 0) {
      // Show which new cards matched which existing cards
      const matchedPairs = validCards.map(card => {
        const key = normalizeKey(card.card_number, card.player_name, card.year, importParallel);
        const matchingExisting = existingCards?.find(
          ec => normalizeKey(ec.card_number, ec.player_name, ec.year, ec.parallel) === key
        );
        const yearSuffix = isMultiYear ? ` (${card.year ?? "no year"}${importParallel ? `, ${importParallel}` : ""})` : "";
        return {
          newCard: `${card.card_number} - ${card.player_name}${yearSuffix}`,
          newKey: key,
          matchedExisting: matchingExisting
            ? `${matchingExisting.card_number} - ${matchingExisting.player_name}${isMultiYear ? ` (${matchingExisting.year ?? "no year"}${matchingExisting.parallel ? `, ${matchingExisting.parallel}` : ""})` : ""}`
            : "NO MATCH FOUND (BUG!)",
        };
      });
      console.log("Duplicate check details:", {
        setId,
        isMultiYear,
        importParallel,
        existingCount: existingCards?.length || 0,
        validCardsCount: validCards.length,
        matchedPairs,
      });
      toast.info(`All ${skipped} cards already exist in this set`);
      setPhase("preview");
      return;
    }

    const rows = newCards.map((card) => ({
      set_id: setId,
      card_number: card.card_number,
      player_name: card.player_name,
      team: card.team,
      year: card.year,
      parallel: isParallel && parallelLabel.trim() ? parallelLabel.trim() : null,
    }));

    // Batch insert in chunks of 50
    const chunkSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from("checklist_items")
        .insert(chunk)
        .select();

      if (error) {
        toast.error(`Import failed at row ${i + 1}: ${error.message}`);
        setPhase("preview");
        return;
      }
      totalInserted += data?.length || chunk.length;
    }

    const message = skipped > 0
      ? `Imported ${totalInserted} cards (${skipped} duplicates skipped)`
      : `Imported ${totalInserted} cards`;
    toast.success(message);
    setRawText("");
    setParsed([]);
    setPhase("paste");
    onOpenChange(false);
    onSuccess();
  }

  function handleClose(open: boolean) {
    if (!open) {
      setRawText("");
      setParsed([]);
      setParsedParallels([]);
      setPhase("paste");
      setImportYear("");
      setIsParallel(false);
      setParallelLabel("");
      setRainbowCardNumber("");
      setRainbowPlayerName("");
      setRainbowTeam("");
    }
    onOpenChange(open);
  }

  const validCount = isRainbow
    ? parsedParallels.filter((p) => !p.error).length
    : parsed.filter((c) => !c.error).length;
  const errorCount = isRainbow
    ? parsedParallels.filter((p) => p.error).length
    : parsed.filter((c) => c.error).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isRainbow ? "Import Rainbow Parallels" : "Import Checklist"}
          </DialogTitle>
        </DialogHeader>

        {phase === "paste" && (
          <div className="space-y-4 flex-1">
            {isRainbow ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Import parallel variations for a rainbow chase. First, enter the card details, then paste the list of parallels.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rainbow-card-number">Card Number *</Label>
                    <Input
                      id="rainbow-card-number"
                      placeholder="e.g. 1"
                      value={rainbowCardNumber}
                      onChange={(e) => setRainbowCardNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rainbow-team">Team</Label>
                    <Input
                      id="rainbow-team"
                      placeholder="e.g. Angels"
                      value={rainbowTeam}
                      onChange={(e) => setRainbowTeam(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rainbow-player-name">Player Name *</Label>
                  <Input
                    id="rainbow-player-name"
                    placeholder="e.g. Shohei Ohtani"
                    value={rainbowPlayerName}
                    onChange={(e) => setRainbowPlayerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parallel Variations</Label>
                  <p className="text-xs text-muted-foreground">
                    Paste parallel list, one per line:
                  </p>
                  <pre className="text-xs bg-muted rounded p-2">
                    Sky Blue – /499{"\n"}
                    Purple – /250{"\n"}
                    Gold – /50{"\n"}
                    Platinum – 1/1
                  </pre>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Paste checklist data below, one card per line. Expected format:
                </p>
                <pre className="text-xs bg-muted rounded p-2">
                  577 Trevor Story - Boston Red Sox{"\n"}
                  581 Andruw Monasterio - Milwaukee Brewers{"\n"}
                  100 Pete Crow-Armstrong - Chicago Cubs
                </pre>
              </>
            )}
            {!isRainbow && isMultiYear && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-year">Year for these cards</Label>
                  <Input
                    id="import-year"
                    type="number"
                    placeholder="e.g. 2024"
                    value={importYear}
                    onChange={(e) => setImportYear(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is-parallel"
                      checked={isParallel}
                      onCheckedChange={(checked) => setIsParallel(checked === true)}
                    />
                    <Label htmlFor="is-parallel" className="cursor-pointer">
                      This is a parallel version
                    </Label>
                  </div>
                  {isParallel && (
                    <Input
                      placeholder="Parallel name (e.g. Refractor, Gold)"
                      value={parallelLabel}
                      onChange={(e) => setParallelLabel(e.target.value)}
                      className="w-64"
                    />
                  )}
                </div>
              </div>
            )}
            <Textarea
              placeholder={
                isRainbow
                  ? "Paste parallel list here..."
                  : "Paste checklist here..."
              }
              rows={isRainbow ? 8 : isMultiYear ? 10 : 12}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={
                  !rawText.trim() ||
                  (isRainbow && (!rainbowCardNumber.trim() || !rainbowPlayerName.trim()))
                }
              >
                Preview
              </Button>
            </div>
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {validCount} {isRainbow ? "parallels" : "cards"}
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive">{errorCount} errors</Badge>
              )}
            </div>
            {isRainbow && (
              <div className="text-sm space-y-1">
                <p><strong>Card #:</strong> {rainbowCardNumber}</p>
                <p><strong>Player:</strong> {rainbowPlayerName}</p>
                {rainbowTeam && <p><strong>Team:</strong> {rainbowTeam}</p>}
              </div>
            )}
            <div className="flex-1 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Line</TableHead>
                    {isRainbow ? (
                      <>
                        <TableHead>Parallel</TableHead>
                        <TableHead className="w-24">Print Run</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="w-20">Card #</TableHead>
                        <TableHead>Player Name</TableHead>
                        <TableHead>Team</TableHead>
                        {isMultiYear && <TableHead className="w-16">Year</TableHead>}
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRainbow ? (
                    parsedParallels.map((parallel) => (
                      <TableRow
                        key={parallel.line_number}
                        className={parallel.error ? "bg-destructive/10" : ""}
                      >
                        <TableCell className="text-muted-foreground">
                          {parallel.line_number}
                        </TableCell>
                        <TableCell>
                          {parallel.error ? (
                            <span className="text-destructive text-sm">{parallel.error}</span>
                          ) : (
                            parallel.parallel
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {parallel.parallel_print_run ? `/${parallel.parallel_print_run}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    parsed.map((card) => (
                      <TableRow
                        key={card.line_number}
                        className={card.error ? "bg-destructive/10" : ""}
                      >
                        <TableCell className="text-muted-foreground">
                          {card.line_number}
                        </TableCell>
                        <TableCell>{card.card_number}</TableCell>
                        <TableCell>
                          {card.error ? (
                            <span className="text-destructive text-sm">{card.error}</span>
                          ) : (
                            card.player_name
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {card.team || "—"}
                        </TableCell>
                        {isMultiYear && (
                          <TableCell className="text-muted-foreground">
                            {card.year || "—"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Import {validCount} {isRainbow ? "Parallels" : "Cards"}
              </Button>
            </div>
          </div>
        )}

        {phase === "importing" && (
          <div className="py-8 text-center text-muted-foreground">
            Importing cards...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

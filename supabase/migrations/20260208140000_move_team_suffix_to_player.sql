-- Move " (Veteran Combos)" and " (Rookie Debut)" suffixes from team to player_name

-- Move " (Veteran Combos)" suffix
UPDATE checklist_items
SET
  player_name = player_name || ' (Veteran Combos)',
  team = TRIM(SUBSTRING(team FROM 1 FOR LENGTH(team) - LENGTH(' (Veteran Combos)')))
WHERE team LIKE '% (Veteran Combos)';

-- Move " (Rookie Debut)" suffix
UPDATE checklist_items
SET
  player_name = player_name || ' (Rookie Debut)',
  team = TRIM(SUBSTRING(team FROM 1 FOR LENGTH(team) - LENGTH(' (Rookie Debut)')))
WHERE team LIKE '% (Rookie Debut)';

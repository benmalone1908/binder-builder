-- Move "VC", "RD", "RC" suffixes from team to player_name

-- When team ends with " VC"
UPDATE checklist_items
SET
  player_name = player_name || ' VC',
  team = NULLIF(TRIM(SUBSTRING(team FROM 1 FOR LENGTH(team) - 3)), '')
WHERE team LIKE '% VC';

-- When team ends with " RD"
UPDATE checklist_items
SET
  player_name = player_name || ' RD',
  team = NULLIF(TRIM(SUBSTRING(team FROM 1 FOR LENGTH(team) - 3)), '')
WHERE team LIKE '% RD';

-- When team ends with " RC"
UPDATE checklist_items
SET
  player_name = player_name || ' RC',
  team = NULLIF(TRIM(SUBSTRING(team FROM 1 FOR LENGTH(team) - 3)), '')
WHERE team LIKE '% RC';

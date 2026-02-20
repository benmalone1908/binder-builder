export const SPORTS = [
  "baseball",
  "basketball",
  "football",
  "hockey",
  "soccer",
  "other",
] as const;

export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Record<Sport, string> = {
  baseball: "Baseball",
  basketball: "Basketball",
  football: "Football",
  hockey: "Hockey",
  soccer: "Soccer",
  other: "Other",
};

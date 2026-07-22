export const entityTypes = [
  "pcs",
  "npcs",
  "monsters",
  "locations",
  "mysteries",
  "clues",
  "organizations",
] as const;

export type EntityType = (typeof entityTypes)[number];

interface EntityTypeConfig {
  label: string;
  pluralLabel: string;
  /** Field on the entity holding a portrait/cover image URL, if any. */
  imageField: "portraitImageUrl" | "imageUrl" | "coverImageUrl" | null;
  /** Field on the entity used as its display title in generic list views. */
  titleField: "name" | "title";
}

export const entityTypeConfig: Record<EntityType, EntityTypeConfig> = {
  pcs: {
    label: "Player Character",
    pluralLabel: "Player Characters",
    imageField: "portraitImageUrl",
    titleField: "name",
  },
  npcs: { label: "NPC", pluralLabel: "NPCs", imageField: "portraitImageUrl", titleField: "name" },
  monsters: {
    label: "Monster",
    pluralLabel: "Monsters",
    imageField: "portraitImageUrl",
    titleField: "name",
  },
  locations: { label: "Location", pluralLabel: "Locations", imageField: "imageUrl", titleField: "name" },
  mysteries: { label: "Mystery", pluralLabel: "Mysteries", imageField: null, titleField: "name" },
  clues: { label: "Clue", pluralLabel: "Clues", imageField: null, titleField: "title" },
  organizations: {
    label: "Organization",
    pluralLabel: "Organizations",
    imageField: "imageUrl",
    titleField: "name",
  },
};

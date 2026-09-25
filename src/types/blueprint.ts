export interface BlueprintCharacter {
  name: string;
  role: string;
  shortDescription: string;
  want?: string;
  need?: string;
  flawOrWound?: string;
  attributes: { label: string; value: string }[];
  tags: string[];
}

export interface BlueprintLocation {
  name: string;
  shortDescription: string;
  detailedNotes: string;
  attributes: { label: string; value: string }[];
  tags: string[];
}

export interface BlueprintItem {
  name: string;
  shortDescription: string;
  detailedNotes: string;
  attributes: { label: string; value: string }[];
  tags: string[];
}

export interface BlueprintChapter {
  title: string;
  order: number;
  premise: string;
  notes: string;
  targetWordCount: number;
}

export interface StoryBlueprint {
  title: string;
  genre: string;
  logline: string;
  synopsis: string;
  thematicCore: string;
  characters: BlueprintCharacter[];
  locations: BlueprintLocation[];
  items: BlueprintItem[];
  chapters: BlueprintChapter[];
}

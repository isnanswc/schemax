export interface BlueprintCharacter {
  name: string;
  role: string;
  age?: string;
  physicalTraits?: string;
  traits?: string;
  visualPrompt?: string;
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

export interface StoryContinuationOption {
  id: string;
  title: string;
  description: string;
}

export interface StoryBlueprint {
  title: string;
  titleOptions?: string[];
  firstChapterTitleOptions?: string[];
  genre: string;
  logline: string;
  synopsis: string;
  thematicCore: string;
  storyContinuations?: StoryContinuationOption[];
  selectedContinuation?: string;
  writingStyle?: string;
  pointOfView?: string;
  settingTimeAndTone?: string;
  characters: BlueprintCharacter[];
  locations: BlueprintLocation[];
  items: BlueprintItem[];
  chapters: BlueprintChapter[];
}

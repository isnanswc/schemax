export type BookStatus = 'draft' | 'released';

export interface Book {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  status: BookStatus;
  coverMediaId?: string;
  wordCountTarget?: number;
  currentWordCount?: number;
  createdAt: number;
  updatedAt: number;
}

export type ChapterStatus = 'planned' | 'in_progress' | 'completed';

export interface ChapterRawDraft {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChapterPlotBreakdown {
  hook: string;
  risingAction: string;
  climax: string;
  resolution: string;
}

export interface ChapterSceneItem {
  id: string;
  sceneNumber: number;
  title: string;
  setting: string;
  characters: string[];
  summary: string;
  goalConflict?: string;
}

export interface StoryChapter {
  id: string;
  bookId: string;
  title: string;
  order: number;
  status: ChapterStatus;
  premise: string;
  notes: string;
  contentHtml: string;
  wordCount: number;
  targetWordCount?: number;
  rawDrafts?: ChapterRawDraft[];
  activeRawDraftId?: string;
  aiSummary?: string;
  aiPlot?: ChapterPlotBreakdown;
  aiScenes?: ChapterSceneItem[];
  createdAt: number;
  updatedAt: number;
}

export type WorldCategory = 'character' | 'location' | 'item' | 'lore';

export interface WorldAttribute {
  id: string;
  label: string;
  value: string;
}

export interface WorldEntity {
  id: string;
  bookId: string;
  category: WorldCategory;
  name: string;
  shortDescription: string;
  detailedNotes: string;
  tags: string[];
  avatarMediaId?: string;
  galleryMediaIds: string[];
  attributes: WorldAttribute[];
  createdAt: number;
  updatedAt: number;
}

export interface MediaItem {
  id: string;
  bookId: string;
  entityId?: string;
  name: string;
  mimeType: string;
  blob: Blob;
  size: number;
  createdAt: number;
}

export type ActiveTab = 'overview' | 'chapters' | 'world' | 'gallery' | 'sync';

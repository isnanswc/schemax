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

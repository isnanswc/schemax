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

export interface SceneGlosariumItem {
  name: string;
  category: WorldCategory;
  entityId?: string;
}

export interface ChapterSceneItem {
  id: string;
  sceneNumber: number;
  title: string;
  setting: string;
  characters: string[];
  summary: string;
  goalConflict?: string;
  timelineType?: 'linear' | 'parallel' | 'flashback' | 'branched';
  timeMarker?: string;
  branchGroup?: string;
  entitiesPresent?: SceneGlosariumItem[];
  imagePrompt?: string;
}

export interface ImagePromptSettings {
  aspectRatio: string;
  style: string;
  characterNaming: string;
  additionalKeywords: string;
  language: 'en' | 'id';
}

export interface DetectedEntityCandidate {
  id: string;
  name: string;
  category: WorldCategory;
  shortDescription: string;
  isExisting: boolean;
  existingEntityId?: string;
  detectedAliasOf?: string;
  suggestedAction: 'register_new' | 'add_alias';
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
  aiDetectedEntities?: DetectedEntityCandidate[];
  coverMediaId?: string;
  coverImageUrl?: string;
  chapterEntityStates?: Record<string, ChapterEntityState>;
  chapterRelationships?: EntityRelationship[];
  tensionData?: ChapterTensionData;
  emotionScript?: ChapterEmotionScript;
  createdAt: number;
  updatedAt: number;
}

export type TensionDisplayMode = 'both' | 'gutter' | 'underline' | 'none';

export interface ParagraphTensionItem {
  paragraphIndex: number;
  textHash: string;
  tensionScore: number; // 0 to 100
  label?: string; // 'Tenang', 'Kecurigaan', 'Konflik', 'Klimaks'
  note?: string; // brief reason
}

export interface ChapterTensionData {
  items: ParagraphTensionItem[];
  lastAnalyzedAt: number;
  displayMode: TensionDisplayMode;
}

export type EmotionType =
  | 'neutral'
  | 'whisper'
  | 'suspense'
  | 'anger'
  | 'fear'
  | 'sadness'
  | 'joy'
  | 'climax'
  | 'solemn';

export interface ParagraphEmotionTag {
  paragraphIndex: number;
  textHash: string;
  speaker?: string; // e.g. "Narator", "Roy", "Maya"
  isDialogue: boolean;
  emotion: EmotionType;
  emotionLabel: string; // e.g. "Berbisik (Takut)", "Membentak (Marah)"
  intensity: number; // 1 to 5
  pitchMod: number; // 0.8 to 1.3
  rateMod: number; // 0.8 to 1.4
  actingNotes: string; // e.g. "Napas tercekat, intonasi gemetar pelan"
}

export interface ChapterEmotionScript {
  tags: ParagraphEmotionTag[];
  lastTaggedAt: number;
}

export type WorldCategory = 'character' | 'location' | 'item' | 'lore';

export type EntityCondition =
  | 'aktif'
  | 'luka'
  | 'gugur'
  | 'hilang'
  | 'berkhianat'
  | 'terkutuk'
  | 'ditawan'
  | 'pelarian'
  | 'koma'
  | 'spesial';

export type RelationshipType =
  | 'sekutu'
  | 'musuh'
  | 'keluarga'
  | 'bawahan'
  | 'atasan'
  | 'kekasih'
  | 'guru_murid'
  | 'rival'
  | 'khianat'
  | 'netral'
  | 'lainnya';

export interface EntityRelationship {
  id?: string;
  targetEntityId: string;
  targetEntityName?: string;
  relationshipType: RelationshipType;
  label: string;
  description?: string;
}

export interface FactionClusterInfo {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface WorldAttribute {
  id: string;
  label: string;
  value: string;
}

export interface ChapterSceneCondition {
  sceneNumber: number;
  sceneTitle: string;
  condition: EntityCondition | string;
  conditionDetails?: string;
}

export interface ChapterEntityRecord {
  chapterId: string;
  chapterTitle: string;
  chapterOrder: number;
  condition: EntityCondition | string;
  conditionDetails?: string;
  scenes?: ChapterSceneCondition[];
}

export interface ChapterEntityState {
  entityId: string;
  entityName?: string;
  condition?: EntityCondition | string;
  conditionDetails?: string;
  relationships?: EntityRelationship[];
  sceneConditions?: Record<number, { condition: string; conditionDetails?: string }>;
}

export interface WorldEntity {
  id: string;
  bookId: string;
  category: WorldCategory;
  name: string;
  aliases?: string[];
  shortDescription: string;
  detailedNotes: string;
  tags: string[];
  avatarMediaId?: string;
  avatarUrl?: string;
  galleryMediaIds: string[];
  attributes: WorldAttribute[];
  // Faksi & Kelompok
  faction?: string;
  factionColor?: string;
  // Kondisi Status Terkini
  condition?: EntityCondition | string;
  conditionDetails?: string;
  // Jaringan Relasi Antar Entitas
  relationships?: EntityRelationship[];
  // Kronologi Kondisi Bab & Scene
  chapterChronology?: Record<string, ChapterEntityRecord>;
  createdAt: number;
  updatedAt: number;
}

export type MediaCategory = WorldCategory | 'cover_book' | 'cover_chapter' | 'scene' | 'general';

export interface MediaItem {
  id: string;
  bookId: string;
  chapterId?: string;
  entityId?: string;
  category?: MediaCategory;
  tags?: string[];
  caption?: string;
  aiDescription?: string;
  aiNarrativeIntro?: string;
  name: string;
  mimeType: string;
  blob: Blob;
  size: number;
  createdAt: number;
}

export type ActiveTab = 'overview' | 'chapters' | 'world' | 'gallery' | 'sync';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Book, StoryChapter, WorldEntity, MediaItem, ActiveTab, BookStatus } from './types';
import { db, seedInitialDataIfNeeded } from './db';
import { MobileHeader } from './components/layout/MobileHeader';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { BookListDashboard } from './components/books/BookListDashboard';
import { BookOverviewTab } from './components/books/BookOverviewTab';
import { StoryPlannerView } from './components/story/StoryPlannerView';
import { RichTextEditor } from './components/story/RichTextEditor';
import { WorldBuildingView } from './components/world/WorldBuildingView';
import { MediaGalleryView } from './components/media/MediaGalleryView';
import { CreateBookModal } from './components/books/CreateBookModal';
import { SyncStatusModal } from './components/sync/SyncStatusModal';
import { AISettingsModal } from './components/settings/AISettingsModal';
import { AIStoryArchitectModal } from './components/story/AIStoryArchitectModal';

export function App() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chapters');
  const [editingChapter, setEditingChapter] = useState<StoryChapter | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialStatus, setCreateModalInitialStatus] = useState<BookStatus>('draft');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isArchitectModalOpen, setIsArchitectModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize seed data if database is empty on first boot
  useEffect(() => {
    seedInitialDataIfNeeded().then(() => {
      setRefreshTrigger((prev) => prev + 1);
    });
  }, []);

  // Live queries from IndexedDB via Dexie
  const books = useLiveQuery(() => db.books.toArray(), [refreshTrigger]) || [];
  const allChapters = useLiveQuery(() => db.chapters.toArray(), [refreshTrigger]) || [];

  const bookChapters = useLiveQuery(
    () => (currentBook ? db.chapters.where('bookId').equals(currentBook.id).sortBy('order') : []),
    [currentBook?.id, refreshTrigger]
  ) || [];

  const bookEntities = useLiveQuery(
    () => (currentBook ? db.worldEntities.where('bookId').equals(currentBook.id).toArray() : []),
    [currentBook?.id, refreshTrigger]
  ) || [];

  const bookMedia = useLiveQuery(
    () => (currentBook ? db.media.where('bookId').equals(currentBook.id).toArray() : []),
    [currentBook?.id, refreshTrigger]
  ) || [];

  // Map chapter counts per book for the dashboard cards
  const chapterCounts: Record<string, number> = {};
  allChapters.forEach((ch) => {
    chapterCounts[ch.bookId] = (chapterCounts[ch.bookId] || 0) + 1;
  });

  // Find the most recently active chapter across all books for 1-Tap Quick Resume
  const recentChapter = allChapters.length > 0
    ? [...allChapters].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
    : null;

  const recentBook = recentChapter
    ? books.find((b) => b.id === recentChapter.bookId) || null
    : null;

  // Native back gesture & Android hardware back button support
  useEffect(() => {
    const handlePopState = () => {
      setEditingChapter(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectBook = (book: Book) => {
    window.history.pushState({ screen: 'book' }, '');
    setCurrentBook(book);
    setActiveTab('chapters');
  };

  const handleBackToHome = () => {
    setCurrentBook(null);
    setEditingChapter(null);
  };

  const handleOpenEditor = (chapter: StoryChapter) => {
    window.history.pushState({ screen: 'editor' }, '');
    setEditingChapter(chapter);
  };

  const handleBackFromEditor = () => {
    setEditingChapter(null);
  };

  const handleOpenCreateModal = (defaultStatus: BookStatus = 'draft') => {
    setCreateModalInitialStatus(defaultStatus);
    setIsCreateModalOpen(true);
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Fullscreen Rich Text Writing Mode */}
      {editingChapter && currentBook ? (
        <RichTextEditor
          chapter={editingChapter}
          bookTitle={currentBook.title}
          entities={bookEntities}
          onBack={handleBackFromEditor}
          onChapterUpdated={(updated) => {
            setEditingChapter((prev) => (prev ? updated : null));
            triggerRefresh();
          }}
        />
      ) : (
        <>
          {/* 2. Mobile-first Header */}
          <MobileHeader
            currentBook={currentBook}
            onBack={currentBook ? handleBackToHome : undefined}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
            onOpenAISettings={() => setIsAISettingsOpen(true)}
          />

          {/* 3. Main Body Container - Compact & Edge-to-Edge on Mobile */}
          <main className="flex-1 w-full max-w-4xl mx-auto px-2.5 sm:px-4 py-3 sm:py-6">
            {!currentBook ? (
              /* Home Screen / Studio Dashboard (Quick Resume, AI Spark, Draft & Released) */
              <BookListDashboard
                books={books}
                allChapters={allChapters}
                recentChapter={recentChapter}
                recentBook={recentBook}
                chapterCounts={chapterCounts}
                onSelectBook={handleSelectBook}
                onResumeChapter={(book, chapter) => {
                  setCurrentBook(book);
                  handleOpenEditor(chapter);
                }}
                onOpenCreateModal={handleOpenCreateModal}
                onOpenStoryArchitect={() => setIsArchitectModalOpen(true)}
                onOpenAISettings={() => setIsAISettingsOpen(true)}
              />
            ) : (
              /* Inside Book Workspace */
              <div className="space-y-4">
                {activeTab === 'overview' && (
                  <BookOverviewTab
                    book={currentBook}
                    chapters={bookChapters}
                    entities={bookEntities}
                    mediaList={bookMedia}
                    onBookUpdated={(updated) => {
                      setCurrentBook(updated);
                      triggerRefresh();
                    }}
                    onNavigateToTab={setActiveTab}
                  />
                )}

                {activeTab === 'chapters' && (
                  <StoryPlannerView
                    bookId={currentBook.id}
                    chapters={bookChapters}
                    onOpenEditor={handleOpenEditor}
                    onRefresh={triggerRefresh}
                  />
                )}

                {activeTab === 'world' && (
                  <WorldBuildingView
                    bookId={currentBook.id}
                    entities={bookEntities}
                    onRefresh={triggerRefresh}
                  />
                )}

                {activeTab === 'gallery' && (
                  <MediaGalleryView
                    bookId={currentBook.id}
                    mediaList={bookMedia}
                    onRefresh={triggerRefresh}
                  />
                )}
              </div>
            )}
          </main>

          {/* 4. Bottom Navigation when inside a Book */}
          {currentBook && (
            <BottomNavigation
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              chapterCount={bookChapters.length}
              entityCount={bookEntities.length}
              mediaCount={bookMedia.length}
            />
          )}

          {/* 5. Create Book Modal (Mobile-first Sheet / Drawer) */}
          <CreateBookModal
            isOpen={isCreateModalOpen}
            initialStatus={createModalInitialStatus}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={(newBook) => {
              triggerRefresh();
              setCurrentBook(newBook);
              setActiveTab('chapters');
            }}
          />

          {/* 6. IndexedDB & Cloud Sync Status Modal */}
          <SyncStatusModal
            isOpen={isSyncModalOpen}
            onClose={() => setIsSyncModalOpen(false)}
            onDataChanged={triggerRefresh}
          />

          {/* 7. Multi-AI Settings Modal (Gemini & Groq Fallback) */}
          <AISettingsModal
            isOpen={isAISettingsOpen}
            onClose={() => setIsAISettingsOpen(false)}
          />

          {/* 8. AI Story Architect Modal (Idea to Full Project) */}
          <AIStoryArchitectModal
            isOpen={isArchitectModalOpen}
            onClose={() => setIsArchitectModalOpen(false)}
            onProjectCreated={(newBook) => {
              triggerRefresh();
              handleSelectBook(newBook);
            }}
            onOpenAISettings={() => setIsAISettingsOpen(true)}
          />
        </>
      )}
    </div>
  );
}

export default App;

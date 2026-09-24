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

export function App() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chapters');
  const [editingChapter, setEditingChapter] = useState<StoryChapter | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialStatus, setCreateModalInitialStatus] = useState<BookStatus>('draft');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
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

  const handleSelectBook = (book: Book) => {
    setCurrentBook(book);
    setActiveTab('chapters');
  };

  const handleBackToHome = () => {
    setCurrentBook(null);
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
          onBack={() => setEditingChapter(null)}
          onChapterUpdated={(updated) => {
            setEditingChapter(updated);
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
          />

          {/* 3. Main Body Container */}
          <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 sm:py-6">
            {!currentBook ? (
              /* Home Screen / Book Dashboard (Draft & Released Sheets) */
              <BookListDashboard
                books={books}
                chapterCounts={chapterCounts}
                onSelectBook={handleSelectBook}
                onOpenCreateModal={handleOpenCreateModal}
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
                    onOpenEditor={(chapter) => setEditingChapter(chapter)}
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
        </>
      )}
    </div>
  );
}

export default App;

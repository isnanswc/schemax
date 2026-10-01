import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Book, StoryChapter, WorldEntity, MediaItem, ActiveTab, BookStatus } from './types';
import { db, seedInitialDataIfNeeded } from './db';
import { MobileHeader } from './components/layout/MobileHeader';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { HomeBottomNavigation } from './components/layout/HomeBottomNavigation';
import { DashboardView } from './components/dashboard/DashboardView';
import { WorksView } from './components/works/WorksView';
import { BookOverviewTab } from './components/books/BookOverviewTab';
import { StoryPlannerView } from './components/story/StoryPlannerView';
import { RichTextEditor } from './components/story/RichTextEditor';
import { ChapterReaderView } from './components/story/reader/ChapterReaderView';
import { WorldBuildingView } from './components/world/WorldBuildingView';
import { MediaGalleryView } from './components/media/MediaGalleryView';
import { CreateBookModal } from './components/books/CreateBookModal';
import { SyncStatusModal } from './components/sync/SyncStatusModal';
import { AISettingsModal } from './components/settings/AISettingsModal';
import { GDriveSettingsModal } from './components/settings/GDriveSettingsModal';
import { AIStoryArchitectModal } from './components/story/AIStoryArchitectModal';
import { navStack } from './services/backNavigationService';
import { LayoutDashboard, BookOpen } from 'lucide-react';
import { usePrivacy } from './contexts/PrivacyContext';
import { AppLockScreen } from './components/security/AppLockScreen';
import { PinSetupModal } from './components/security/PinSetupModal';
import { AppCornerMenuModal } from './components/layout/AppCornerMenuModal';
import { getStoredThemeMode, applyTheme, initThemeListener } from './services/themeService';

export function App() {
  const { bindEmptyAreaLongPress } = usePrivacy();
  const [mainMenu, setMainMenu] = useState<'dashboard' | 'works'>('dashboard');
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chapters');
  const [editingChapter, setEditingChapter] = useState<StoryChapter | null>(null);
  const [studioChapter, setStudioChapter] = useState<StoryChapter | null>(null);
  const [readingChapter, setReadingChapter] = useState<StoryChapter | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialStatus, setCreateModalInitialStatus] = useState<BookStatus>('draft');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isGDriveSettingsOpen, setIsGDriveSettingsOpen] = useState(false);
  const [isArchitectModalOpen, setIsArchitectModalOpen] = useState(false);
  const [isCornerMenuOpen, setIsCornerMenuOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize stored theme (dark, light, or auto) and system listener
  useEffect(() => {
    const savedTheme = getStoredThemeMode();
    applyTheme(savedTheme);
    const unbind = initThemeListener();
    return () => unbind();
  }, []);

  // Never auto-seed dummy data on startup. The app starts clean.
  // Demo data can only be loaded manually if desired via Sync & Storage modal.
  useEffect(() => {
    // Initial mount trigger
    setRefreshTrigger((prev) => prev + 1);
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

  // Native back gesture & Android hardware back button support via navStack
  useEffect(() => {
    const cleanup = navStack.init((msg) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 2200);
    });
    return cleanup;
  }, []);

  const handleSelectBook = (book: Book) => {
    navStack.push('book', () => {
      setCurrentBook(null);
      setStudioChapter(null);
      setEditingChapter(null);
    });
    setCurrentBook(book);
    setActiveTab('chapters');
  };

  const handleBackToHome = () => {
    navStack.pop('book');
    setCurrentBook(null);
    setStudioChapter(null);
    setEditingChapter(null);
  };

  const handleOpenChapterStudio = (chapter: StoryChapter) => {
    handleOpenEditor(chapter);
  };

  const handleBackFromChapterStudio = () => {
    handleBackFromEditor();
  };

  const handleOpenEditor = (chapter: StoryChapter) => {
    navStack.push('editor', () => {
      setEditingChapter(null);
      setStudioChapter(null);
    });
    setEditingChapter(chapter);
    setStudioChapter(chapter);
  };

  const handleBackFromEditor = () => {
    navStack.pop('editor');
    setEditingChapter(null);
    setStudioChapter(null);
  };

  const handleOpenReader = (chapter: StoryChapter) => {
    navStack.push('reader', () => {
      setReadingChapter(null);
    });
    setReadingChapter(chapter);
  };

  const handleBackFromReader = () => {
    navStack.pop('reader');
    setReadingChapter(null);
  };

  const handleSwitchReadingChapter = (nextChapter: StoryChapter) => {
    setReadingChapter(nextChapter);
  };

  const handleOpenCreateModal = (defaultStatus: BookStatus = 'draft') => {
    setCreateModalInitialStatus(defaultStatus);
    navStack.push('modal-create', () => setIsCreateModalOpen(false));
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    navStack.pop('modal-create');
    setIsCreateModalOpen(false);
  };

  const handleOpenSyncModal = () => {
    navStack.push('modal-sync', () => setIsSyncModalOpen(false));
    setIsSyncModalOpen(true);
  };

  const handleCloseSyncModal = () => {
    navStack.pop('modal-sync');
    setIsSyncModalOpen(false);
  };

  const handleOpenAISettings = () => {
    navStack.push('modal-ai-settings', () => setIsAISettingsOpen(false));
    setIsAISettingsOpen(true);
  };

  const handleCloseAISettings = () => {
    navStack.pop('modal-ai-settings');
    setIsAISettingsOpen(false);
  };

  const handleOpenGDriveSettings = () => {
    navStack.push('modal-gdrive-settings', () => setIsGDriveSettingsOpen(false));
    setIsGDriveSettingsOpen(true);
  };

  const handleCloseGDriveSettings = () => {
    navStack.pop('modal-gdrive-settings');
    setIsGDriveSettingsOpen(false);
  };

  const handleOpenArchitect = () => {
    navStack.push('modal-architect', () => setIsArchitectModalOpen(false));
    setIsArchitectModalOpen(true);
  };

  const handleCloseArchitect = () => {
    navStack.pop('modal-architect');
    setIsArchitectModalOpen(false);
  };

  const handleOpenCornerMenu = () => {
    navStack.push('modal-corner-menu', () => setIsCornerMenuOpen(false));
    setIsCornerMenuOpen(true);
  };

  const handleCloseCornerMenu = () => {
    navStack.pop('modal-corner-menu');
    setIsCornerMenuOpen(false);
  };

  const handleOpenPinSetup = () => {
    navStack.push('modal-pin-setup', () => setIsPinModalOpen(false));
    setIsPinModalOpen(true);
  };

  const handleClosePinSetup = () => {
    navStack.pop('modal-pin-setup');
    setIsPinModalOpen(false);
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div
      {...bindEmptyAreaLongPress()}
      className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200"
    >
      {/* 1. Fullscreen Chapter Reader (Distraction-Free Reading Mode with Natural TTS) */}
      {readingChapter && currentBook ? (
        <ChapterReaderView
          chapter={readingChapter}
          bookTitle={currentBook.title}
          allChapters={bookChapters}
          onBack={handleBackFromReader}
          onOpenEditor={(ch) => {
            handleBackFromReader();
            handleOpenEditor(ch);
          }}
          onSwitchChapter={handleSwitchReadingChapter}
        />
      ) : (editingChapter || studioChapter) && currentBook ? (
        <RichTextEditor
          chapter={editingChapter || studioChapter!}
          bookTitle={currentBook.title}
          entities={bookEntities}
          onBack={handleBackFromEditor}
          onChapterUpdated={(updated) => {
            setEditingChapter(updated);
            setStudioChapter(updated);
            triggerRefresh();
          }}
          onSwitchChapter={(newChapter) => {
            setEditingChapter(newChapter);
            setStudioChapter(newChapter);
            triggerRefresh();
          }}
        />
      ) : (
        <>
          {/* 3. Mobile-first Header */}
          <MobileHeader
            currentBook={currentBook}
            onBack={currentBook ? handleBackToHome : undefined}
            onOpenCornerMenu={handleOpenCornerMenu}
          />

          {/* 3. Main Body Container - Compact & Edge-to-Edge on Mobile */}
          <main className="flex-1 w-full max-w-4xl mx-auto px-2.5 sm:px-4 py-3 sm:py-6">
            {!currentBook ? (
              /* Home Screen: Toggle between Dashboard & Works */
              <div className="space-y-4">
                {mainMenu === 'dashboard' ? (
                  <DashboardView
                    books={books}
                    allChapters={allChapters}
                    recentChapter={recentChapter}
                    recentBook={recentBook}
                    chapterCounts={chapterCounts}
                    onSelectBook={handleSelectBook}
                    onResumeChapter={(book, chapter) => {
                      handleSelectBook(book);
                      handleOpenEditor(chapter);
                    }}
                    onOpenCreateModal={() => handleOpenCreateModal('draft')}
                    onOpenStoryArchitect={handleOpenArchitect}
                    onOpenAISettings={handleOpenAISettings}
                    onNavigateToWorks={() => setMainMenu('works')}
                  />
                ) : (
                  <WorksView
                    books={books}
                    chapterCounts={chapterCounts}
                    onSelectBook={handleSelectBook}
                    onOpenCreateModal={handleOpenCreateModal}
                    onOpenStoryArchitect={handleOpenArchitect}
                  />
                )}
              </div>
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
                    onOpenGDriveSettings={handleOpenGDriveSettings}
                  />
                )}

                {activeTab === 'chapters' && (
                  <StoryPlannerView
                    bookId={currentBook.id}
                    book={currentBook}
                    chapters={bookChapters}
                    onOpenEditor={handleOpenChapterStudio}
                    onOpenReader={handleOpenReader}
                    onRefresh={triggerRefresh}
                  />
                )}

                {activeTab === 'world' && (
                  <WorldBuildingView
                    bookId={currentBook.id}
                    bookTitle={currentBook.title}
                    entities={bookEntities}
                    chapters={bookChapters}
                    onRefresh={triggerRefresh}
                  />
                )}

                {activeTab === 'gallery' && (
                  <MediaGalleryView
                    bookId={currentBook.id}
                    mediaList={bookMedia}
                    onRefresh={triggerRefresh}
                    onOpenGDriveSettings={handleOpenGDriveSettings}
                  />
                )}
              </div>
            )}
          </main>

          {/* 4. Bottom Navigation: Switch between Book Workspace tabs or Home (Dashboard/Works) tabs */}
          {currentBook ? (
            <BottomNavigation
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              chapterCount={bookChapters.length}
              entityCount={bookEntities.length}
              mediaCount={bookMedia.length}
            />
          ) : (
            <HomeBottomNavigation
              currentView={mainMenu}
              onChangeView={setMainMenu}
              worksCount={books.length}
            />
          )}

          {/* 5. Create Book Modal (Mobile-first Sheet / Drawer) */}
          <CreateBookModal
            isOpen={isCreateModalOpen}
            initialStatus={createModalInitialStatus}
            onClose={handleCloseCreateModal}
            onSuccess={(newBook) => {
              triggerRefresh();
              setCurrentBook(newBook);
              setActiveTab('chapters');
            }}
          />

          {/* 6. IndexedDB & Cloud Sync Status Modal */}
          <SyncStatusModal
            isOpen={isSyncModalOpen}
            onClose={handleCloseSyncModal}
            onDataChanged={triggerRefresh}
          />

          {/* 7. Multi-AI Settings Modal (Gemini & Groq Fallback) */}
          <AISettingsModal
            isOpen={isAISettingsOpen}
            onClose={handleCloseAISettings}
          />

          {/* 8. AI Story Architect Modal (Idea to Full Project) */}
          <AIStoryArchitectModal
            isOpen={isArchitectModalOpen}
            onClose={handleCloseArchitect}
            onProjectCreated={(newBook) => {
              triggerRefresh();
              handleSelectBook(newBook);
            }}
            onOpenAISettings={handleOpenAISettings}
          />

          {/* Toast Notification for back button exit guard */}
          {toastMessage && (
            <div className="fixed bottom-16 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-slate-900/95 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-none animate-toast-in">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* 9. Top-Right Corner Menu Modal */}
          <AppCornerMenuModal
            isOpen={isCornerMenuOpen}
            onClose={handleCloseCornerMenu}
            onOpenAISettings={handleOpenAISettings}
            onOpenSyncModal={handleOpenSyncModal}
            onOpenPinSetup={handleOpenPinSetup}
            onOpenGDriveSettings={handleOpenGDriveSettings}
            onOpenStoryArchitect={handleOpenArchitect}
          />

          {/* 10. Google Drive Shared Folder Settings Modal */}
          <GDriveSettingsModal
            isOpen={isGDriveSettingsOpen}
            onClose={handleCloseGDriveSettings}
          />

          {/* 11. Dedicated PIN Setup & Security Configuration Modal */}
          <PinSetupModal
            isOpen={isPinModalOpen}
            onClose={handleClosePinSetup}
          />
        </>
      )}

      {/* 🔒 Fullscreen App PIN Lock Vault Screen */}
      <AppLockScreen />
    </div>
  );
}

export default App;

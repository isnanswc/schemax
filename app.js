/**
 * Schemax Story Studio - Core Client-Side Engine
 * 100% Client-Side with Native IndexedDB & Blob Management
 */

// --- 1. IndexedDB Wrapper ---
const DB_NAME = 'SchemaxStoryStudioDB';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('books')) {
        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('status', 'status', { unique: false });
        bookStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('chapters')) {
        const chapStore = db.createObjectStore('chapters', { keyPath: 'id' });
        chapStore.createIndex('bookId', 'bookId', { unique: false });
        chapStore.createIndex('order', 'order', { unique: false });
        chapStore.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('worldEntities')) {
        const entStore = db.createObjectStore('worldEntities', { keyPath: 'id' });
        entStore.createIndex('bookId', 'bookId', { unique: false });
        entStore.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('media')) {
        const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
        mediaStore.createIndex('bookId', 'bookId', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

// Database helper functions
async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function saveMediaBlob(bookId, blob, name, entityId = null) {
  const id = 'med_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const mediaItem = {
    id,
    bookId,
    entityId,
    name: name || 'Gambar',
    mimeType: blob.type || 'image/jpeg',
    blob,
    size: blob.size,
    createdAt: Date.now()
  };
  await dbPut('media', mediaItem);
  return id;
}

// Memory-managed blob URLs cache
const blobUrlCache = new Map();

async function getMediaUrl(mediaId) {
  if (!mediaId) return null;
  if (blobUrlCache.has(mediaId)) return blobUrlCache.get(mediaId);

  const item = await dbGet('media', mediaId);
  if (item && item.blob) {
    const url = URL.createObjectURL(item.blob);
    blobUrlCache.set(mediaId, url);
    return url;
  }
  return null;
}

// Generate SVG blob for presets
function createSvgBlob(text, bgColor, icon = '📖') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgColor}" />
        <stop offset="100%" stop-color="#090d16" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" />
    <g transform="translate(200, 200)">
      <circle r="70" fill="rgba(255,255,255,0.08)" />
      <text font-size="70" text-anchor="middle" dominant-baseline="central">${icon}</text>
    </g>
    <text x="200" y="340" font-family="sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">${text.slice(0, 22)}</text>
    <text x="200" y="375" font-family="sans-serif" font-size="14" fill="rgba(255,255,255,0.6)" text-anchor="middle">SCHEMAX ORIGINAL</text>
  </svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

// Seed sample data if database is empty
async function seedInitialData() {
  const books = await dbGetAll('books');
  if (books.length > 0) return;

  const now = Date.now();
  const book1Id = 'book_sang_penenun';
  const book2Id = 'book_chronicles_eldoria';

  // Seed sample covers & avatars into IndexedDB
  const cover1Blob = createSvgBlob('Sang Penenun Waktu', '#6366f1', '⏳');
  const cover1Id = await saveMediaBlob(book1Id, cover1Blob, 'cover-penenun.svg');

  const cover2Blob = createSvgBlob('Chronicles of Eldoria', '#10b981', '⚔️');
  const cover2Id = await saveMediaBlob(book2Id, cover2Blob, 'cover-eldoria.svg');

  const charBlob = createSvgBlob('Kaelen Vane', '#ec4899', '🧙‍♂️');
  const charId = await saveMediaBlob(book1Id, charBlob, 'kaelen-avatar.svg');

  const locBlob = createSvgBlob('Menara Astralis', '#06b6d4', '🏰');
  const locId = await saveMediaBlob(book1Id, locBlob, 'menara-astralis.svg');

  const itemBlob = createSvgBlob('Kristal Chronos', '#eab308', '💎');
  const itemId = await saveMediaBlob(book1Id, itemBlob, 'kristal-chronos.svg');

  // Book 1: Draft
  await dbPut('books', {
    id: book1Id,
    title: 'Sang Penenun Waktu',
    synopsis: 'Di dunia di mana benang takdir dapat dipintal kembali, seorang pemuda dari distrik kumuh menemukan artefak terlarang bernama Chronos.',
    genre: 'Fantasi Sains / Sci-Fi',
    status: 'draft',
    coverMediaId: cover1Id,
    wordCountTarget: 50000,
    currentWordCount: 1420,
    createdAt: now - 86400000 * 3,
    updatedAt: now
  });

  // Book 2: Released
  await dbPut('books', {
    id: book2Id,
    title: 'Chronicles of Eldoria: Babak Terakhir',
    synopsis: 'Kisah penjelajahan lima kesatria penjaga segel kuno untuk menahan kebangkitan naga api di belahan benua utara.',
    genre: 'High Fantasy / Epik',
    status: 'released',
    coverMediaId: cover2Id,
    wordCountTarget: 80000,
    currentWordCount: 82500,
    createdAt: now - 86400000 * 30,
    updatedAt: now - 86400000 * 2
  });

  // Chapters for Book 1
  await dbPut('chapters', {
    id: 'chap_1',
    bookId: book1Id,
    title: 'Bab 1: Menara yang Berguncang',
    order: 1,
    status: 'completed',
    premise: 'Kaelen menyaksikan runtuhnya menara jam kota tua dan menemukan pecahan kristal misterius.',
    notes: 'Tekankan atmosfer dingin dan kabut beracun di kota bawah tanah.',
    contentHtml: '<h2>Bab 1: Menara yang Berguncang</h2><p>Hawa dingin merayap perlahan melalui celah-celah dinding bata basah di Distrik Bawah. Kaelen merapatkan jubah lusuhnya, matanya menatap lekat ke puncak Menara Astralis yang menjulang di tengah kabut kelabu.</p><p>Tiba-tiba, denting jam raksasa terdengar berdentang tak lazim. Bukan dua belas kali, melainkan tiga belas kali. Guncangan dahsyat membelah tanah, dan seberkas cahaya emas kebiruan jatuh tepat di hadapannya.</p><blockquote>"Waktu tidak lagi mengalir maju. Ia telah retak."</blockquote><p>Sebuah kristal segi delapan tergeletak di antara puing-puing, berdenyut seirama dengan detak jantungnya.</p>',
    wordCount: 820,
    targetWordCount: 1000,
    createdAt: now - 86400000 * 2,
    updatedAt: now - 86400000 * 2
  });

  await dbPut('chapters', {
    id: 'chap_2',
    bookId: book1Id,
    title: 'Bab 2: Bisikan dari Masa Lalu',
    order: 2,
    status: 'in_progress',
    premise: 'Kaelen mencoba meneliti kristal di bengkel rahasianya, lalu dikejar oleh algojo Waktu.',
    notes: 'Perkenalkan karakter Elena sang mekanik.',
    contentHtml: '<h2>Bab 2: Bisikan dari Masa Lalu</h2><p>Di balik pintu besi berkarat bengkel tuanya, lampu pijar berkedip redup. Kaelen meletakkan kristal itu di bawah mikroskop lensa prisma. Jarum pengukur berputar liar seketika.</p><p>Terdengar ketukan keras tiga kali di pintu luar...</p>',
    wordCount: 600,
    targetWordCount: 1500,
    createdAt: now - 86400000,
    updatedAt: now
  });

  await dbPut('chapters', {
    id: 'chap_3',
    bookId: book1Id,
    title: 'Bab 3: Konspirasi Dewan Takdir',
    order: 3,
    status: 'planned',
    premise: 'Pertemuan rahasia dengan kelompok pemberontak Chrono-Rebels.',
    notes: 'Plot twist: kristal tersebut bukan artefak penyelamat, melainkan bom temporal.',
    contentHtml: '',
    wordCount: 0,
    targetWordCount: 2000,
    createdAt: now,
    updatedAt: now
  });

  // Worldbuilding for Book 1
  await dbPut('worldEntities', {
    id: 'ent_kaelen',
    bookId: book1Id,
    category: 'character',
    name: 'Kaelen Vane',
    shortDescription: 'Pemuda yatim piatu berdarah penenun takdir kuno yang bekerja sebagai pemulung komponen mesin.',
    detailedNotes: 'Memiliki bekas luka bakar di tangan kiri yang bereaksi ketika dekat dengan sihir temporal. Sifatnya hati-hati, analitis, namun setia kawan.',
    tags: ['Protagonis', 'Penenun', 'Mekanik'],
    avatarMediaId: charId,
    attributes: [
      { label: 'Usia', value: '20 Tahun' },
      { label: 'Peran', value: 'Protagonis Utama' },
      { label: 'Faksi', value: 'Rakyat Distrik Bawah' },
      { label: 'Kekuatan', value: 'Manipulasi Retakan Detik' }
    ],
    createdAt: now - 86400000 * 2,
    updatedAt: now
  });

  await dbPut('worldEntities', {
    id: 'ent_astralis',
    bookId: book1Id,
    category: 'location',
    name: 'Menara Astralis',
    shortDescription: 'Monumen raksasa dari era kuno yang menopang jam pengatur waktu seluruh kota.',
    detailedNotes: 'Dikelilingi oleh kabut abadi dan dijaga ketat oleh ordo Ksatria Detik.',
    tags: ['Ikonik', 'Pusat Kota', 'Misterius'],
    avatarMediaId: locId,
    attributes: [
      { label: 'Ketinggian', value: '750 Meter' },
      { label: 'Wilayah', value: 'Sektor Pusat Metropolis' },
      { label: 'Bahaya', value: 'Anomali Gravitasi Sedang' }
    ],
    createdAt: now - 86400000,
    updatedAt: now
  });

  await dbPut('worldEntities', {
    id: 'ent_chronos',
    bookId: book1Id,
    category: 'item',
    name: 'Kristal Chronos',
    shortDescription: 'Pecahan inti dari jam purba yang dapat menghentikan waktu selama 7 detik.',
    detailedNotes: 'Setiap kali digunakan, ingatan masa kecil penggunanya akan terkikis sedikit demi sedikit.',
    tags: ['Relik Kuno', 'Legendaris', 'Berbahaya'],
    avatarMediaId: itemId,
    attributes: [
      { label: 'Tipe', value: 'Artefak Temporal Kuno' },
      { label: 'Efek Samping', value: 'Amnesia Parsial' },
      { label: 'Kelangkaan', value: 'Tier S / Unik' }
    ],
    createdAt: now,
    updatedAt: now
  });
}

// --- 2. Application State ---
const state = {
  currentBook: null,
  activeTab: 'chapters', // 'overview' | 'chapters' | 'world' | 'gallery'
  activeCategoryFilter: 'draft', // 'draft' | 'released' | 'all'
  searchQuery: '',
  editingChapter: null,
  selectedWorldCategory: 'all',
  selectedChapterFilter: 'all',
  allBooks: [],
  chapters: [],
  worldEntities: [],
  mediaList: [],
  isSaved: true,
  autoSaveTimer: null,
  fontStyle: 'serif'
};

// --- 3. UI Renderers ---

async function refreshAllData() {
  state.allBooks = await dbGetAll('books');
  if (state.currentBook) {
    // refresh current book
    state.currentBook = (await dbGet('books', state.currentBook.id)) || state.currentBook;
    state.chapters = await dbGetByIndex('chapters', 'bookId', state.currentBook.id);
    state.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
    state.worldEntities = await dbGetByIndex('worldEntities', 'bookId', state.currentBook.id);
    state.mediaList = await dbGetByIndex('media', 'bookId', state.currentBook.id);
  }
  render();
}

function render() {
  const root = document.getElementById('app-root');
  if (!root) return;

  // Render Editor Mode
  if (state.editingChapter) {
    root.innerHTML = renderEditorHtml();
    attachEditorEvents();
    return;
  }

  // Render Main Layout
  root.innerHTML = `
    <!-- Sticky Mobile Header -->
    <header class="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80 px-4 py-3 safe-top">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          ${
            state.currentBook
              ? `
            <button onclick="navigateHome()" class="p-2 -ml-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition" title="Kembali ke Beranda">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            </button>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h1 class="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-md">${escapeHtml(state.currentBook.title)}</h1>
                <span class="inline-block w-2 h-2 rounded-full ${state.currentBook.status === 'released' ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
              </div>
              <p class="text-[11px] text-slate-400 truncate">${escapeHtml(state.currentBook.genre || 'Cerita')} • ${state.currentBook.status === 'released' ? 'Rilis' : 'Draf'}</p>
            </div>
            `
              : `
            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h1 class="text-base font-extrabold text-white tracking-tight">Schemax</h1>
                <span class="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Studio</span>
              </div>
              <p class="text-[10px] text-slate-400 font-medium">Local-First Story & Lore Engine</p>
            </div>
            `
          }
        </div>

        <!-- Right Header Action -->
        <button onclick="openSyncModal()" class="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium active:scale-95 transition shadow-sm">
          <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7zm0 4h16"/></svg>
          <span class="hidden sm:inline">IndexedDB</span>
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>
      </div>
    </header>

    <!-- Main Workspace Container -->
    <main class="flex-1 w-full max-w-4xl mx-auto px-4 py-4 sm:py-6">
      ${
        !state.currentBook
          ? renderDashboardHtml()
          : `
        <div class="space-y-4">
          ${state.activeTab === 'chapters' ? renderChaptersTabHtml() : ''}
          ${state.activeTab === 'world' ? renderWorldTabHtml() : ''}
          ${state.activeTab === 'gallery' ? renderGalleryTabHtml() : ''}
          ${state.activeTab === 'overview' ? renderOverviewTabHtml() : ''}
        </div>
        `
      }
    </main>

    <!-- Bottom Navigation when inside a Book -->
    ${state.currentBook ? renderBottomNavHtml() : ''}

    <!-- Mobile Floating Action Button (FAB) on Home Screen -->
    ${
      !state.currentBook
        ? `
      <div class="fixed bottom-5 right-5 sm:hidden z-30">
        <button onclick="openCreateBookModal('${state.activeCategoryFilter === 'released' ? 'released' : 'draft'}')" class="flex items-center gap-2 py-3 px-4.5 bg-gradient-to-r from-amber-500 to-amber-600 active:scale-95 text-slate-950 font-extrabold rounded-full shadow-xl shadow-amber-500/30 border border-amber-400/50 transition-transform">
          <svg class="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span class="text-xs pr-1 font-bold">Buku Baru</span>
        </button>
      </div>
      `
        : ''
    }
  `;

  // Asynchronously inject blob images into image elements
  loadAllBlobImages();
}

// Render Dashboard View (Draft, Released, All sheets)
function renderDashboardHtml() {
  const draftCount = state.allBooks.filter((b) => b.status === 'draft').length;
  const releasedCount = state.allBooks.filter((b) => b.status === 'released').length;

  const filtered = state.allBooks.filter((book) => {
    const matchesCat =
      state.activeCategoryFilter === 'all' ? true : book.status === state.activeCategoryFilter;
    const matchesQ =
      !state.searchQuery ||
      book.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      (book.synopsis && book.synopsis.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
      (book.genre && book.genre.toLowerCase().includes(state.searchQuery.toLowerCase()));
    return matchesCat && matchesQ;
  });

  return `
    <div class="space-y-5 pb-28">
      <!-- Category Segmented Sheet / Tabs -->
      <div class="bg-slate-900/90 border border-slate-800/80 p-1.5 rounded-2xl shadow-sm">
        <div class="grid grid-cols-3 gap-1.5">
          <button onclick="setCategoryFilter('draft')" class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            state.activeCategoryFilter === 'draft'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Draft</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              state.activeCategoryFilter === 'draft' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
            }">${draftCount}</span>
          </button>

          <button onclick="setCategoryFilter('released')" class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            state.activeCategoryFilter === 'released'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Released</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              state.activeCategoryFilter === 'released' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-300'
            }">${releasedCount}</span>
          </button>

          <button onclick="setCategoryFilter('all')" class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            state.activeCategoryFilter === 'all'
              ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            <span>Semua</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              state.activeCategoryFilter === 'all' ? 'bg-slate-950 text-indigo-400' : 'bg-slate-800 text-slate-300'
            }">${state.allBooks.length}</span>
          </button>
        </div>
      </div>

      <!-- Search & New Book Bar -->
      <div class="flex items-center gap-2.5">
        <div class="relative flex-1">
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input
            type="text"
            value="${escapeHtml(state.searchQuery)}"
            oninput="handleSearch(this.value)"
            placeholder="Cari judul cerita, genre, atau sinopsis..."
            class="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 text-xs sm:text-sm"
          />
        </div>

        <button onclick="openCreateBookModal('${state.activeCategoryFilter === 'released' ? 'released' : 'draft'}')" class="hidden sm:inline-flex items-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition active:scale-95 flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>Buku Baru</span>
        </button>
      </div>

      <!-- Book List / Grid -->
      ${
        filtered.length === 0
          ? `
        <div class="text-center py-16 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/40">
          <div class="w-12 h-12 mx-auto text-slate-600 mb-3 flex items-center justify-center">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          </div>
          <h3 class="text-base font-bold text-white mb-1">
            ${
              state.searchQuery
                ? 'Tidak Ada Cerita yang Cocok'
                : state.activeCategoryFilter === 'draft'
                ? 'Belum Ada Cerita Draft'
                : state.activeCategoryFilter === 'released'
                ? 'Belum Ada Cerita yang Dirilis'
                : 'Belum Ada Cerita'
            }
          </h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
            Mulai buat karya baru Anda, kelola alur naskah, potret karakter, dan worldbuilding di IndexedDB lokal.
          </p>
          <button onclick="openCreateBookModal('${state.activeCategoryFilter === 'released' ? 'released' : 'draft'}')" class="inline-flex items-center gap-2 py-2.5 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition active:scale-95">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Buat Buku Baru (${state.activeCategoryFilter === 'released' ? 'Released' : 'Draft'})</span>
          </button>
        </div>
        `
          : `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          ${filtered.map((book) => renderBookCardHtml(book)).join('')}
        </div>
        `
      }
    </div>
  `;
}

function renderBookCardHtml(book) {
  const isReleased = book.status === 'released';
  return `
    <div onclick="selectBook('${book.id}')" class="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3.5 transition-all duration-200 active:scale-[0.99] cursor-pointer flex gap-4 shadow-sm hover:shadow-lg hover:shadow-black/40">
      <!-- Cover Image Thumbnail -->
      <div class="w-24 sm:w-28 flex-shrink-0">
        <div class="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
          <img data-media-id="${book.coverMediaId || ''}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 133%22><rect width=%22100%22 height=%22133%22 fill=%22%231e293b%22/><text x=%2250%22 y=%2266%22 font-size=%2224%22 text-anchor=%22middle%22 dominant-baseline=%22central%22>📖</text></svg>" alt="${escapeHtml(book.title)}">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"></div>
        </div>
      </div>

      <!-- Info -->
      <div class="flex-1 flex flex-col justify-between min-w-0">
        <div>
          <div class="flex items-center justify-between gap-1.5 mb-1.5">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ${
              isReleased
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }">
              <span class="w-1.5 h-1.5 rounded-full ${isReleased ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
              ${isReleased ? 'Released' : 'Draft'}
            </span>

            <button onclick="event.stopPropagation(); toggleBookStatus('${book.id}')" class="text-[11px] text-slate-500 hover:text-amber-400 transition" title="Ganti status buku">
              ⇄ Ganti
            </button>
          </div>

          <h3 class="font-bold text-base text-white group-hover:text-amber-300 transition-colors line-clamp-1 leading-snug">
            ${escapeHtml(book.title)}
          </h3>

          <p class="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
            ${escapeHtml(book.synopsis || 'Belum ada sinopsis. Klik untuk mulai menulis cerita dan worldbuilding.')}
          </p>
        </div>

        <div class="pt-2 border-t border-slate-800/60 mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <div class="flex items-center gap-2">
            <span class="text-slate-300 font-medium">${escapeHtml(book.genre || 'Fiksi')}</span>
          </div>
          <div class="flex items-center gap-1 text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform text-xs">
            <span>Buka</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Render Plot & Chapters Tab
function renderChaptersTabHtml() {
  const chapters = state.chapters;
  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const completed = chapters.filter((c) => c.status === 'completed').length;

  const filtered = chapters.filter((c) => {
    if (state.selectedChapterFilter === 'all') return true;
    return c.status === state.selectedChapterFilter;
  });

  return `
    <div class="space-y-4 pb-24">
      <!-- Progres Banner -->
      <div class="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <span class="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-0.5">Progres Naskah</span>
          <div class="flex items-baseline gap-2">
            <span class="text-xl sm:text-2xl font-extrabold text-white">${totalWords.toLocaleString()}</span>
            <span class="text-xs text-slate-400">total kata</span>
          </div>
        </div>
        <div class="text-right">
          <span class="text-[11px] font-medium text-slate-400 block mb-0.5">Selesai / Total Bab</span>
          <span class="text-base font-bold text-amber-400">${completed} / ${chapters.length} Bab</span>
        </div>
      </div>

      <!-- Action & Filter Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button onclick="setChapterFilter('all')" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            state.selectedChapterFilter === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }">
            Semua (${chapters.length})
          </button>
          <button onclick="setChapterFilter('planned')" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            state.selectedChapterFilter === 'planned'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }">
            Direncanakan
          </button>
          <button onclick="setChapterFilter('in_progress')" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            state.selectedChapterFilter === 'in_progress'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }">
            Sedang Ditulis
          </button>
          <button onclick="setChapterFilter('completed')" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            state.selectedChapterFilter === 'completed'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }">
            Selesai
          </button>
        </div>

        <button onclick="openAddChapterModal()" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/15 transition flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>Tambah Rencana Bab</span>
        </button>
      </div>

      <!-- Chapters List -->
      ${
        filtered.length === 0
          ? `
        <div class="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <h3 class="text-sm font-bold text-white mb-1">Belum Ada Bab Terdaftar</h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Rancang alur dan adegan ceritamu dengan menekan tombol Tambah Rencana Bab.
          </p>
          <button onclick="openAddChapterModal()" class="inline-flex items-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs border border-slate-700 transition">
            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Mulai Rencana Bab Baru</span>
          </button>
        </div>
        `
          : `
        <div class="space-y-3">
          ${filtered.map((chap, idx) => renderChapterCardHtml(chap, idx)).join('')}
        </div>
        `
      }
    </div>
  `;
}

function renderChapterCardHtml(chap, idx) {
  const statusMeta = {
    planned: { label: 'Direncanakan', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30', dot: 'bg-purple-400' },
    in_progress: { label: 'Sedang Ditulis', bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
    completed: { label: 'Selesai', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' }
  }[chap.status] || { label: 'Direncanakan', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30', dot: 'bg-purple-400' };

  return `
    <div onclick="openEditor('${chap.id}')" class="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 transition-all duration-200 cursor-pointer active:scale-[0.99] shadow-sm flex flex-col justify-between gap-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="text-[11px] font-bold text-amber-400/90 tracking-wide uppercase">Bab ${chap.order || idx + 1}</span>
            <button onclick="event.stopPropagation(); toggleChapterStatus('${chap.id}')" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusMeta.bg} hover:opacity-80 transition" title="Klik untuk ubah status">
              <span class="w-1.5 h-1.5 rounded-full ${statusMeta.dot}"></span>
              <span>${statusMeta.label}</span>
            </button>
          </div>

          <h4 class="font-bold text-base text-white group-hover:text-amber-300 transition-colors line-clamp-1">
            ${escapeHtml(chap.title)}
          </h4>

          ${
            chap.premise
              ? `<p class="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">${escapeHtml(chap.premise)}</p>`
              : ''
          }
        </div>

        <button onclick="event.stopPropagation(); deleteChapter('${chap.id}', '${escapeHtml(chap.title)}')" class="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition" title="Hapus Bab">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>

      <div class="pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span class="font-semibold text-slate-200 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          ${(chap.wordCount || 0).toLocaleString()} kata
        </span>
        <div class="inline-flex items-center gap-1 text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform text-xs">
          <span>Tulis Cerita</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
      </div>
    </div>
  `;
}

// Render Worldbuilding Tab (Characters, Locations, Items, Lore)
function renderWorldTabHtml() {
  const entities = state.worldEntities;
  const filtered = entities.filter((e) => {
    if (state.selectedWorldCategory === 'all') return true;
    return e.category === state.selectedWorldCategory;
  });

  const categories = [
    { id: 'all', label: 'Semua' },
    { id: 'character', label: 'Karakter' },
    { id: 'location', label: 'Lokasi/Latar' },
    { id: 'item', label: 'Item/Relik' },
    { id: 'lore', label: 'Lore/Faksi' }
  ];

  return `
    <div class="space-y-4 pb-24">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <!-- Category Filter -->
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          ${categories
            .map(
              (cat) => `
            <button onclick="setWorldCategory('${cat.id}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                state.selectedWorldCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }">
              ${cat.label} (${
                cat.id === 'all' ? entities.length : entities.filter((e) => e.category === cat.id).length
              })
            </button>
          `
            )
            .join('')}
        </div>

        <button onclick="openAddWorldModal()" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-pink-500/20 transition flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>Tambah Worldbuilding</span>
        </button>
      </div>

      ${
        filtered.length === 0
          ? `
        <div class="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <h3 class="text-sm font-bold text-white mb-1">Belum Ada Entitas di Kategori Ini</h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Kelola ensiklopedia duniamu: karakter, kota, item mistis, atau sejarah kekaisaran.
          </p>
          <button onclick="openAddWorldModal()" class="inline-flex items-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs border border-slate-700 transition">
            <svg class="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Tambah Entitas Sekarang</span>
          </button>
        </div>
        `
          : `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${filtered.map((ent) => renderWorldEntityCardHtml(ent)).join('')}
        </div>
        `
      }
    </div>
  `;
}

function renderWorldEntityCardHtml(ent) {
  const catConfig = {
    character: { label: 'Karakter', badge: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
    location: { label: 'Lokasi/Latar', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    item: { label: 'Item/Relik', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    lore: { label: 'Lore/Faksi', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' }
  }[ent.category] || { label: 'Lore', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };

  return `
    <div class="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-2xl p-4 transition shadow-sm space-y-3">
      <div class="flex items-start gap-3">
        <!-- Visual Avatar from IndexedDB -->
        <div class="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 flex items-center justify-center">
          <img data-media-id="${ent.avatarMediaId || ''}" class="w-full h-full object-cover" src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%231e293b%22/><text x=%2250%22 y=%2255%22 font-size=%2232%22 text-anchor=%22middle%22 dominant-baseline=%22central%22>✨</text></svg>" alt="${escapeHtml(ent.name)}">
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catConfig.badge}">
              ${catConfig.label}
            </span>
            <button onclick="deleteWorldEntity('${ent.id}', '${escapeHtml(ent.name)}')" class="p-1 rounded-lg text-slate-500 hover:text-red-400 transition" title="Hapus">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>

          <h4 class="font-bold text-base text-white truncate">${escapeHtml(ent.name)}</h4>
          ${
            ent.shortDescription
              ? `<p class="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-snug">${escapeHtml(ent.shortDescription)}</p>`
              : ''
          }
        </div>
      </div>

      ${
        ent.attributes && ent.attributes.length > 0
          ? `
        <div class="grid grid-cols-2 gap-1.5 pt-1">
          ${ent.attributes
            .slice(0, 4)
            .map(
              (attr) => `
            <div class="bg-slate-950/70 border border-slate-800/80 rounded-lg px-2.5 py-1 text-[11px] flex items-center justify-between">
              <span class="text-slate-400">${escapeHtml(attr.label)}</span>
              <span class="font-medium text-white truncate max-w-[90px]">${escapeHtml(attr.value)}</span>
            </div>
          `
            )
            .join('')}
        </div>
        `
          : ''
      }

      ${
        ent.detailedNotes
          ? `
        <div class="pt-2 border-t border-slate-800/80 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 leading-relaxed whitespace-pre-wrap">
          ${escapeHtml(ent.detailedNotes)}
        </div>
        `
          : ''
      }

      ${
        ent.tags && ent.tags.length > 0
          ? `
        <div class="flex flex-wrap gap-1 pt-1">
          ${ent.tags.map((t) => `<span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-medium">#${escapeHtml(t)}</span>`).join('')}
        </div>
        `
          : ''
      }
    </div>
  `;
}

// Render Visual Media Gallery Tab
function renderGalleryTabHtml() {
  const mediaList = state.mediaList;
  const totalBytes = mediaList.reduce((acc, m) => acc + (m.size || 0), 0);
  const totalFormatted =
    totalBytes < 1024 * 1024
      ? (totalBytes / 1024).toFixed(1) + ' KB'
      : (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';

  return `
    <div class="space-y-4 pb-24">
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-white leading-tight">Penyimpanan Gambar (IndexedDB)</h3>
            <p class="text-xs text-slate-400">${mediaList.length} media tersimpan • Total ${totalFormatted}</p>
          </div>
        </div>

        <label class="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>Unggah Gambar Baru</span>
          <input type="file" accept="image/*" multiple onchange="handleGalleryUpload(event)" class="hidden" />
        </label>
      </div>

      ${
        mediaList.length === 0
          ? `
        <div class="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <h3 class="text-sm font-bold text-white mb-1">Galeri Visual Masih Kosong</h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Simpan gambar konsep, denah peta dunia, atau visual karakter langsung ke IndexedDB lokal.
          </p>
        </div>
        `
          : `
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          ${mediaList
            .map(
              (m) => `
            <div class="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-sm">
              <img data-media-id="${m.id}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="" alt="${escapeHtml(m.name)}" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 p-2.5 flex flex-col justify-between">
                <div class="flex justify-end">
                  <button onclick="deleteMedia('${m.id}', '${escapeHtml(m.name)}')" class="p-1 rounded-lg bg-black/60 text-slate-300 hover:text-red-400 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
                <div>
                  <p class="text-white text-xs font-semibold truncate leading-tight">${escapeHtml(m.name)}</p>
                  <span class="text-[10px] text-amber-400/90 font-mono">${(m.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        `
      }
    </div>
  `;
}

// Render Book Overview Tab
function renderOverviewTabHtml() {
  const book = state.currentBook;
  const chapters = state.chapters;
  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const targetWords = book.wordCountTarget || 50000;
  const progressPercent = Math.min(100, Math.round((totalWords / targetWords) * 100));

  return `
    <div class="space-y-5 pb-28">
      <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-md flex flex-col sm:flex-row gap-5">
        <div class="w-32 sm:w-40 mx-auto sm:mx-0 flex-shrink-0 flex flex-col items-center gap-2">
          <div class="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl">
            <img data-media-id="${book.coverMediaId || ''}" class="w-full h-full object-cover" src="" alt="${escapeHtml(book.title)}">
          </div>
          <label class="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline flex items-center gap-1">
            <span>Ganti Sampul</span>
            <input type="file" accept="image/*" onchange="handleCoverChange(event)" class="hidden" />
          </label>
        </div>

        <div class="flex-1 flex flex-col justify-between space-y-3">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">${escapeHtml(book.genre || 'Fiksi')}</span>
              <button onclick="toggleBookStatus('${book.id}')" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition active:scale-95 ${
                book.status === 'released'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }">
                <span class="w-2 h-2 rounded-full ${book.status === 'released' ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
                <span>Status: ${book.status === 'released' ? 'Released' : 'Draft'} (Klik ganti)</span>
              </button>
            </div>

            <h2 class="text-xl sm:text-2xl font-black text-white leading-tight">${escapeHtml(book.title)}</h2>

            <div class="mt-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <span class="text-[11px] text-amber-400 font-bold block mb-1">Sinopsis:</span>
              <p class="text-xs text-slate-300 leading-relaxed italic">${escapeHtml(book.synopsis || 'Belum ada sinopsis.')}</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
            <button onclick="switchTab('chapters')" class="bg-slate-950/60 hover:bg-slate-950 p-2 rounded-xl border border-slate-800 text-left transition">
              <span class="text-amber-400 text-xs font-semibold block mb-0.5">Bab</span>
              <span class="text-sm font-bold text-white">${chapters.length}</span>
            </button>
            <button onclick="switchTab('world')" class="bg-slate-950/60 hover:bg-slate-950 p-2 rounded-xl border border-slate-800 text-left transition">
              <span class="text-pink-400 text-xs font-semibold block mb-0.5">Lore</span>
              <span class="text-sm font-bold text-white">${state.worldEntities.length}</span>
            </button>
            <button onclick="switchTab('gallery')" class="bg-slate-950/60 hover:bg-slate-950 p-2 rounded-xl border border-slate-800 text-left transition">
              <span class="text-cyan-400 text-xs font-semibold block mb-0.5">Media</span>
              <span class="text-sm font-bold text-white">${state.mediaList.length}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Target Progress -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-white">Target Kata & Capaian</h3>
          <span class="text-xs font-bold text-amber-400">${progressPercent}%</span>
        </div>
        <div class="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
          <div class="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
        </div>
        <div class="flex justify-between items-center text-xs text-slate-400">
          <span>${totalWords.toLocaleString()} kata tertulis</span>
          <span>Target: ${targetWords.toLocaleString()} kata</span>
        </div>
      </div>

      <!-- Backup JSON -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <h4 class="text-xs font-bold text-white">Ekspor & Cadangkan Cerita</h4>
          <p class="text-[11px] text-slate-400">Unduh data JSON lengkap ke memori perangkat lokal</p>
        </div>
        <button onclick="exportBookJson()" class="inline-flex items-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition active:scale-95 border border-slate-700">
          <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          <span>Cadangkan JSON</span>
        </button>
      </div>
    </div>
  `;
}

// Render Thumbs-friendly Bottom Navigation Bar
function renderBottomNavHtml() {
  const tabs = [
    { id: 'chapters', label: 'Plot & Bab', count: state.chapters.length, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'world', label: 'Worldbuilding', count: state.worldEntities.length, icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    { id: 'gallery', label: 'Visual Media', count: state.mediaList.length, icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'overview', label: 'Info Buku', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
  ];

  return `
    <nav class="fixed bottom-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1 safe-bottom sm:max-w-md sm:mx-auto sm:rounded-t-2xl sm:border-x">
      <div class="grid grid-cols-4 gap-1">
        ${tabs
          .map((tab) => {
            const isActive = state.activeTab === tab.id;
            return `
            <button onclick="switchTab('${tab.id}')" class="relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 active:scale-95 ${
              isActive ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }">
              ${isActive ? `<span class="absolute inset-x-2 inset-y-1 bg-amber-500/10 rounded-xl -z-10"></span>` : ''}
              <div class="relative">
                <svg class="w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="${tab.icon}"/></svg>
                ${
                  tab.count !== undefined && tab.count > 0
                    ? `<span class="absolute -top-1.5 -right-2 px-1 py-0.2 min-w-[14px] text-[10px] font-bold rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">${tab.count}</span>`
                    : ''
                }
              </div>
              <span class="text-[10px] mt-1 tracking-tight truncate max-w-full">${tab.label}</span>
            </button>
          `;
          })
          .join('')}
      </div>
    </nav>
  `;
}

// Render Fullscreen Rich Text Editor (Writer Mode)
function renderEditorHtml() {
  const chap = state.editingChapter;
  const book = state.currentBook;
  const words = chap.wordCount || 0;
  const readTime = Math.ceil(words / 200);

  return `
    <div class="fixed inset-0 z-50 bg-slate-950 flex flex-col text-slate-100">
      <!-- Editor Top Bar -->
      <header class="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 z-20">
        <div class="flex items-center gap-2 min-w-0">
          <button onclick="closeEditor()" class="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition active:scale-95" title="Kembali">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </button>
          <div class="min-w-0">
            <p class="text-[11px] text-amber-400 font-semibold truncate">${escapeHtml(book.title)}</p>
            <h2 class="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-md">${escapeHtml(chap.title)}</h2>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <select id="editor-status-select" onchange="handleEditorStatusChange(this.value)" class="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-400 font-medium">
            <option value="planned" ${chap.status === 'planned' ? 'selected' : ''}>Direncanakan</option>
            <option value="in_progress" ${chap.status === 'in_progress' ? 'selected' : ''}>Sedang Ditulis</option>
            <option value="completed" ${chap.status === 'completed' ? 'selected' : ''}>Selesai</option>
          </select>

          <span id="save-status-badge" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span class="hidden sm:inline">Tersimpan</span>
          </span>

          <button onclick="toggleEditorFont()" class="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition hidden sm:flex items-center" title="Ganti Font Serif / Sans">
            <span class="text-xs font-bold">Aa</span>
          </button>
        </div>
      </header>

      <!-- Formatting Toolbar -->
      <div class="w-full bg-slate-900 border-b border-slate-800/80 px-3 py-2 flex items-center gap-1 overflow-x-auto no-scrollbar z-10">
        <div class="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60 flex-shrink-0">
          <button type="button" onclick="formatDoc('bold')" class="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition" title="Tebal (Ctrl+B)">
            <svg class="w-4 h-4 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>
          </button>
          <button type="button" onclick="formatDoc('italic')" class="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition" title="Miring (Ctrl+I)">
            <svg class="w-4 h-4 italic" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 0h-6m2 16h-6"/></svg>
          </button>
          <button type="button" onclick="formatDoc('underline')" class="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition" title="Garis Bawah (Ctrl+U)">
            <span class="text-xs font-bold underline px-1">U</span>
          </button>
        </div>

        <div class="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60 flex-shrink-0">
          <button type="button" onclick="formatDoc('formatBlock', '<h2>')" class="px-2.5 py-1 text-xs font-extrabold text-slate-300 hover:bg-slate-800 rounded-lg transition" title="Judul Bab (H2)">
            H2
          </button>
          <button type="button" onclick="formatDoc('formatBlock', '<h3>')" class="px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition" title="Subjudul (H3)">
            H3
          </button>
          <button type="button" onclick="formatDoc('formatBlock', '<blockquote>')" class="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition" title="Kutipan">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </button>
        </div>

        <div class="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60 flex-shrink-0">
          <button type="button" onclick="formatDoc('insertUnorderedList')" class="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition" title="Daftar Poin">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <button type="button" onclick="formatDoc('insertOrderedList')" class="px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition" title="Daftar Nomor">
            1. 2.
          </button>
          <button type="button" onclick="formatDoc('insertHorizontalRule')" class="px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition" title="Pemisah Adegan">
            ***
          </button>
        </div>

        <div class="flex items-center gap-1 ml-auto flex-shrink-0">
          <button type="button" onclick="formatDoc('undo')" class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Undo">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
          </button>
          <button type="button" onclick="formatDoc('redo')" class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Redo">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/></svg>
          </button>
        </div>
      </div>

      <!-- Editor Content Canvas -->
      <div class="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex justify-center bg-slate-950">
        <div class="w-full max-w-2xl flex flex-col">
          <input
            id="editor-title-input"
            type="text"
            value="${escapeHtml(chap.title)}"
            oninput="handleEditorTitleChange(this.value)"
            placeholder="Judul Bab Cerita..."
            class="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-white placeholder-slate-600 focus:outline-none border-b border-slate-800/80 pb-3 mb-4 tracking-tight"
          />

          ${
            chap.premise
              ? `
            <div class="mb-6 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs text-slate-400">
              <span class="font-semibold text-amber-400/90 block mb-1">📌 Catatan Premis Alur:</span>
              <p class="italic">${escapeHtml(chap.premise)}</p>
            </div>
          `
              : ''
          }

          <div
            id="editor-canvas"
            contenteditable="true"
            data-placeholder="Mulai tulis adegan ceritamu di sini..."
            class="flex-1 min-h-[55vh] text-slate-200 text-base sm:text-lg leading-relaxed focus:outline-none pb-28 ${
              state.fontStyle === 'serif' ? 'font-serif' : 'font-sans'
            }"
          ></div>
        </div>
      </div>

      <!-- Bottom Floating Counts -->
      <footer class="sticky bottom-0 z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <div class="flex items-center gap-3">
          <span class="font-semibold text-white">
            <span id="editor-word-count">${words.toLocaleString()}</span> <span class="font-normal text-slate-400">kata</span>
          </span>
          <span class="text-slate-600">•</span>
          <span class="hidden sm:inline-flex items-center gap-1 text-slate-400">
            ~<span id="editor-read-time">${readTime}</span> menit baca
          </span>
        </div>
        <div class="text-[11px] text-slate-400">
          Target: <span class="font-semibold text-slate-300">${chap.targetWordCount || 1500} kata</span>
        </div>
      </footer>
    </div>
  `;
}

function attachEditorEvents() {
  const canvas = document.getElementById('editor-canvas');
  if (canvas && state.editingChapter) {
    canvas.innerHTML = state.editingChapter.contentHtml || '';
    canvas.addEventListener('input', () => {
      triggerAutoSave();
    });
  }
}

function triggerAutoSave() {
  const badge = document.getElementById('save-status-badge');
  if (badge) {
    badge.className =
      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse';
    badge.innerHTML = `<span>Menyimpan...</span>`;
  }

  updateWordCountsFromCanvas();

  if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = setTimeout(() => {
    saveEditorToDB();
  }, 1000);
}

function updateWordCountsFromCanvas() {
  const canvas = document.getElementById('editor-canvas');
  if (!canvas) return;
  const text = (canvas.innerText || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const wordEl = document.getElementById('editor-word-count');
  const readEl = document.getElementById('editor-read-time');
  if (wordEl) wordEl.innerText = words.toLocaleString();
  if (readEl) readEl.innerText = Math.ceil(words / 200).toString();
}

async function saveEditorToDB() {
  const canvas = document.getElementById('editor-canvas');
  const titleInput = document.getElementById('editor-title-input');
  if (!canvas || !state.editingChapter) return;

  const html = canvas.innerHTML;
  const title = titleInput ? titleInput.value.trim() : state.editingChapter.title;
  const text = (canvas.innerText || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  state.editingChapter.title = title;
  state.editingChapter.contentHtml = html;
  state.editingChapter.wordCount = words;
  state.editingChapter.updatedAt = Date.now();

  await dbPut('chapters', state.editingChapter);

  const badge = document.getElementById('save-status-badge');
  if (badge) {
    badge.className =
      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    badge.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
      <span class="hidden sm:inline">Tersimpan</span>
    `;
  }
}

function formatDoc(cmd, val = null) {
  document.execCommand(cmd, false, val);
  triggerAutoSave();
}

// Asynchronously load and attach Object URLs for all `data-media-id` elements
async function loadAllBlobImages() {
  const imgs = document.querySelectorAll('img[data-media-id]');
  for (const img of imgs) {
    const mediaId = img.getAttribute('data-media-id');
    if (mediaId) {
      const url = await getMediaUrl(mediaId);
      if (url) {
        img.src = url;
      }
    }
  }
}

// --- 4. User Interaction Handlers ---

window.setCategoryFilter = function (cat) {
  state.activeCategoryFilter = cat;
  render();
};

window.handleSearch = function (q) {
  state.searchQuery = q;
  render();
};

window.selectBook = function (bookId) {
  const book = state.allBooks.find((b) => b.id === bookId);
  if (book) {
    state.currentBook = book;
    state.activeTab = 'chapters';
    refreshAllData();
  }
};

window.navigateHome = function () {
  state.currentBook = null;
  state.editingChapter = null;
  refreshAllData();
};

window.switchTab = function (tab) {
  state.activeTab = tab;
  render();
};

window.setChapterFilter = function (filter) {
  state.selectedChapterFilter = filter;
  render();
};

window.setWorldCategory = function (cat) {
  state.selectedWorldCategory = cat;
  render();
};

window.toggleBookStatus = async function (bookId) {
  const book = await dbGet('books', bookId);
  if (!book) return;
  const newStatus = book.status === 'draft' ? 'released' : 'draft';
  book.status = newStatus;
  book.updatedAt = Date.now();
  await dbPut('books', book);
  await refreshAllData();
};

window.toggleChapterStatus = async function (chapId) {
  const chap = await dbGet('chapters', chapId);
  if (!chap) return;
  const next = { planned: 'in_progress', in_progress: 'completed', completed: 'planned' };
  chap.status = next[chap.status] || 'planned';
  chap.updatedAt = Date.now();
  await dbPut('chapters', chap);
  await refreshAllData();
};

window.deleteChapter = async function (id, title) {
  if (confirm(`Hapus bab "${title}"?`)) {
    await dbDelete('chapters', id);
    await refreshAllData();
  }
};

window.deleteWorldEntity = async function (id, name) {
  if (confirm(`Hapus entitas "${name}" dari worldbuilding?`)) {
    await dbDelete('worldEntities', id);
    await refreshAllData();
  }
};

window.deleteMedia = async function (id, name) {
  if (confirm(`Hapus gambar "${name}" dari IndexedDB?`)) {
    await dbDelete('media', id);
    await refreshAllData();
  }
};

window.openEditor = function (chapId) {
  const chap = state.chapters.find((c) => c.id === chapId);
  if (chap) {
    state.editingChapter = chap;
    render();
  }
};

window.closeEditor = async function () {
  await saveEditorToDB();
  state.editingChapter = null;
  await refreshAllData();
};

window.handleEditorTitleChange = function (val) {
  if (state.editingChapter) {
    state.editingChapter.title = val;
    triggerAutoSave();
  }
};

window.handleEditorStatusChange = function (val) {
  if (state.editingChapter) {
    state.editingChapter.status = val;
    triggerAutoSave();
  }
};

window.toggleEditorFont = function () {
  state.fontStyle = state.fontStyle === 'serif' ? 'sans' : 'serif';
  const canvas = document.getElementById('editor-canvas');
  if (canvas) {
    canvas.className = canvas.className.replace(/font-(serif|sans)/, `font-${state.fontStyle}`);
  }
};

window.exportBookJson = function () {
  const data = {
    book: state.currentBook,
    chapters: state.chapters,
    worldEntities: state.worldEntities,
    exportedAt: new Date().toISOString(),
    app: 'Schemax Story Studio'
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.currentBook.title.replace(/[^a-zA-Z0-9]/g, '_')}_cadangan.json`;
  a.click();
  URL.revokeObjectURL(url);
};

window.handleCoverChange = async function (e) {
  const file = e.target.files && e.target.files[0];
  if (!file || !state.currentBook) return;
  const mediaId = await saveMediaBlob(state.currentBook.id, file, file.name);
  state.currentBook.coverMediaId = mediaId;
  state.currentBook.updatedAt = Date.now();
  await dbPut('books', state.currentBook);
  await refreshAllData();
};

window.handleGalleryUpload = async function (e) {
  const files = e.target.files;
  if (!files || !state.currentBook) return;
  for (let i = 0; i < files.length; i++) {
    await saveMediaBlob(state.currentBook.id, files[i], files[i].name);
  }
  await refreshAllData();
};

// --- 5. Modals Management ---

window.openCreateBookModal = function (initialStatus = 'draft') {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
          <div>
            <h2 class="text-base font-bold text-white">Buat Buku / Cerita Baru</h2>
            <p class="text-xs text-slate-400">Tersimpan di IndexedDB Lokal</p>
          </div>
          <button onclick="closeModal()" class="p-1.5 rounded-full text-slate-400 hover:text-white">✕</button>
        </div>

        <form id="create-book-form" onsubmit="handleCreateBookSubmit(event)" class="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Status Karya *</label>
            <div class="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <label class="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold cursor-pointer transition">
                <input type="radio" name="book_status" value="draft" ${initialStatus === 'draft' ? 'checked' : ''} class="hidden peer" />
                <span class="w-full py-1.5 rounded-md text-center peer-checked:bg-amber-500/20 peer-checked:text-amber-300 peer-checked:border peer-checked:border-amber-500/40 text-slate-400">
                  Draft (Draf)
                </span>
              </label>
              <label class="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold cursor-pointer transition">
                <input type="radio" name="book_status" value="released" ${initialStatus === 'released' ? 'checked' : ''} class="hidden peer" />
                <span class="w-full py-1.5 rounded-md text-center peer-checked:bg-emerald-500/20 peer-checked:text-emerald-300 peer-checked:border peer-checked:border-emerald-500/40 text-slate-400">
                  Released (Rilis)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Judul Buku *</label>
            <input type="text" name="title" required placeholder="Contoh: Sang Penjelajah Bintang" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Sampul Buku (Visual Media)</label>
            <input type="file" id="book-cover-input" accept="image/*" class="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700" />
            <p class="text-[10px] text-slate-500 mt-1">Disimpan sebagai biner Blob langsung di IndexedDB lokal.</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Genre</label>
            <select name="genre" class="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm">
              <option>Fantasi / Isekai</option>
              <option>Sci-Fi / Cyberpunk</option>
              <option>Romansa / Drama</option>
              <option>Misteri / Thriller</option>
              <option>Horor / Supernatural</option>
              <option>Fiksi Sejarah</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Sinopsis / Premis Singkat</label>
            <textarea name="synopsis" rows="3" placeholder="Garis besar kisah..." class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm resize-none"></textarea>
          </div>

          <div class="pt-2">
            <button type="submit" class="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition">
              Simpan Buku Baru
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
};

window.handleCreateBookSubmit = async function (e) {
  e.preventDefault();
  const form = e.target;
  const title = form.title.value.trim();
  const status = form.book_status.value;
  const genre = form.genre.value;
  const synopsis = form.synopsis.value.trim();
  const coverInput = document.getElementById('book-cover-input');

  const bookId = 'book_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  let coverMediaId = null;

  if (coverInput && coverInput.files && coverInput.files[0]) {
    coverMediaId = await saveMediaBlob(bookId, coverInput.files[0], coverInput.files[0].name);
  } else {
    const color = status === 'released' ? '#059669' : '#6366f1';
    const svgBlob = createSvgBlob(title, color, '📖');
    coverMediaId = await saveMediaBlob(bookId, svgBlob, `${title}-cover.svg`);
  }

  const newBook = {
    id: bookId,
    title,
    synopsis,
    genre,
    status,
    coverMediaId,
    wordCountTarget: 50000,
    currentWordCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await dbPut('books', newBook);
  closeModal();
  state.currentBook = newBook;
  state.activeTab = 'chapters';
  await refreshAllData();
};

window.openAddChapterModal = function () {
  const modalContainer = document.getElementById('modal-container');
  const nextOrder = state.chapters.length + 1;
  modalContainer.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="w-full sm:max-w-md max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
          <div>
            <h2 class="text-base font-bold text-white">Tambah Rencana Bab</h2>
            <p class="text-xs text-slate-400">Rancang alur & premis adegan</p>
          </div>
          <button onclick="closeModal()" class="p-1.5 rounded-full text-slate-400 hover:text-white">✕</button>
        </div>

        <form onsubmit="handleAddChapterSubmit(event)" class="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Judul Bab / Scene *</label>
            <input type="text" name="title" required value="Bab ${nextOrder}: " class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Premis / Alur Utama</label>
            <textarea name="premise" rows="3" placeholder="Apa peristiwa penting yang terjadi di bab ini?" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm resize-none"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Target Kata</label>
              <input type="number" name="target" value="1500" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Status Awal</label>
              <select name="status" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm">
                <option value="planned">Direncanakan</option>
                <option value="in_progress">Sedang Ditulis</option>
                <option value="completed">Selesai</option>
              </select>
            </div>
          </div>

          <div class="pt-2">
            <button type="submit" class="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-500/25 transition">
              Simpan Rencana Bab
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
};

window.handleAddChapterSubmit = async function (e) {
  e.preventDefault();
  const form = e.target;
  const title = form.title.value.trim();
  const premise = form.premise.value.trim();
  const target = parseInt(form.target.value) || 1500;
  const status = form.status.value;

  const chapId = 'chap_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const newChap = {
    id: chapId,
    bookId: state.currentBook.id,
    title,
    order: state.chapters.length + 1,
    status,
    premise,
    notes: '',
    contentHtml: '',
    wordCount: 0,
    targetWordCount: target,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await dbPut('chapters', newChap);
  closeModal();
  await refreshAllData();
};

window.openAddWorldModal = function () {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="w-full sm:max-w-md max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
          <div>
            <h2 class="text-base font-bold text-white">Tambah World Building</h2>
            <p class="text-xs text-slate-400">Karakter, lokasi, item, atau lore</p>
          </div>
          <button onclick="closeModal()" class="p-1.5 rounded-full text-slate-400 hover:text-white">✕</button>
        </div>

        <form onsubmit="handleAddWorldSubmit(event)" class="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Kategori *</label>
            <select name="category" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm">
              <option value="character">🧙 Karakter (Character)</option>
              <option value="location">🏰 Lokasi / Latar (Setting)</option>
              <option value="item">⚔️ Item / Relik (Artifact)</option>
              <option value="lore">📜 Lore / Fakta (Faction/Magic)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Nama Entitas *</label>
            <input type="text" name="name" required placeholder="Contoh: Raden Kaelen, Hutan Bayangan" class="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Foto Visual / Avatar (IndexedDB)</label>
            <input type="file" id="world-avatar-input" accept="image/*" class="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Deskripsi Singkat / Peran</label>
            <input type="text" name="shortDesc" placeholder="Contoh: Sang penempa dari klan timur" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Catatan Lore Mendalam</label>
            <textarea name="notes" rows="3" placeholder="Kisah sejarah, motivasi, atau rahasia..." class="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm resize-none"></textarea>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Tags (Pisahkan koma)</label>
            <input type="text" name="tags" placeholder="Protagonis, Sihir, Penjaga" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm" />
          </div>

          <div class="pt-2">
            <button type="submit" class="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 text-white font-bold rounded-xl text-sm shadow-lg shadow-pink-500/25 transition">
              Simpan ke Worldbuilding
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
};

window.handleAddWorldSubmit = async function (e) {
  e.preventDefault();
  const form = e.target;
  const category = form.category.value;
  const name = form.name.value.trim();
  const shortDescription = form.shortDesc.value.trim();
  const detailedNotes = form.notes.value.trim();
  const tags = form.tags.value.split(',').map((t) => t.trim()).filter(Boolean);
  const avatarInput = document.getElementById('world-avatar-input');

  const entId = 'ent_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  let avatarMediaId = null;

  if (avatarInput && avatarInput.files && avatarInput.files[0]) {
    avatarMediaId = await saveMediaBlob(state.currentBook.id, avatarInput.files[0], avatarInput.files[0].name, entId);
  } else {
    const iconMap = { character: '🧙‍♂️', location: '🏰', item: '💎', lore: '📜' };
    const colorMap = { character: '#ec4899', location: '#06b6d4', item: '#eab308', lore: '#8b5cf6' };
    const svgBlob = createSvgBlob(name, colorMap[category] || '#6366f1', iconMap[category] || '✨');
    avatarMediaId = await saveMediaBlob(state.currentBook.id, svgBlob, `${name}-avatar.svg`, entId);
  }

  const newEntity = {
    id: entId,
    bookId: state.currentBook.id,
    category,
    name,
    shortDescription,
    detailedNotes,
    tags,
    avatarMediaId,
    attributes: [
      { label: 'Kategori', value: category },
      { label: 'Status', value: 'Aktif' }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await dbPut('worldEntities', newEntity);
  closeModal();
  await refreshAllData();
};

window.openSyncModal = async function () {
  const books = await dbGetAll('books');
  const chapters = await dbGetAll('chapters');
  const entities = await dbGetAll('worldEntities');
  const media = await dbGetAll('media');
  const totalBytes = media.reduce((sum, m) => sum + (m.size || 0), 0);
  const mediaMb = (totalBytes / (1024 * 1024)).toFixed(1);

  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="w-full sm:max-w-md max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
          <div>
            <h2 class="text-base font-bold text-white">Penyimpanan & Sinkronisasi</h2>
            <p class="text-xs text-slate-400">Full Client-Side Local-First</p>
          </div>
          <button onclick="closeModal()" class="p-1.5 rounded-full text-slate-400 hover:text-white">✕</button>
        </div>

        <div class="p-5 space-y-4 overflow-y-auto">
          <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <span class="font-bold text-emerald-300 block mb-0.5">🛡️ Mode Offline Aktif</span>
            <p class="text-emerald-200/80 leading-relaxed">
              Seluruh data naskah, bab, worldbuilding, dan visual foto tersimpan aman di browser Anda via <strong>IndexedDB</strong> tanpa memerlukan koneksi server luar.
            </p>
          </div>

          <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Statistik Database Lokal</h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span class="text-slate-400 block text-[11px]">Total Buku</span>
                <span class="text-base font-bold text-white">${books.length}</span>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span class="text-slate-400 block text-[11px]">Bab Cerita</span>
                <span class="text-base font-bold text-white">${chapters.length}</span>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span class="text-slate-400 block text-[11px]">Entitas Lore</span>
                <span class="text-base font-bold text-white">${entities.length}</span>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span class="text-slate-400 block text-[11px]">Media Gambar</span>
                <span class="text-base font-bold text-white">${media.length} (${mediaMb} MB)</span>
              </div>
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
            <span class="font-bold text-indigo-300 block mb-0.5">☁️ Kesiapan Cloud Sync</span>
            <p class="text-indigo-200/80 leading-relaxed">
              Skema data dirancang dengan ID unik berbasis timestamp. Siap dihubungkan ke Supabase, Firebase, CouchDB, atau Google Drive untuk sinkronisasi antar-perangkat.
            </p>
          </div>

          <div class="space-y-2 pt-1">
            <button onclick="exportAllFullBackup()" class="w-full py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 transition">
              <span>Unduh Cadangan Semua Data (JSON)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.exportAllFullBackup = async function () {
  const books = await dbGetAll('books');
  const chapters = await dbGetAll('chapters');
  const entities = await dbGetAll('worldEntities');

  const data = {
    app: 'Schemax Story Studio',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    books,
    chapters,
    entities
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schemax_full_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

window.closeModal = function () {
  const modalContainer = document.getElementById('modal-container');
  if (modalContainer) modalContainer.innerHTML = '';
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- 6. Initialization ---
window.addEventListener('DOMContentLoaded', async () => {
  await seedInitialData();
  await refreshAllData();
});

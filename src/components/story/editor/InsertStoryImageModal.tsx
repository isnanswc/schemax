import React, { useState, useEffect } from 'react';
import {
  X,
  Image as ImageIcon,
  Upload,
  Link2,
  Tag,
  User,
  MapPin,
  Shield,
  Scroll,
  CheckCircle2,
  Check,
  Plus,
  Sparkles,
  RotateCcw,
  Loader2,
  FileText
} from 'lucide-react';
import { WorldEntity, WorldCategory } from '../../../types';
import { db, saveMediaItem } from '../../../db';
import { analyzeImageWithVision, ImageVisionAnalysis } from '../../../services/aiService';

interface InsertStoryImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle?: string;
  chapterTitle?: string;
  chapterId?: string;
  entities: WorldEntity[];
  onInsertImage: (
    imageUrl: string,
    caption: string,
    taggedEntities: Array<{ id: string; name: string; category: WorldCategory }>,
    narrativeSentenceBefore?: string,
    narrativeSentenceAfter?: string
  ) => void;
}

export const InsertStoryImageModal: React.FC<InsertStoryImageModalProps> = ({
  isOpen,
  onClose,
  bookId,
  bookTitle = 'Buku Cerita',
  chapterTitle = 'Bab Ini',
  chapterId,
  entities = [],
  onInsertImage,
}) => {
  const [sourceType, setSourceType] = useState<'upload' | 'url' | 'library'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'all' | WorldCategory>('all');
  const [galleryImages, setGalleryImages] = useState<Array<{ id: string; name: string; url: string; mimeType: string }>>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // AI Vision states
  const [isAnalyzingVision, setIsAnalyzingVision] = useState(false);
  const [visionAnalysis, setVisionAnalysis] = useState<ImageVisionAnalysis | null>(null);
  const [narrativeBefore, setNarrativeBefore] = useState('');
  const [narrativeAfter, setNarrativeAfter] = useState('');
  const [includeNarrativeBefore, setIncludeNarrativeBefore] = useState(true);
  const [includeNarrativeAfter, setIncludeNarrativeAfter] = useState(true);
  const [currentFileBlob, setCurrentFileBlob] = useState<Blob | null>(null);
  const [currentMimeType, setCurrentMimeType] = useState('image/jpeg');

  // Load book media gallery images when modal opens
  useEffect(() => {
    if (isOpen) {
      db.media
        .where('bookId')
        .equals(bookId)
        .toArray()
        .then((items) => {
          const list = items
            .filter((m) => m.mimeType.startsWith('image/'))
            .map((m) => ({
              id: m.id,
              name: m.name,
              mimeType: m.mimeType,
              url: URL.createObjectURL(m.blob),
            }));
          setGalleryImages(list);
        });
    }
  }, [isOpen, bookId]);

  if (!isOpen) return null;

  // Run AI Vision Analysis on an image
  const runVisionAnalysis = async (base64OrBlobUrl: string, mime: string) => {
    if (!base64OrBlobUrl) return;
    setIsAnalyzingVision(true);

    try {
      let base64String = base64OrBlobUrl;
      // If blob URL, convert to base64
      if (base64OrBlobUrl.startsWith('blob:')) {
        const response = await fetch(base64OrBlobUrl);
        const blob = await response.blob();
        base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const analysis = await analyzeImageWithVision(base64String, mime || 'image/jpeg', {
        bookTitle,
        chapterTitle,
        existingEntities: entities.map((e) => ({ id: e.id, name: e.name, category: e.category })),
      });

      setVisionAnalysis(analysis);
      if (analysis.shortDescription && !caption) {
        setCaption(analysis.shortDescription);
      }
      if (analysis.narrativeSentenceBefore) {
        setNarrativeBefore(analysis.narrativeSentenceBefore);
        setIncludeNarrativeBefore(true);
      }
      if (analysis.narrativeSentenceAfter) {
        setNarrativeAfter(analysis.narrativeSentenceAfter);
        setIncludeNarrativeAfter(true);
      }

      // Auto-tag matching entities from worldbuilding
      if (analysis.detectedTags && analysis.detectedTags.length > 0) {
        const lowerDetected = analysis.detectedTags.map((t) => t.toLowerCase());
        const matchingIds = entities
          .filter((ent) => {
            const entName = ent.name.toLowerCase();
            return (
              lowerDetected.some((tag) => tag.includes(entName) || entName.includes(tag)) ||
              (ent.aliases && ent.aliases.some((a) => lowerDetected.includes(a.toLowerCase())))
            );
          })
          .map((e) => e.id);

        if (matchingIds.length > 0) {
          setSelectedEntityIds((prev) => Array.from(new Set([...prev, ...matchingIds])));
        }
      }
    } catch (err: any) {
      console.warn('AI Vision analysis error:', err);
      // Non-blocking error alert
    } finally {
      setIsAnalyzingVision(false);
    }
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Pilih file gambar valid (JPEG, PNG, WebP).');
      return;
    }

    setIsProcessingFile(true);
    setCurrentFileBlob(file);
    setCurrentMimeType(file.type);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImageUrl(base64);
      setIsProcessingFile(false);
      setCaption(file.name.replace(/\.[^/.]+$/, ''));

      // Automatically trigger AI Vision on upload!
      runVisionAnalysis(base64, file.type);
    };
    reader.onerror = () => {
      alert('Gagal membaca file gambar.');
      setIsProcessingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const toggleEntityTag = (entityId: string) => {
    setSelectedEntityIds((prev) =>
      prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId]
    );
  };

  const filteredEntities = entities.filter((e) => {
    if (categoryFilter === 'all') return true;
    return e.category === categoryFilter;
  });

  const handleConfirmInsert = async () => {
    if (!imageUrl.trim()) {
      alert('Pilih atau masukkan gambar terlebih dahulu.');
      return;
    }

    const taggedEntities = entities
      .filter((e) => selectedEntityIds.includes(e.id))
      .map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category,
      }));

    // If this was an uploaded file, save it to db.media so it's in the book/chapter media library!
    if (currentFileBlob) {
      try {
        await saveMediaItem(
          bookId,
          currentFileBlob,
          caption.trim() || 'Gambar Cerita',
          undefined,
          {
            chapterId,
            tags: taggedEntities.map((t) => t.name),
            category: 'scene',
            caption: caption.trim(),
            aiDescription: visionAnalysis?.shortDescription,
            aiNarrativeIntro: narrativeBefore,
          }
        );
      } catch (err) {
        console.warn('Gagal menyimpan media ke database:', err);
      }
    }

    onInsertImage(
      imageUrl,
      caption.trim(),
      taggedEntities,
      includeNarrativeBefore ? narrativeBefore.trim() : undefined,
      includeNarrativeAfter ? narrativeAfter.trim() : undefined
    );

    // Reset state & close
    setImageUrl('');
    setCaption('');
    setVisionAnalysis(null);
    setNarrativeBefore('');
    setNarrativeAfter('');
    setSelectedEntityIds([]);
    onClose();
  };

  const getCategoryIcon = (cat: WorldCategory) => {
    switch (cat) {
      case 'character':
        return User;
      case 'location':
        return MapPin;
      case 'item':
        return Shield;
      case 'lore':
        return Scroll;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 overflow-y-auto animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <ImageIcon className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Sisipkan Gambar Cerita &amp; Analisis AI Vision
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pilih gambar, analisis suasana dengan AI, dan hubungkan dengan Worldbuilding
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => setSourceType('upload')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              sourceType === 'upload'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceType('library')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              sourceType === 'library'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Galeri Buku ({galleryImages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceType('url')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              sourceType === 'url'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Link URL</span>
          </button>
        </div>

        {/* Source Inputs */}
        {sourceType === 'upload' && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center hover:border-amber-500 transition cursor-pointer relative bg-slate-50 dark:bg-slate-800/40">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Upload className="w-7 h-7 mx-auto text-slate-400 mb-1" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isProcessingFile ? 'Memproses gambar...' : 'Klik atau seret file gambar ke sini'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP, GIF</p>
          </div>
        )}

        {sourceType === 'library' && (
          <div>
            {galleryImages.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                Belum ada gambar di galeri buku ini. Silakan gunakan opsi Upload.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1">
                {galleryImages.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setImageUrl(img.url);
                      setCurrentMimeType(img.mimeType || 'image/jpeg');
                      if (!caption) setCaption(img.name);
                      // Trigger vision on selected library image
                      runVisionAnalysis(img.url, img.mimeType);
                    }}
                    className={`relative rounded-xl overflow-hidden border-2 transition active:scale-95 group ${
                      imageUrl === img.url
                        ? 'border-amber-500 ring-2 ring-amber-500/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-20 object-cover" />
                    {imageUrl === img.url && (
                      <span className="absolute top-1 right-1 p-0.5 rounded-full bg-amber-500 text-slate-950 font-bold">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {sourceType === 'url' && (
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              URL Gambar
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/gambar-adegan.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <button
                type="button"
                onClick={() => runVisionAnalysis(imageUrl, 'image/jpeg')}
                disabled={!imageUrl.trim() || isAnalyzingVision}
                className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition disabled:opacity-50 flex items-center gap-1"
                title="Analisis gambar dari URL"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pindai</span>
              </button>
            </div>
          </div>
        )}

        {/* Image Preview & AI Vision Card */}
        {imageUrl && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-44 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
              <img src={imageUrl} alt="Pratinjau" className="max-h-44 object-contain mx-auto" />
              <span className="absolute bottom-1 right-1 px-2 py-0.5 rounded-md bg-black/70 text-white text-[9px] font-semibold">
                Pratinjau
              </span>
            </div>

            {/* AI Vision Panel */}
            <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-amber-500/10 border border-purple-500/25 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Analisis AI Vision &amp; Konteks Narasi
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => runVisionAnalysis(imageUrl, currentMimeType)}
                  disabled={isAnalyzingVision}
                  className="flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
                  title="Pindai ulang gambar dengan AI Vision"
                >
                  <RotateCcw className={`w-3 h-3 ${isAnalyzingVision ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzingVision ? 'Menganalisis...' : 'Analisis Ulang'}</span>
                </button>
              </div>

              {isAnalyzingVision ? (
                <div className="flex items-center gap-2 py-2 text-xs text-purple-600 dark:text-purple-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI Vision sedang membaca objek, suasana &amp; tokoh gambar...</span>
                </div>
              ) : visionAnalysis ? (
                <div className="space-y-2.5 text-xs">
                  {/* Short Vision Summary */}
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 p-2 rounded-xl border border-purple-500/20 leading-relaxed">
                    <strong>Hasil Deteksi Visual:</strong> {visionAnalysis.shortDescription}
                  </div>

                  {/* Narrative Sentence BEFORE Image */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeNarrativeBefore}
                        onChange={(e) => setIncludeNarrativeBefore(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-amber-400"
                      />
                      <span>Sisipkan Kalimat Narasi SEBELUM Gambar:</span>
                    </label>
                    {includeNarrativeBefore && (
                      <textarea
                        value={narrativeBefore}
                        onChange={(e) => setNarrativeBefore(e.target.value)}
                        rows={2}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 italic leading-relaxed"
                        placeholder="Kalimat pengantar narasi sastra sebelum visual..."
                      />
                    )}
                  </div>

                  {/* Narrative Sentence AFTER Image */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeNarrativeAfter}
                        onChange={(e) => setIncludeNarrativeAfter(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-amber-400"
                      />
                      <span>Sisipkan Kalimat Narasi SESUDAH Gambar:</span>
                    </label>
                    {includeNarrativeAfter && (
                      <textarea
                        value={narrativeAfter}
                        onChange={(e) => setNarrativeAfter(e.target.value)}
                        rows={2}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 italic leading-relaxed"
                        placeholder="Kalimat lanjutan narasi sastra sesudah visual..."
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Belum dianalisis dengan AI Vision.</span>
                  <button
                    type="button"
                    onClick={() => runVisionAnalysis(imageUrl, currentMimeType)}
                    className="py-1 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Mulai Pindai AI Vision</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Caption Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
            Keterangan / Caption Gambar
          </label>
          <input
            type="text"
            placeholder="Contoh: Kaelen menatap reruntuhan menara jam tua..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        {/* Worldbuilding Tagging Section */}
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-500" />
              <span>Tag Entitas Worldbuilding</span>
            </label>
            <span className="text-[10px] text-slate-400">
              {selectedEntityIds.length} dipilih
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Pilih karakter, item/relik, lokasi, atau lore yang tampil dalam gambar ini:
          </p>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
            {(['all', 'character', 'item', 'location', 'lore'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`py-1 px-2.5 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat === 'all'
                  ? 'Semua'
                  : cat === 'character'
                  ? 'Karakter'
                  : cat === 'item'
                  ? 'Item/Relik'
                  : cat === 'location'
                  ? 'Lokasi'
                  : 'Lore'}
              </button>
            ))}
          </div>

          {/* Entities Selection Pills */}
          {filteredEntities.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              Belum ada entitas di kategori ini.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
              {filteredEntities.map((ent) => {
                const isSelected = selectedEntityIds.includes(ent.id);
                const IconComp = getCategoryIcon(ent.category);
                return (
                  <button
                    key={ent.id}
                    type="button"
                    onClick={() => toggleEntityTag(ent.id)}
                    className={`py-1 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                        : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <IconComp className="w-3 h-3 text-amber-400" />
                    <span>{ent.name}</span>
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirmInsert}
            disabled={!imageUrl.trim()}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition active:scale-95 disabled:opacity-50 shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Sisipkan ke Naskah</span>
          </button>
        </div>
      </div>
    </div>
  );
};

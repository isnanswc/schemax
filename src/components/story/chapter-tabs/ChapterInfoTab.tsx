import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Clock,
  Target,
  CheckCircle2,
  Calendar,
  Layers,
  Edit3,
  AlignLeft,
  Loader2,
  Image as ImageIcon,
  Upload,
  Check,
  Trash2,
  X
} from 'lucide-react';
import { StoryChapter, ChapterStatus, MediaItem } from '../../../types';
import { db, saveMediaItem } from '../../../db';
import { generateRefinedPremise } from '../../../services/aiService';

interface ChapterInfoTabProps {
  chapter: StoryChapter;
  bookTitle: string;
  contentText: string;
  onUpdateChapter: (fields: Partial<StoryChapter>) => void;
  onNavigateToManuscript: () => void;
}

export const ChapterInfoTab: React.FC<ChapterInfoTabProps> = ({
  chapter,
  bookTitle,
  contentText,
  onUpdateChapter,
  onNavigateToManuscript,
}) => {
  const [premise, setPremise] = useState(chapter.premise || '');
  const [notes, setNotes] = useState(chapter.notes || '');
  const [targetWordCount, setTargetWordCount] = useState(chapter.targetWordCount || 1500);
  const [targetInput, setTargetInput] = useState(String(chapter.targetWordCount || 1500));
  const [status, setStatus] = useState<ChapterStatus>(chapter.status);
  const [isGeneratingPremise, setIsGeneratingPremise] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Chapter Cover States
  const [coverUrl, setCoverUrl] = useState<string | null>(chapter.coverImageUrl || null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [bookMediaItems, setBookMediaItems] = useState<Array<MediaItem & { url: string }>>([]);

  const words = chapter.wordCount || 0;
  const target = targetWordCount || 1500;
  const progressPercent = Math.min(100, Math.round((words / target) * 100));
  const readingTime = Math.ceil(words / 200);

  // Load chapter cover from media table if mediaId exists
  useEffect(() => {
    if (chapter.coverMediaId) {
      db.media.get(chapter.coverMediaId).then((m) => {
        if (m) {
          setCoverUrl(URL.createObjectURL(m.blob));
        }
      });
    } else if (chapter.coverImageUrl) {
      setCoverUrl(chapter.coverImageUrl);
    } else {
      setCoverUrl(null);
    }
  }, [chapter.coverMediaId, chapter.coverImageUrl]);

  // Load existing media items for cover picker
  const loadMediaItems = () => {
    db.media
      .where('bookId')
      .equals(chapter.bookId)
      .toArray()
      .then((items) => {
        const imageItems = items
          .filter((m) => m.mimeType.startsWith('image/'))
          .map((m) => ({
            ...m,
            url: URL.createObjectURL(m.blob),
          }));
        setBookMediaItems(imageItems);
      });
  };

  const handlePremiseChange = (newPremise: string) => {
    setPremise(newPremise);
    onUpdateChapter({ premise: newPremise });
    showSavedIndicator();
  };

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
    onUpdateChapter({ notes: newNotes });
    showSavedIndicator();
  };

  const handleTargetInputChange = (val: string) => {
    setTargetInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setTargetWordCount(parsed);
      onUpdateChapter({ targetWordCount: parsed });
    }
  };

  const handleTargetInputBlur = () => {
    let parsed = parseInt(targetInput, 10);
    if (isNaN(parsed) || parsed <= 0) {
      parsed = 1500;
    }
    setTargetInput(String(parsed));
    setTargetWordCount(parsed);
    onUpdateChapter({ targetWordCount: parsed });
    showSavedIndicator();
  };

  const handleSetTargetPreset = (val: number) => {
    setTargetInput(String(val));
    setTargetWordCount(val);
    onUpdateChapter({ targetWordCount: val });
    showSavedIndicator();
  };

  const handleStatusChange = (newStatus: ChapterStatus) => {
    setStatus(newStatus);
    onUpdateChapter({ status: newStatus });
    showSavedIndicator();
  };

  const showSavedIndicator = () => {
    setSaveStatus('Tersimpan');
    setTimeout(() => setSaveStatus(null), 1500);
  };

  const handleAiRefinePremise = async () => {
    setIsGeneratingPremise(true);
    try {
      const generated = await generateRefinedPremise(
        chapter.title,
        bookTitle,
        contentText,
        premise
      );
      if (generated) {
        setPremise(generated);
        onUpdateChapter({ premise: generated });
        showSavedIndicator();
      }
    } catch (err: any) {
      alert('Gagal membuat premis: ' + (err.message || 'Periksa API Key di AI Config'));
    } finally {
      setIsGeneratingPremise(false);
    }
  };

  // Cover actions
  const handleSelectCoverFromMedia = async (media: MediaItem & { url: string }) => {
    setCoverUrl(media.url);
    await db.chapters.update(chapter.id, {
      coverMediaId: media.id,
      coverImageUrl: media.url,
      updatedAt: Date.now(),
    });
    onUpdateChapter({ coverMediaId: media.id, coverImageUrl: media.url });
    setIsMediaPickerOpen(false);
    showSavedIndicator();
  };

  const handleUploadCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const mediaId = await saveMediaItem(chapter.bookId, file, file.name, undefined, {
        chapterId: chapter.id,
        category: 'cover_chapter',
        caption: `Sampul Bab ${chapter.order}: ${chapter.title}`,
      });
      const objectUrl = URL.createObjectURL(file);
      setCoverUrl(objectUrl);
      await db.chapters.update(chapter.id, {
        coverMediaId: mediaId,
        coverImageUrl: objectUrl,
        updatedAt: Date.now(),
      });
      onUpdateChapter({ coverMediaId: mediaId, coverImageUrl: objectUrl });
      showSavedIndicator();
    } catch (err: any) {
      alert('Gagal mengupload sampul bab: ' + err.message);
    }
  };

  const handleRemoveCover = async () => {
    setCoverUrl(null);
    await db.chapters.update(chapter.id, {
      coverMediaId: undefined,
      coverImageUrl: undefined,
      updatedAt: Date.now(),
    });
    onUpdateChapter({ coverMediaId: undefined, coverImageUrl: undefined });
    showSavedIndicator();
  };

  return (
    <div className="space-y-4 pb-28 max-w-3xl mx-auto animate-fade-in-up px-1 sm:px-2">
      {/* 1. Header Card with Status, Meta & Cover Preview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        {/* Cover Banner if set */}
        {coverUrl && (
          <div className="relative h-44 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 group">
            <img src={coverUrl} alt="Sampul Bab" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
              <span className="text-xs font-bold drop-shadow">Sampul Bab {chapter.order}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    loadMediaItems();
                    setIsMediaPickerOpen(true);
                  }}
                  className="py-1 px-2.5 rounded-xl bg-black/60 hover:bg-black/90 text-white text-[11px] font-bold backdrop-blur-sm border border-white/20 transition"
                >
                  Ganti Sampul
                </button>
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="p-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] transition"
                  title="Hapus Sampul"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <FileText className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Chapter Information
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!coverUrl && (
              <button
                type="button"
                onClick={() => {
                  loadMediaItems();
                  setIsMediaPickerOpen(true);
                }}
                className="py-1 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                <span>+ Sampul Bab</span>
              </button>
            )}

            {saveStatus && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {saveStatus}
              </span>
            )}
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
          Bab {chapter.order}: {chapter.title || 'Bab Tanpa Judul'}
        </h2>

        {/* Status Selector Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Status:</span>
          {(['planned', 'in_progress', 'completed'] as ChapterStatus[]).map((st) => {
            const isActive = status === st;
            const labels: Record<ChapterStatus, string> = {
              planned: 'Direncanakan',
              in_progress: 'Sedang Ditulis',
              completed: 'Selesai',
            };
            return (
              <button
                key={st}
                type="button"
                onClick={() => handleStatusChange(st)}
                className={`py-1 px-3 rounded-xl text-xs font-bold transition active:scale-95 ${
                  isActive
                    ? st === 'completed'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : st === 'in_progress'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-indigo-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Premis & Cerita Singkat Bab Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Premis &amp; Cerita Singkat Bab</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Garis besar apa yang terjadi di bab ini sebagai panduan utama penulisan
            </p>
          </div>

          <button
            type="button"
            onClick={handleAiRefinePremise}
            disabled={isGeneratingPremise}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition active:scale-95 flex-shrink-0 disabled:opacity-50"
            title="Gunakan AI untuk membuat atau memoles premis bab"
          >
            {isGeneratingPremise ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span className="hidden xs:inline">Membuat...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Premis</span>
              </>
            )}
          </button>
        </div>

        <textarea
          value={premise}
          onChange={(e) => handlePremiseChange(e.target.value)}
          placeholder="Contoh: Sang protagonis tiba di pelabuhan rahasia dan menyadari bahwa kapal pedagang telah dibakar oleh armada musuh sebelum ia sempat menaiki kapal..."
          rows={3}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition leading-relaxed resize-y"
        />
      </div>

      {/* 3. Target & Momentum Penulisan */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Target className="w-4 h-4 text-amber-500" />
            <span>Target &amp; Momentum Penulisan</span>
          </h3>
          <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
            {words} / {target} kata ({progressPercent}%)
          </span>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-400 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-center">
          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block">Waktu Baca</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">~{readingTime} menit</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block">Status Naskah</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{words > 0 ? 'Ada Naskah' : 'Kosong'}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1 flex flex-col items-center justify-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Target:</span>
              <input
                type="number"
                value={targetInput}
                onChange={(e) => handleTargetInputChange(e.target.value)}
                onBlur={handleTargetInputBlur}
                className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-[10px] text-slate-400">kata</span>
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-1 pt-0.5 flex-wrap justify-center">
              {[1000, 1500, 2500, 4000].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSetTargetPreset(num)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition active:scale-95 ${
                    targetWordCount === num
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {num >= 1000 ? `${num / 1000}k` : num}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Catatan Penulis / Outline Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <AlignLeft className="w-4 h-4 text-indigo-500" />
          <span>Catatan Rahasia &amp; Pengingat Bab</span>
        </h3>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Tuliskan catatan penting, poin plot twist, atau pesan yang harus diingat saat menulis bab ini..."
          rows={3}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition leading-relaxed resize-y"
        />
      </div>

      {/* 5. CTA Masuk ke Naskah Utama */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onNavigateToManuscript}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 active:scale-95 transition flex items-center justify-center gap-2"
        >
          <Edit3 className="w-4 h-4" />
          <span>Buka Naskah Utama &amp; Mulai Menulis</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 🖼️ MODAL MEDIA PICKER UNTUK SAMPUL BAB                                    */}
      {/* ========================================================================= */}
      {isMediaPickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in"
          onClick={() => setIsMediaPickerOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 overflow-y-auto animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
                  <ImageIcon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Pilih Sampul Bab {chapter.order}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pilih dari gambar yang sudah ada di galeri atau upload file baru
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upload New Button */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20">
              <div className="text-xs">
                <p className="font-bold text-amber-900 dark:text-amber-200">Upload Sampul Baru dari Perangkat</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-300">File PNG, JPG, WebP</p>
              </div>
              <label className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleUploadCoverFile} className="hidden" />
              </label>
            </div>

            {/* Existing Media Grid */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Atau Pilih dari Galeri Buku ({bookMediaItems.length}):
              </span>

              {bookMediaItems.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  Belum ada gambar yang diunggah di buku ini.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                  {bookMediaItems.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => handleSelectCoverFromMedia(img)}
                      className="relative rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-amber-500 transition group active:scale-95"
                    >
                      <img src={img.url} alt={img.name} className="w-full h-24 object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
                          Pilih
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  FileEdit,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  BookOpen,
  Loader2
} from 'lucide-react';
import { StoryChapter, ChapterRawDraft } from '../../../types';
import { generateWithSmartFallback } from '../../../services/aiService';

interface ChapterRawDraftsTabProps {
  chapter: StoryChapter;
  bookTitle: string;
  onUpdateChapter: (fields: Partial<StoryChapter>) => void;
  onAppendToManuscript: (text: string) => void;
  onNavigateToManuscript: () => void;
}

export const ChapterRawDraftsTab: React.FC<ChapterRawDraftsTabProps> = ({
  chapter,
  bookTitle,
  onUpdateChapter,
  onAppendToManuscript,
  onNavigateToManuscript,
}) => {
  const initialDrafts: ChapterRawDraft[] =
    chapter.rawDrafts && chapter.rawDrafts.length > 0
      ? chapter.rawDrafts
      : [
          {
            id: 'raw_' + Date.now().toString(36),
            title: 'Coretan Utama',
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];

  const [drafts, setDrafts] = useState<ChapterRawDraft[]>(initialDrafts);
  const [activeDraftId, setActiveDraftId] = useState<string>(
    chapter.activeRawDraftId || initialDrafts[0]?.id || ''
  );
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState(false);

  const activeDraft = drafts.find((d) => d.id === activeDraftId) || drafts[0];

  const handleContentChange = (newContent: string) => {
    if (!activeDraft) return;
    const updatedDrafts = drafts.map((d) =>
      d.id === activeDraft.id ? { ...d, content: newContent, updatedAt: Date.now() } : d
    );
    setDrafts(updatedDrafts);
    onUpdateChapter({
      rawDrafts: updatedDrafts,
      activeRawDraftId: activeDraft.id,
    });
    showSaveToast();
  };

  const handleTitleChange = (newTitle: string) => {
    if (!activeDraft) return;
    const updatedDrafts = drafts.map((d) =>
      d.id === activeDraft.id ? { ...d, title: newTitle, updatedAt: Date.now() } : d
    );
    setDrafts(updatedDrafts);
    onUpdateChapter({
      rawDrafts: updatedDrafts,
      activeRawDraftId: activeDraft.id,
    });
    showSaveToast();
  };

  const handleAddDraft = () => {
    const newId = 'raw_' + Math.random().toString(36).substring(2, 7) + Date.now().toString(36);
    const newDraft: ChapterRawDraft = {
      id: newId,
      title: `Coretan ${drafts.length + 1}`,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedDrafts = [...drafts, newDraft];
    setDrafts(updatedDrafts);
    setActiveDraftId(newId);
    onUpdateChapter({
      rawDrafts: updatedDrafts,
      activeRawDraftId: newId,
    });
    showSaveToast();
  };

  const handleDeleteDraft = (draftId: string) => {
    if (drafts.length <= 1) {
      alert('Minimal harus memiliki 1 draf kasar.');
      return;
    }
    if (confirm('Hapus draf coretan ini?')) {
      const updatedDrafts = drafts.filter((d) => d.id !== draftId);
      setDrafts(updatedDrafts);
      setActiveDraftId(updatedDrafts[0]?.id || '');
      onUpdateChapter({
        rawDrafts: updatedDrafts,
        activeRawDraftId: updatedDrafts[0]?.id || '',
      });
      showSaveToast();
    }
  };

  const handleCopyToManuscript = () => {
    if (!activeDraft || !activeDraft.content.trim()) {
      alert('Draf kasar masih kosong.');
      return;
    }
    onAppendToManuscript(activeDraft.content);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  const handlePolishWithAi = async () => {
    if (!activeDraft || !activeDraft.content.trim()) {
      alert('Tuliskan coretan ide terlebih dahulu sebelum dipoles AI.');
      return;
    }

    setIsPolishing(true);
    try {
      const prompt = `Poles dan kembangkan draf tulisan kasar berikut ini menjadi paragraf narasi sastra Bahasa Indonesia yang kaya deskripsi panca indera, tempo mengalir, dan dialog natural untuk bab "${chapter.title}" di buku "${bookTitle}":

Draf Kasar / Coretan:
"""
${activeDraft.content}
"""

Instruksi:
- Tulis langsung hasil polesannya tanpa kata pengantar atau catatan penutup.
- Pertahankan inti alur dan emosi yang dimaksud oleh penulis.`;

      const res = await generateWithSmartFallback(
        prompt,
        'Anda adalah editor kreatif dan novelis berpengalaman yang ahli memoles ide kasar menjadi prosa sastra yang memukau.'
      );

      if (res.text) {
        handleContentChange(res.text.trim());
      }
    } catch (err: any) {
      alert('Gagal memoles draf: ' + (err.message || 'Periksa API Key di AI Config'));
    } finally {
      setIsPolishing(false);
    }
  };

  const showSaveToast = () => {
    setSaveStatus('Tersimpan');
    setTimeout(() => setSaveStatus(null), 1500);
  };

  const draftWords = activeDraft?.content
    ? activeDraft.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="space-y-4 pb-28 max-w-3xl mx-auto animate-fade-in-up px-1 sm:px-2">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="p-1.5 rounded-xl bg-indigo-500/15 text-indigo-500 font-bold">
              <FileEdit className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Tulisan Kasar & Coretan Mentah
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ruang bebas coretan dialog, gagasan adegan, atau draf alternatif sebelum naskah final
              </p>
            </div>
          </div>

          {saveStatus && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {saveStatus}
            </span>
          )}
        </div>

        {/* Draft Tabs Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {drafts.map((d, idx) => {
            const isActive = d.id === activeDraftId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveDraftId(d.id)}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{d.title || `Draf ${idx + 1}`}</span>
                {d.content.trim() && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleAddDraft}
            className="py-1.5 px-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition flex items-center gap-1 flex-shrink-0 active:scale-95"
            title="Tambah Draf Kasar Baru"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Draft Editor Container */}
      {activeDraft && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
          {/* Draft Title Input & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <input
              type="text"
              value={activeDraft.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Judul Draf Coretan..."
              className="bg-transparent text-sm font-bold text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 border-none p-0 flex-1"
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Polish with AI Button */}
              <button
                type="button"
                onClick={handlePolishWithAi}
                disabled={isPolishing || !activeDraft.content.trim()}
                className="flex items-center gap-1 py-1 px-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition active:scale-95 disabled:opacity-50"
                title="Poles tulisan kasar menjadi kalimat sastra yang mengalir"
              >
                {isPolishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    <span>Memoles...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Poles dengan AI</span>
                  </>
                )}
              </button>

              {/* Copy to Manuscript Button */}
              <button
                type="button"
                onClick={handleCopyToManuscript}
                disabled={!activeDraft.content.trim()}
                className="flex items-center gap-1 py-1 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 disabled:opacity-50 shadow-sm"
                title="Tambahkan coretan ini ke Naskah Utama"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedStatus ? 'Tersalin ke Naskah!' : 'Salin ke Naskah Utama'}</span>
              </button>

              {/* Delete Draft Button */}
              <button
                type="button"
                onClick={() => handleDeleteDraft(activeDraft.id)}
                className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition active:scale-95"
                title="Hapus draf ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Draft Textarea */}
          <textarea
            value={activeDraft.content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Tuliskan coretan ide mentah, alur kasar, percakapan tanpa filter, atau kerangka adegan di sini..."
            rows={12}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition leading-relaxed resize-y font-sans"
          />

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              {draftWords.toLocaleString()} kata • {activeDraft.content.length.toLocaleString()} huruf
            </span>
            <span className="text-[10px] text-slate-400">
              Auto-save ke IndexedDB
            </span>
          </div>
        </div>
      )}

      {/* Bottom CTA to Manuscript */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onNavigateToManuscript}
          className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2"
        >
          <span>Lanjut Menulis di Naskah Utama ✍️</span>
          <ArrowRight className="w-4 h-4 text-amber-400" />
        </button>
      </div>
    </div>
  );
};

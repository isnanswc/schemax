import React, { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { StoryChapter, ChapterStatus } from '../../../types';
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
  const [status, setStatus] = useState<ChapterStatus>(chapter.status);
  const [isGeneratingPremise, setIsGeneratingPremise] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const words = chapter.wordCount || 0;
  const target = targetWordCount || 1500;
  const progressPercent = Math.min(100, Math.round((words / target) * 100));
  const readingTime = Math.ceil(words / 200);

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

  const handleTargetChange = (newTarget: number) => {
    const val = Math.max(100, newTarget);
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

  return (
    <div className="space-y-4 pb-28 max-w-3xl mx-auto animate-fade-in-up px-1 sm:px-2">
      {/* 1. Header Card with Status & Meta */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <FileText className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Chapter Information
            </span>
          </div>
          {saveStatus && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {saveStatus}
            </span>
          )}
        </div>

        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-3">
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
              <span>Premis & Cerita Singkat Bab</span>
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

      {/* 3. Target & Statistik Bab */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Target className="w-4 h-4 text-amber-500" />
            <span>Target & Momentum Penulisan</span>
          </h3>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Target:</span>
            <input
              type="number"
              value={targetWordCount}
              onChange={(e) => handleTargetChange(parseInt(e.target.value) || 1500)}
              step={100}
              min={100}
              className="w-20 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 text-xs font-bold text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
            <span className="text-[11px] text-slate-500 font-semibold">kata</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900 dark:text-white">
              {words.toLocaleString()} <span className="font-normal text-slate-500">/ {target.toLocaleString()} kata</span>
            </span>
            <span className="font-black text-amber-600 dark:text-amber-400">
              {progressPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700/80">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 3 Metrics Pills */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-2.5 text-center">
            <span className="text-[10px] text-slate-500 font-medium block">Total Kata</span>
            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {words.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-2.5 text-center">
            <span className="text-[10px] text-slate-500 font-medium block">Estimasi Waktu</span>
            <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              ~{readingTime} mnt
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-2.5 text-center">
            <span className="text-[10px] text-slate-500 font-medium block">Karakter Teks</span>
            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {contentText.length.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Catatan Khusus Penulis */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2.5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Edit3 className="w-4 h-4 text-indigo-500" />
          <span>Catatan Penulis (Private Author's Notes)</span>
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Catat pengingat alur, petunjuk rahasia, atau rencana dialog penting bab ini
        </p>

        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Tuliskan catatan pribadi bab ini..."
          rows={3}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition leading-relaxed resize-y"
        />
      </div>

      {/* Quick Launch Button to Manuscript */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onNavigateToManuscript}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 transition active:scale-95 flex items-center justify-center gap-2"
        >
          <span>Buka Naskah Utama & Mulai Menulis ✍️</span>
        </button>
      </div>
    </div>
  );
};

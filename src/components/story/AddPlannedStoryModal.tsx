import React, { useState } from 'react';
import { X, Plus, BookOpen, Sparkles } from 'lucide-react';
import { StoryChapter, ChapterStatus } from '../../types';
import { db } from '../../db';

interface AddPlannedStoryModalProps {
  isOpen: boolean;
  bookId: string;
  nextOrder: number;
  onClose: () => void;
  onSuccess: (newChapter: StoryChapter) => void;
}

export const AddPlannedStoryModal: React.FC<AddPlannedStoryModalProps> = ({
  isOpen,
  bookId,
  nextOrder,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('');
  const [notes, setNotes] = useState('');
  const [targetWordCount, setTargetWordCount] = useState('1500');
  const [status, setStatus] = useState<ChapterStatus>('planned');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const chapterId = 'chap_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const newChapter: StoryChapter = {
        id: chapterId,
        bookId,
        title: title.trim(),
        order: nextOrder,
        status,
        premise: premise.trim(),
        notes: notes.trim(),
        contentHtml: '',
        wordCount: 0,
        targetWordCount: parseInt(targetWordCount) || 1500,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.chapters.add(newChapter);
      onSuccess(newChapter);
      onClose();
    } catch (err) {
      console.error('Gagal menambahkan rencana bab:', err);
      alert('Terjadi kesalahan saat menyimpan rencana bab.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Tambah Rencana Cerita / Bab</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Rancang alur & premis sebelum menulis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Judul Bab / Scene *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Bab ${nextOrder}: Kejadian Tak Terduga`}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Premise / Inti Plot Bab Ini
            </label>
            <textarea
              rows={3}
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder="Apa konflik utama atau peristiwa penting yang terjadi di bab ini?"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm resize-none shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Catatan Penulis (Foreshadowing / Worldbuilding)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Jangan lupa singgung rahasia pedang kuno di dialog..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm resize-none shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Kata
              </label>
              <input
                type="number"
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Status Awal
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ChapterStatus)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm shadow-sm"
              >
                <option value="planned">Direncanakan</option>
                <option value="in_progress">Sedang Ditulis</option>
                <option value="completed">Selesai</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Simpan Rencana Bab</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import { EntityCondition } from '../../types';

export interface ConditionMeta {
  id: EntityCondition;
  label: string;
  shortLabel: string;
  badgeClass: string;
  colorHex: string;
  emoji: string;
  description: string;
}

export const ENTITY_CONDITIONS: Record<string, ConditionMeta> = {
  aktif: {
    id: 'aktif',
    label: 'Aktif / Prima',
    shortLabel: 'Aktif',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    colorHex: '#10b981',
    emoji: '🟢',
    description: 'Kondisi sehat walafiat, siap bertindak dan menjalankan peran cerita.',
  },
  luka: {
    id: 'luka',
    label: 'Luka Parah',
    shortLabel: 'Luka',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    colorHex: '#f43f5e',
    emoji: '🩸',
    description: 'Mengalami cedera berat, membutuhkan pertolongan atau pemulihan.',
  },
  gugur: {
    id: 'gugur',
    label: 'Gugur / Tewas',
    shortLabel: 'Gugur',
    badgeClass: 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/30 line-through',
    colorHex: '#64748b',
    emoji: '💀',
    description: 'Telah meninggal dunia dalam alur cerita.',
  },
  hilang: {
    id: 'hilang',
    label: 'Hilang / Lenyap',
    shortLabel: 'Hilang',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
    colorHex: '#0284c7',
    emoji: '🌫️',
    description: 'Keberadaannya tidak diketahui oleh faksi atau karakter lain.',
  },
  berkhianat: {
    id: 'berkhianat',
    label: 'Berkhianat',
    shortLabel: 'Khianat',
    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30',
    colorHex: '#d946ef',
    emoji: '🗡️',
    description: 'Membelot ke kubu musuh atau menusuk dari belakang.',
  },
  terkutuk: {
    id: 'terkutuk',
    label: 'Terkutuk / Sihir',
    shortLabel: 'Terkutuk',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    colorHex: '#a855f7',
    emoji: '🔮',
    description: 'Terikat sihir gelap, kutukan darah, atau pengaruh supernatural.',
  },
  ditawan: {
    id: 'ditawan',
    label: 'Ditawan / Dipenjara',
    shortLabel: 'Ditawan',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    colorHex: '#f59e0b',
    emoji: '⛓️',
    description: 'Ditahan di benteng musuh atau dipenjara tanpa kebebasan.',
  },
  pelarian: {
    id: 'pelarian',
    label: 'Dalam Pelarian',
    shortLabel: 'Buron',
    badgeClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
    colorHex: '#eab308',
    emoji: '🏃',
    description: 'Sedang melarikan diri dari kejaran musuh atau otoritas.',
  },
  koma: {
    id: 'koma',
    label: 'Koma / Tersegel',
    shortLabel: 'Tersegel',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    colorHex: '#6366f1',
    emoji: '❄️',
    description: 'Dalam kondisi tidak sadar diri atau kekuatan tersegel abadi.',
  },
  spesial: {
    id: 'spesial',
    label: 'Kondisi Khusus',
    shortLabel: 'Khusus',
    badgeClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30',
    colorHex: '#ec4899',
    emoji: '⚡',
    description: 'Mengalami kondisi naratif yang unik.',
  },
};

export function getConditionMeta(conditionKey?: string): ConditionMeta {
  if (!conditionKey) return ENTITY_CONDITIONS.aktif;
  const lower = conditionKey.toLowerCase().trim();
  return ENTITY_CONDITIONS[lower] || {
    id: 'spesial',
    label: conditionKey,
    shortLabel: conditionKey.slice(0, 10),
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    colorHex: '#94a3b8',
    emoji: '📌',
    description: conditionKey,
  };
}

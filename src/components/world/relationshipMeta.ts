import { RelationshipType } from '../../types';

export interface RelationshipMeta {
  type: RelationshipType;
  label: string;
  colorHex: string;
  strokeDasharray?: string;
  badgeClass: string;
}

export const RELATIONSHIP_META: Record<RelationshipType, RelationshipMeta> = {
  sekutu: {
    type: 'sekutu',
    label: 'Sekutu / Aliansi',
    colorHex: '#06b6d4',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  },
  musuh: {
    type: 'musuh',
    label: 'Musuh / Lawan',
    colorHex: '#ef4444',
    strokeDasharray: '6,4',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  },
  keluarga: {
    type: 'keluarga',
    label: 'Keluarga / Kerabat',
    colorHex: '#eab308',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  kekasih: {
    type: 'kekasih',
    label: 'Kekasih / Pasangan',
    colorHex: '#ec4899',
    badgeClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30',
  },
  rival: {
    type: 'rival',
    label: 'Rivalitas',
    colorHex: '#f97316',
    strokeDasharray: '4,4',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  },
  khianat: {
    type: 'khianat',
    label: 'Pengkhianat',
    colorHex: '#d946ef',
    strokeDasharray: '8,3',
    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30',
  },
  bawahan: {
    type: 'bawahan',
    label: 'Bawahan / Pengikut',
    colorHex: '#0284c7',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
  atasan: {
    type: 'atasan',
    label: 'Atasan / Pemimpin',
    colorHex: '#38bdf8',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
  guru_murid: {
    type: 'guru_murid',
    label: 'Guru / Murid',
    colorHex: '#6366f1',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  },
  netral: {
    type: 'netral',
    label: 'Netral / Kenalan',
    colorHex: '#64748b',
    strokeDasharray: '2,2',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  },
  lainnya: {
    type: 'lainnya',
    label: 'Hubungan Khusus',
    colorHex: '#8b5cf6',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
};

export function getRelationshipMeta(type?: string): RelationshipMeta {
  if (!type) return RELATIONSHIP_META.netral;
  return (RELATIONSHIP_META as any)[type] || RELATIONSHIP_META.lainnya;
}

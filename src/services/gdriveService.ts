import { GDriveConfig, GDriveItem } from '../types';
import { loadAISettings } from './aiService';

const GDRIVE_STORAGE_KEY = 'schemax_gdrive_config_v1';

// Ekstrak ID folder Google Drive dari link share atau URL langsung
export function extractGDriveFolderId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // Jika input sudah langsung berupa Folder ID
  if (/^[a-zA-Z0-9_-]{20,50}$/.test(trimmed)) {
    return trimmed;
  }

  // Format: https://drive.google.com/drive/folders/1A2B3C4D5E6F...
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  // Format query: ?id=1A2B3C4D...
  const queryMatch = trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  return null;
}

// Ekstrak ID file Google Drive dari URL share file
export function extractGDriveFileId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  if (/^[a-zA-Z0-9_-]{20,50}$/.test(trimmed)) {
    return trimmed;
  }

  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return fileMatch[1];
  }

  const ucMatch = trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (ucMatch && ucMatch[1]) {
    return ucMatch[1];
  }

  return null;
}

// Konversi ID File Google Drive menjadi URL langsung cepat (Google CDN publik)
export function getGDriveDirectImageUrl(fileId: string): string {
  if (!fileId) return '';
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

// Muat konfigurasi Google Drive dari localStorage
export function loadGDriveConfig(): GDriveConfig {
  try {
    const raw = localStorage.getItem(GDRIVE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Gagal memuat konfigurasi GDrive:', e);
  }
  return {};
}

// Simpan konfigurasi Google Drive ke localStorage
export function saveGDriveConfig(config: GDriveConfig): void {
  try {
    localStorage.setItem(GDRIVE_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Gagal menyimpan konfigurasi GDrive:', e);
  }
}

// Dapatkan Google API Key yang valid (mengutamakan config GDrive, atau fallback ke Gemini Slot API Key jika ada)
export function getEffectiveGoogleApiKey(): string {
  const gdrive = loadGDriveConfig();
  if (gdrive.apiKey && gdrive.apiKey.trim()) {
    return gdrive.apiKey.trim();
  }

  // Coba ambil dari Gemini Slot API Key (Google Cloud API Key yang sama seringkali bisa mengakses Drive API)
  const aiSettings = loadAISettings();
  const geminiSlot = aiSettings.slots.find(
    (s) => s.provider === 'gemini' && s.apiKey && s.apiKey.trim().length > 0
  );
  if (geminiSlot) {
    return geminiSlot.apiKey.trim();
  }

  return '';
}

// Cek dan ambil info folder Google Drive (nama folder dan validitas)
export async function testAndFetchGDriveFolder(folderId: string, apiKey: string): Promise<{ name: string; fileCount: number }> {
  if (!folderId) throw new Error('ID Folder Google Drive tidak valid.');
  if (!apiKey) throw new Error('Google Cloud API Key diperlukan untuk membaca folder publik.');

  // 1. Ambil info folder
  const folderUrl = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType&key=${apiKey.trim()}`;
  const folderRes = await fetch(folderUrl);

  if (!folderRes.ok) {
    const err = await folderRes.json().catch(() => ({}));
    const message = err.error?.message || `HTTP ${folderRes.status} Gagal mengakses folder Google Drive.`;
    if (folderRes.status === 404 || folderRes.status === 403) {
      throw new Error(
        'Folder tidak ditemukan atau belum diset publik. Pastikan izin akses folder adalah "Anyone with the link can view".'
      );
    }
    throw new Error(message);
  }

  const folderData = await folderRes.json();

  // 2. Hitung jumlah item di dalamnya
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id)&pageSize=100&key=${apiKey.trim()}`;
  const listRes = await fetch(listUrl);
  let fileCount = 0;
  if (listRes.ok) {
    const listData = await listRes.json();
    fileCount = listData.files?.length || 0;
  }

  return {
    name: folderData.name || 'Folder Google Drive',
    fileCount,
  };
}

// Ambil isi subfolder & file gambar dari folder tertentu
export async function listGDriveFolderContents(
  folderId: string,
  apiKey: string
): Promise<GDriveItem[]> {
  if (!folderId || !apiKey) return [];

  const query = `'${folderId}' in parents and trashed = false`;
  const fields = 'files(id, name, mimeType, size, thumbnailLink, webContentLink)';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=100&orderBy=folder,name&key=${apiKey.trim()}`;

  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal memuat isi folder (${response.status})`);
  }

  const data = await response.json();
  const rawFiles: any[] = data.files || [];

  return rawFiles
    .map((f: any) => {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      const isImage = f.mimeType?.startsWith('image/');

      if (!isFolder && !isImage) return null; // Hanya tampilkan folder atau gambar

      const directUrl = isFolder ? undefined : getGDriveDirectImageUrl(f.id);

      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        isFolder,
        size: f.size ? parseInt(f.size, 10) : undefined,
        thumbnailUrl: f.thumbnailLink || directUrl,
        directUrl,
      } as GDriveItem;
    })
    .filter((item): item is GDriveItem => item !== null);
}

// Unduh file gambar dari Google Drive dan jadikan Blob lokal untuk disimpan ke IndexedDB
export async function downloadGDriveImageBlob(fileId: string): Promise<{ blob: Blob; mimeType: string }> {
  const directUrl = getGDriveDirectImageUrl(fileId);

  // Coba ambil dari Googleusercontent CDN langsung
  try {
    const response = await fetch(directUrl);
    if (response.ok) {
      const blob = await response.blob();
      return {
        blob,
        mimeType: blob.type || 'image/jpeg',
      };
    }
  } catch (e) {
    console.warn('Gagal fetch via googleusercontent CDN, mencoba uc download link...', e);
  }

  // Fallback ke Google Drive uc download endpoint
  const fallbackUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const fallbackRes = await fetch(fallbackUrl);
  if (!fallbackRes.ok) {
    throw new Error('Gagal mengunduh gambar dari Google Drive. Pastikan file dapat diakses publik.');
  }

  const blob = await fallbackRes.blob();
  return {
    blob,
    mimeType: blob.type || 'image/jpeg',
  };
}

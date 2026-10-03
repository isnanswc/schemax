import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Sparkles, Plus, Trash2, Tag, User, MapPin, Shield, Scroll, Check, Loader2, HardDrive } from 'lucide-react';
import { WorldEntity, WorldCategory, WorldAttribute, MediaItem } from '../../types';
import { db, saveMediaItem, createSvgBlob } from '../../db';
import { ENTITY_CONDITIONS, getConditionMeta } from './entityConditionMeta';
import { analyzeCharacterPhotoWithVision } from '../../services/aiService';
import { GDriveMediaPickerModal } from '../media/GDriveMediaPickerModal';

interface AddWorldEntityModalProps {
  isOpen: boolean;
  bookId: string;
  onClose: () => void;
  onSuccess: (newEntity: WorldEntity) => void;
  initialCategory?: WorldCategory;
}

export const AddWorldEntityModal: React.FC<AddWorldEntityModalProps> = ({
  isOpen,
  bookId,
  onClose,
  onSuccess,
  initialCategory = 'character',
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WorldCategory>(initialCategory);
  const [faction, setFaction] = useState('');
  const [condition, setCondition] = useState('aktif');
  const [conditionDetails, setConditionDetails] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [initialTraits, setInitialTraits] = useState('');
  const [currentTraits, setCurrentTraits] = useState('');
  const [evolutionSummary, setEvolutionSummary] = useState('');
  const [physicalTraits, setPhysicalTraits] = useState('');
  const [visualPrompt, setVisualPrompt] = useState('');
  const [detailedNotes, setDetailedNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [attributes, setAttributes] = useState<WorldAttribute[]>([
    { id: '1', label: 'Peran', value: '' },
  ]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedGalleryMediaId, setSelectedGalleryMediaId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [galleryItems, setGalleryItems] = useState<Array<MediaItem & { url: string }>>([]);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [isGDriveOpen, setIsGDriveOpen] = useState(false);
  const [isVisionScanning, setIsVisionScanning] = useState(false);
  const [visionScanSuccess, setVisionScanSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    db.media.where('bookId').equals(bookId).toArray().then((items) => {
      setGalleryItems(
        items.map((i) => ({
          ...i,
          url: URL.createObjectURL(i.blob),
        }))
      );
    });
  }, [isOpen, bookId]);

  if (!isOpen) return null;

  const handleScanCharacterPhoto = async () => {
    if (!previewUrl) return;
    setIsVisionScanning(true);
    setVisionScanSuccess(null);

    try {
      let base64 = '';
      let mime = 'image/jpeg';

      if (avatarFile) {
        mime = avatarFile.type || 'image/jpeg';
        const reader = new FileReader();
        base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(avatarFile);
        });
      } else if (selectedGalleryMediaId) {
        const media = await db.media.get(selectedGalleryMediaId);
        if (media && media.blob) {
          mime = media.mimeType || 'image/jpeg';
          const reader = new FileReader();
          base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(media.blob);
          });
        }
      } else if (previewUrl.startsWith('data:')) {
        base64 = previewUrl;
      } else if (previewUrl.startsWith('blob:') || previewUrl.startsWith('http')) {
        const resp = await fetch(previewUrl);
        const blob = await resp.blob();
        mime = blob.type || 'image/jpeg';
        const reader = new FileReader();
        base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      if (!base64) {
        alert('Pilih atau unggah file foto entitas terlebih dahulu.');
        return;
      }

      const res = await analyzeCharacterPhotoWithVision(base64, mime, name, category);

      // Populate physical traits & attire
      const detailedPhysical = [
        res.physicalTraits ? `Ciri Fisik / Bentuk: ${res.physicalTraits}` : '',
        res.clothingAttire ? `Pakaian / Ornamen: ${res.clothingAttire}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      setPhysicalTraits(detailedPhysical);
      if (res.englishVisualPrompt) {
        setVisualPrompt(res.englishVisualPrompt);
      }
      if (!shortDescription.trim() && res.shortSummary) {
        setShortDescription(res.shortSummary);
      }

      // Add or update attributes for Gender, Exact Age, and Clothing if applicable
      setAttributes((prev) => {
        const next = [...prev];
        const updateOrAdd = (lbl: string, val: string) => {
          const idx = next.findIndex((a) => a.label.toLowerCase() === lbl.toLowerCase());
          if (idx !== -1) {
            next[idx] = { ...next[idx], value: val };
          } else {
            next.push({ id: Date.now().toString() + Math.random(), label: lbl, value: val });
          }
        };

        if (res.gender && res.gender !== '-') updateOrAdd('Jenis Kelamin', res.gender);
        if (res.estimatedAge && res.estimatedAge !== '-') updateOrAdd('Usia', res.estimatedAge);
        if (res.clothingAttire && category === 'character') updateOrAdd('Pakaian', res.clothingAttire);
        return next;
      });

      const successLabel = category === 'character'
        ? `Berhasil mengekstrak profil tokoh: ${res.gender}, ${res.estimatedAge}`
        : `Berhasil mengekstrak ciri visual & deskripsi ${category.toUpperCase()}`;

      setVisionScanSuccess(successLabel);
      setTimeout(() => setVisionScanSuccess(null), 5000);
    } catch (err: any) {
      console.error('Vision scan error:', err);
      alert('Gagal memindai foto dengan AI: ' + (err?.message || 'Periksa API Key Gemini Anda'));
    } finally {
      setIsVisionScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setSelectedGalleryMediaId(null);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAddAttribute = () => {
    setAttributes([
      ...attributes,
      { id: Date.now().toString(), label: '', value: '' },
    ]);
  };

  const handleRemoveAttribute = (id: string) => {
    setAttributes(attributes.filter((attr) => attr.id !== id));
  };

  const handleAttributeChange = (id: string, field: 'label' | 'value', val: string) => {
    setAttributes(
      attributes.map((attr) => (attr.id === id ? { ...attr, [field]: val } : attr))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const existing = await db.worldEntities.where('bookId').equals(bookId).toArray();
      if (existing.some((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase())) {
        alert(`Entitas dengan nama "${name.trim()}" sudah ada di buku ini. Gunakan nama lain.`);
        setIsSubmitting(false);
        return;
      }

      const entityId = 'ent_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      let avatarMediaId: string | undefined;

      if (avatarFile) {
        avatarMediaId = await saveMediaItem(bookId, avatarFile, avatarFile.name, entityId);
      } else if (selectedGalleryMediaId) {
        avatarMediaId = selectedGalleryMediaId;
      } else {
        // Preset icon based on category
        const iconMap: Record<WorldCategory, string> = {
          character: '🧙‍♂️',
          location: '🏰',
          item: '💎',
          lore: '📜',
        };
        const colorMap: Record<WorldCategory, string> = {
          character: '#ec4899',
          location: '#06b6d4',
          item: '#eab308',
          lore: '#8b5cf6',
        };
        const svgBlob = createSvgBlob(name, colorMap[category], iconMap[category]);
        avatarMediaId = await saveMediaItem(bookId, svgBlob, `${name}-avatar.svg`, entityId);
      }

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const validAttributes = attributes.filter(
        (a) => a.label.trim() && a.value.trim()
      );

      const newEntity: WorldEntity = {
        id: entityId,
        bookId,
        category,
        name: name.trim(),
        faction: faction.trim() || undefined,
        condition,
        conditionDetails: conditionDetails.trim() || undefined,
        shortDescription: shortDescription.trim(),
        initialDescription: shortDescription.trim() || undefined,
        initialTraits: initialTraits.trim() || undefined,
        currentDescription: shortDescription.trim() || undefined,
        currentTraits: currentTraits.trim() || initialTraits.trim() || undefined,
        physicalTraits: physicalTraits.trim() || undefined,
        visualPrompt: visualPrompt.trim() || undefined,
        evolutionSummary: evolutionSummary.trim() || undefined,
        detailedNotes: detailedNotes.trim(),
        tags,
        avatarMediaId,
        galleryMediaIds: [],
        attributes: validAttributes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.worldEntities.add(newEntity);
      onSuccess(newEntity);
      onClose();
    } catch (err) {
      console.error('Gagal membuat entitas worldbuilding:', err);
      alert('Terjadi kesalahan saat menyimpan ke IndexedDB.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = [
    { id: 'character' as WorldCategory, label: 'Karakter', icon: User, color: 'text-pink-400' },
    { id: 'location' as WorldCategory, label: 'Lokasi/Latar', icon: MapPin, color: 'text-cyan-400' },
    { id: 'item' as WorldCategory, label: 'Item/Relik', icon: Shield, color: 'text-yellow-400' },
    { id: 'lore' as WorldCategory, label: 'Lore/Faksi', icon: Scroll, color: 'text-purple-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Tambah World Building</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Karakter, latar, item, atau lore dunia</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Kategori Entitas *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categoryOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = category === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCategory(opt.id)}
                    className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-slate-800 border-amber-500 dark:border-amber-400/80 text-slate-900 dark:text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${opt.color}`} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name & Avatar */}
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center flex-shrink-0 group">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-400 dark:text-slate-600" />
              )}
            </div>

            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Nama / Judul Entitas *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Raden Kaelen, Hutan Bayangan, Pedang Surya"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm shadow-sm"
              />
            </div>
          </div>

          {/* Upload Image & Gallery Picker Buttons */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 transition shadow-sm">
                <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                <span>{previewUrl ? 'Ganti Galeri HP' : 'Galeri HP / File'}</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>

              {/* 🌐 Pilih dari Google Drive Button */}
              <button
                type="button"
                onClick={() => setIsGDriveOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 active:scale-95 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl border border-blue-200 dark:border-blue-800 transition shadow-sm"
              >
                <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                <span>Google Drive</span>
              </button>

              {galleryItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowGalleryPicker(!showGalleryPicker)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 transition shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                  <span>Galeri Buku ({galleryItems.length})</span>
                </button>
              )}
            </div>

            {/* 🌟 Permanent, High-Visibility AI Vision Scanner Card */}
            {!previewUrl ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-amber-500/5 border border-dashed border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Ekstrak &amp; Pindai Ciri Entitas dengan AI
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Unggah foto atau pilih dari Google Drive / Galeri di atas untuk mengekstrak jenis kelamin, usia pasti (tanpa rentang), ciri fisik, pakaian &amp; prompt visual secara otomatis.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-semibold whitespace-nowrap cursor-not-allowed border border-slate-200 dark:border-slate-700"
                >
                  Pilih Foto Dahulu
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-pink-500/15 to-amber-500/15 border-2 border-purple-500/40 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center flex-shrink-0 shadow-inner">
                    <Sparkles className="w-5 h-5 animate-pulse text-purple-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-purple-900 dark:text-purple-200">
                        Ekstrak &amp; Pindai Ciri Entitas dari Foto (AI Vision)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300">
                        SIAP PINDAI
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      AI Vision akan mengekstrak jenis kelamin, usia pasti (tanpa rentang), ciri fisik, pakaian/material, dan prompt visual secara otomatis.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleScanCharacterPhoto}
                  disabled={isVisionScanning}
                  className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 flex-shrink-0 whitespace-nowrap disabled:opacity-50"
                >
                  {isVisionScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Sedang Memindai Foto...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      <span>✨ Pindai &amp; Ekstrak Ciri Foto Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Vision Scan Success Banner */}
            {visionScanSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="font-semibold">{visionScanSuccess}</span>
              </div>
            )}

            {/* Gallery Picker Mini Grid */}
            {showGalleryPicker && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pilih Gambar Utama dari Galeri Buku:
                </span>
                <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto no-scrollbar">
                  {galleryItems.map((item) => {
                    const isSelected = selectedGalleryMediaId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedGalleryMediaId(item.id);
                          setAvatarFile(null);
                          setPreviewUrl(item.url);
                          setShowGalleryPicker(false);
                        }}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition ${
                          isSelected ? 'border-pink-500 ring-2 ring-pink-500/30' : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-pink-500/40 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Faction & Condition Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Faksi / Kelompok / Kubu
              </label>
              <input
                type="text"
                value={faction}
                onChange={(e) => setFaction(e.target.value)}
                placeholder="Cth: Kerajaan Surya, Klan Naga"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 text-xs shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Kondisi / Status Saat Ini
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-xs shadow-sm"
              >
                {Object.values(ENTITY_CONDITIONS).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Condition Details input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Keterangan Kondisi Spesifik (Opsional)
            </label>
            <textarea
              rows={1}
              value={conditionDetails}
              onChange={(e) => setConditionDetails(e.target.value)}
              placeholder="Cth: Terluka di lengan kiri, Memimpin pasukan gerilya, Berkhianat sejak Bab 2"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 text-xs shadow-sm resize-none leading-relaxed"
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Deskripsi Singkat / Peran
            </label>
            <textarea
              rows={1}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Contoh: Sang penempa besi legendaris dari klan timur"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm shadow-sm resize-none leading-relaxed"
            />
          </div>

          {/* Sifat & Kepribadian Awal vs Terkini */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
                🌱 Sifat &amp; Kepribadian Awal
              </label>
              <textarea
                rows={1}
                value={initialTraits}
                onChange={(e) => setInitialTraits(e.target.value)}
                placeholder="Cth: Penyayang, baik hati, penurut, santun"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 text-xs shadow-sm resize-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                ⚡ Sifat &amp; Kepribadian Terkini
              </label>
              <textarea
                rows={1}
                value={currentTraits}
                onChange={(e) => setCurrentTraits(e.target.value)}
                placeholder="Cth: Kasar, manipulatif, dingin, penuh kebencian"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 text-xs shadow-sm resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Titik Balik Perubahan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Titik Balik / Peristiwa Perubahan Karakter (Opsional)
            </label>
            <textarea
              rows={1}
              value={evolutionSummary}
              onChange={(e) => setEvolutionSummary(e.target.value)}
              placeholder="Cth: Setelah dirasuki oleh jin dari pantai utara / Pengkhianatan di istana"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 text-xs shadow-sm resize-none leading-relaxed"
            />
          </div>

          {/* Ciri-Ciri Fisik & Visual Prompt Text-to-Image */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                👤 Ciri-Ciri Fisik (Akurat)
              </label>
              <textarea
                rows={2}
                value={physicalTraits}
                onChange={(e) => {
                  const val = e.target.value;
                  setPhysicalTraits(val);
                  if (!visualPrompt) {
                    setVisualPrompt(
                      `Full body portrait standing upright, centered, Indonesian character, ${val || 'natural appearance'}, hyper realistic, 8k resolution, cinematic lighting, photorealistic textures, 9:16 aspect ratio`
                    );
                  }
                }}
                placeholder="Cth: Tinggi tegap 175cm, kulit sawo matang, rambut ikal hitam, mengenakan rompi tenun tradisional dan ikat kepala merah"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 text-xs shadow-sm resize-none leading-relaxed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                  ✨ Text-to-Image Prompt (Midjourney / Flux / DALL-E)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setVisualPrompt(
                      `Full body portrait standing upright, centered, Indonesian character, ${physicalTraits || shortDescription || 'natural appearance'}, hyper realistic, 8k resolution, cinematic lighting, photorealistic textures, 9:16 aspect ratio`
                    );
                  }}
                  className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                >
                  ⚡ Buat Ulang Prompt
                </button>
              </div>
              <textarea
                rows={1}
                value={visualPrompt}
                onChange={(e) => setVisualPrompt(e.target.value)}
                placeholder="Full body portrait standing upright, centered, Indonesian character..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 font-mono text-[11px] shadow-sm resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Dynamic Attributes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Atribut Kustom (Spesifikasi)
              </label>
              <button
                type="button"
                onClick={handleAddAttribute}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah Atribut</span>
              </button>
            </div>

            <div className="space-y-2">
              {attributes.map((attr) => (
                <div key={attr.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Label (cth: Usia, Afiliasi)"
                    value={attr.label}
                    onChange={(e) => handleAttributeChange(attr.id, 'label', e.target.value)}
                    className="w-1/3 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-xs shadow-sm"
                  />
                  <textarea
                    rows={1}
                    placeholder="Nilai (cth: 24 Tahun, Kerajaan Surya)"
                    value={attr.value}
                    onChange={(e) => handleAttributeChange(attr.id, 'value', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-xs shadow-sm resize-none leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(attr.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Catatan Lore Mendalam / Latar Belakang
            </label>
            <textarea
              rows={3}
              value={detailedNotes}
              onChange={(e) => setDetailedNotes(e.target.value)}
              placeholder="Tuliskan sejarah, motivasi, rahasia tersembunyi, atau hubungan dengan karakter lain..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm resize-none shadow-sm"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Tags (Pisahkan dengan koma)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Protagonis, Sihir, Elit, Penjaga"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm shadow-sm"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Simpan ke Worldbuilding</span>
            </button>
          </div>
        </form>

        {/* Google Drive Media Picker Modal */}
        <GDriveMediaPickerModal
          isOpen={isGDriveOpen}
          onClose={() => setIsGDriveOpen(false)}
          bookId={bookId}
          category={category}
          title={`Pilih Gambar untuk ${name || 'Entitas Baru'}`}
          onSelectImage={async (mediaId) => {
            setIsGDriveOpen(false);
            setSelectedGalleryMediaId(mediaId);
            setAvatarFile(null);
            const media = await db.media.get(mediaId);
            if (media && media.blob) {
              setPreviewUrl(URL.createObjectURL(media.blob));
            }
          }}
        />
      </div>
    </div>
  );
};

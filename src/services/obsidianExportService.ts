import { db, MediaItem } from '../db';
import { Book, StoryChapter, WorldEntity, WorldCategory } from '../types';
import { SimpleZip } from '../utils/simpleZip';

// Bersihkan nama berkas agar ramah sistem operasi (Windows, Mac, Linux)
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Tanpa_Nama';
}

// Konversi MIME type gambar ke ekstensi berkas
function getExtensionFromMime(mime: string): string {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('svg')) return '.svg';
  if (mime.includes('gif')) return '.gif';
  return '.jpg';
}

/**
 * Konversi HTML naskah bab menjadi Markdown bersih dengan integrasi Wikilinks
 */
export function convertHtmlToMarkdown(html: string, entityNames: string[] = []): string {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Bersihkan elemen tersembunyi
  doc.querySelectorAll('script, style, [data-interactive]').forEach((el) => el.remove());

  // Tangani blok gambar naskah cerita: ubah menjadi tag embed Obsidian ![[assets/...]]
  doc.querySelectorAll('figure.story-image-block, figure').forEach((fig) => {
    const img = fig.querySelector('img');
    const figcaption = fig.querySelector('figcaption');
    const mediaId = fig.getAttribute('data-media-id') || img?.getAttribute('data-media-id');
    const alt = img?.getAttribute('alt') || figcaption?.textContent?.trim() || 'Ilustrasi Adegan';

    let mdImg = '';
    if (mediaId) {
      mdImg = `\n\n![[assets/${mediaId}.jpg|500]]\n*${alt}*\n\n`;
    } else if (img?.src) {
      mdImg = `\n\n![${alt}](${img.src})\n\n`;
    }
    const replacement = doc.createTextNode(mdImg);
    fig.replaceWith(replacement);
  });

  // Ambil teks berbasis blok
  const blocks: string[] = [];
  const bodyChildren = Array.from(doc.body.children);

  if (bodyChildren.length === 0) {
    const rawText = doc.body.textContent?.trim() || '';
    if (rawText) blocks.push(rawText);
  } else {
    bodyChildren.forEach((child) => {
      const tag = child.tagName.toLowerCase();
      const text = child.textContent?.trim() || '';
      if (!text && tag !== 'hr') return;

      if (tag === 'h1') blocks.push(`# ${text}`);
      else if (tag === 'h2') blocks.push(`## ${text}`);
      else if (tag === 'h3') blocks.push(`### ${text}`);
      else if (tag === 'blockquote') blocks.push(`> ${text}`);
      else if (tag === 'hr') blocks.push('---');
      else {
        // Paragraf biasa atau div
        blocks.push(text);
      }
    });
  }

  let markdown = blocks.join('\n\n');

  // Tautkan nama-nama entitas glosarium yang relevan menjadi Wikilinks [[Nama]]
  // Diurutkan dari nama terpanjang untuk mencegah penimpaan substring
  const sortedNames = [...entityNames]
    .filter((n) => n && n.length >= 3)
    .sort((a, b) => b.length - a.length);

  for (const name of sortedNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Hanya tautkan jika bukan bagian dari link yang sudah ada [[...]] atau markdown tag
    const regex = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, 'gi');
    markdown = markdown.replace(regex, '[[$1]]');
  }

  return markdown;
}

/**
 * Format kategori worldbuilding menjadi nama folder yang rapi
 */
function getCategoryFolderName(cat: WorldCategory): string {
  switch (cat) {
    case 'character':
      return '01 - Karakter';
    case 'location':
      return '02 - Lokasi';
    case 'item':
      return '03 - Item & Relik';
    case 'lore':
      return '04 - Lore & Faksi';
    default:
      return '05 - Lainnya';
  }
}

/**
 * Konversi Entitas Worldbuilding menjadi berkas Markdown dengan YAML Frontmatter
 */
export function convertEntityToMarkdown(
  entity: WorldEntity,
  entityIdNameMap: Map<string, string>,
  avatarFileName?: string
): string {
  const frontmatter: string[] = [
    '---',
    `title: "${entity.name.replace(/"/g, '\\"')}"`,
    `category: "${entity.category}"`,
  ];

  if (entity.faction) frontmatter.push(`faction: "${entity.faction.replace(/"/g, '\\"')}"`);
  if (entity.condition) frontmatter.push(`status: "${entity.condition}"`);
  if (entity.aliases && entity.aliases.length > 0) {
    frontmatter.push(`aliases: [${entity.aliases.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(', ')}]`);
  }
  if (entity.tags && entity.tags.length > 0) {
    frontmatter.push(`tags: [${entity.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`);
  }
  if (avatarFileName) {
    frontmatter.push(`cover: "assets/${avatarFileName}"`);
  }
  frontmatter.push('---');

  const content: string[] = [
    frontmatter.join('\n'),
    '',
    `# ${entity.name}`,
    '',
  ];

  if (avatarFileName) {
    content.push(`![Avatar|240](assets/${avatarFileName})`, '');
  }

  if (entity.shortDescription) {
    content.push(`> ${entity.shortDescription}`, '');
  }

  // Karakteristik & Sifat
  if (entity.currentTraits || entity.initialTraits || entity.physicalTraits) {
    content.push('## 🎭 Karakteristik & Sifat');
    if (entity.physicalTraits) content.push(`- **Fisik**: ${entity.physicalTraits}`);
    if (entity.initialTraits) content.push(`- **Sifat Awal**: ${entity.initialTraits}`);
    if (entity.currentTraits) content.push(`- **Sifat Terkini**: ${entity.currentTraits}`);
    content.push('');
  }

  // Detail & Catatan Lore
  if (entity.detailedNotes) {
    content.push('## 📜 Latar Belakang & Catatan', entity.detailedNotes, '');
  }

  // Hubungan & Relasi (Tautkan langsung ke [[Nama Entitas Rekanan]])
  if (entity.relationships && entity.relationships.length > 0) {
    content.push('## 🔗 Hubungan & Relasi');
    entity.relationships.forEach((rel) => {
      const targetName = entityIdNameMap.get(rel.targetEntityId) || rel.targetEntityId;
      const desc = rel.description ? ` — *${rel.description}*` : '';
      content.push(`- [[${targetName}]] (${rel.label || 'Berhubungan'})${desc}`);
    });
    content.push('');
  }

  return content.join('\n');
}

/**
 * Hasilkan berkas Obsidian Canvas (.canvas) untuk visualisasi graf kartu relasi
 */
export function generateObsidianCanvas(
  entities: WorldEntity[],
  bookTitle: string
): string {
  const nodes: any[] = [];
  const edges: any[] = [];

  // Hitung penataan grid melingkar / kolom untuk node entitas
  const cols = Math.max(1, Math.ceil(Math.sqrt(entities.length)));
  const cardWidth = 280;
  const cardHeight = 320;
  const gapX = 140;
  const gapY = 140;

  const colorMap: Record<WorldCategory, string> = {
    character: '5', // Pink / Rose
    location: '4',  // Hijau
    item: '2',      // Jingga / Amber
    lore: '6',      // Ungu
  };

  entities.forEach((ent, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = col * (cardWidth + gapX);
    const y = row * (cardHeight + gapY);

    const folder = getCategoryFolderName(ent.category);
    const fileName = `${sanitizeFileName(ent.name)}.md`;
    const filePath = `02 - Ensiklopedia/${folder}/${fileName}`;

    nodes.push({
      id: ent.id,
      type: 'file',
      file: filePath,
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      color: colorMap[ent.category] || '1',
    });

    // Tambahkan edges relasi
    (ent.relationships || []).forEach((rel, rIdx) => {
      edges.push({
        id: `edge_${ent.id}_${rel.targetEntityId}_${rIdx}`,
        fromNode: ent.id,
        fromSide: 'right',
        toNode: rel.targetEntityId,
        toSide: 'left',
        label: rel.label || 'Relasi',
      });
    });
  });

  return JSON.stringify({ nodes, edges }, null, 2);
}

/**
 * Ekspor seluruh buku menjadi paket ZIP Obsidian Vault
 */
export async function exportBookToObsidianZip(
  bookId: string,
  onProgress?: (message: string, percent: number) => void
): Promise<{ blob: Blob; fileName: string; base64Data: string; fileCount: number }> {
  onProgress?.('Membaca naskah dan ensiklopedia buku...', 10);

  const book = await db.books.get(bookId);
  if (!book) throw new Error('Buku tidak ditemukan di database lokal.');

  const chapters = await db.chapters.where('bookId').equals(bookId).toArray();
  chapters.sort((a, b) => (a.order || 0) - (b.order || 0));

  const entities = await db.worldEntities.where('bookId').equals(bookId).toArray();
  const mediaList = await db.media.where('bookId').equals(bookId).toArray();

  const zip = new SimpleZip();
  let totalFiles = 0;

  const entityNames = entities.map((e) => e.name);
  const entityIdNameMap = new Map<string, string>();
  entities.forEach((e) => entityIdNameMap.set(e.id, e.name));

  // 1. Ekspor Media Fisik (Folder assets/)
  onProgress?.('Mengekstrak gambar dan avatar ke folder assets/...', 25);
  const mediaFileNameMap = new Map<string, string>();

  for (const m of mediaList) {
    if (m.blob && m.blob.size > 0) {
      const ext = getExtensionFromMime(m.mimeType || 'image/jpeg');
      const safeName = `${m.id}${ext}`;
      mediaFileNameMap.set(m.id, safeName);
      await zip.addBlobFile(`assets/${safeName}`, m.blob);
      totalFiles++;
    }
  }

  // 2. Berkas Halaman Muka: 00 - Sinopsis & Ringkasan Buku.md
  onProgress?.('Menyusun halaman ringkasan buku...', 45);
  const coverFileName = book.coverMediaId ? mediaFileNameMap.get(book.coverMediaId) : undefined;
  const overviewMarkdown = [
    '---',
    `title: "${book.title.replace(/"/g, '\\"')}"`,
    `genre: "${book.genre || 'Fiksi'}"`,
    `status: "${book.status}"`,
    `total_chapters: ${chapters.length}`,
    `total_entities: ${entities.length}`,
    `exported_at: "${new Date().toISOString()}"`,
    coverFileName ? `cover: "assets/${coverFileName}"` : '',
    '---',
    '',
    `# 📖 ${book.title}`,
    '',
    coverFileName ? `![Sampul Buku|280](assets/${coverFileName})\n` : '',
    '## 📑 Sinopsis Cerita',
    book.synopsis || '*(Belum ada sinopsis)*',
    '',
    '## 📚 Daftar Bab',
    ...chapters.map((c) => `- [[Bab ${String(c.order).padStart(2, '0')} - ${sanitizeFileName(c.title)}]] (${c.wordCount || 0} kata)`),
    '',
    '## 🧭 Ensiklopedia & Tokoh Utama',
    ...entities.slice(0, 20).map((e) => `- [[${e.name}]] — *${e.shortDescription || e.category}*`),
    '',
    '> 💡 *Vault ini dihasilkan secara otomatis oleh Schemax Story Studio.*',
  ].filter(Boolean).join('\n');

  zip.addTextFile(`00 - Ringkasan - ${sanitizeFileName(book.title)}.md`, overviewMarkdown);
  totalFiles++;

  // 3. Berkas Naskah Tiap Bab (Folder 01 - Naskah Bab/)
  onProgress?.('Mengonversi naskah bab ke Markdown & Wikilinks...', 65);
  chapters.forEach((ch) => {
    const orderStr = String(ch.order || 1).padStart(2, '0');
    const safeTitle = sanitizeFileName(ch.title || `Bab ${ch.order}`);
    const fileName = `Bab ${orderStr} - ${safeTitle}.md`;

    const chCoverFile = ch.coverMediaId ? mediaFileNameMap.get(ch.coverMediaId) : undefined;
    const bodyMd = convertHtmlToMarkdown(ch.contentHtml || ch.premise || '', entityNames);

    const chapterMarkdown = [
      '---',
      `chapter_number: ${ch.order}`,
      `title: "${ch.title.replace(/"/g, '\\"')}"`,
      `status: "${ch.status}"`,
      `word_count: ${ch.wordCount || 0}`,
      chCoverFile ? `cover: "assets/${chCoverFile}"` : '',
      '---',
      '',
      `# Bab ${ch.order}: ${ch.title}`,
      '',
      chCoverFile ? `![Sampul Bab|450](assets/${chCoverFile})\n` : '',
      bodyMd,
      '',
      '---',
      '### 🔗 Navigasi Cerita',
      `- Buku: [[00 - Ringkasan - ${sanitizeFileName(book.title)}]]`,
    ].filter(Boolean).join('\n');

    zip.addTextFile(`01 - Naskah Bab/${fileName}`, chapterMarkdown);
    totalFiles++;
  });

  // 4. Berkas Ensiklopedia (Folder 02 - Ensiklopedia/...)
  onProgress?.('Menyusun kartu karakter dan relasi Obsidian...', 80);
  entities.forEach((ent) => {
    const folder = getCategoryFolderName(ent.category);
    const fileName = `${sanitizeFileName(ent.name)}.md`;
    const avatarFile = ent.avatarMediaId ? mediaFileNameMap.get(ent.avatarMediaId) : undefined;
    const entityMd = convertEntityToMarkdown(ent, entityIdNameMap, avatarFile);

    zip.addTextFile(`02 - Ensiklopedia/${folder}/${fileName}`, entityMd);
    totalFiles++;
  });

  // 5. Berkas Peta Relasi Obsidian Canvas (.canvas)
  onProgress?.('Membuat papan visual Peta Relasi (.canvas)...', 90);
  if (entities.length > 0) {
    const canvasJson = generateObsidianCanvas(entities, book.title);
    zip.addTextFile(`03 - Peta Relasi - ${sanitizeFileName(book.title)}.canvas`, canvasJson);
    totalFiles++;
  }

  // 6. Buat File ZIP Akhir
  onProgress?.('Mengompresi arsip Obsidian Vault...', 95);
  const zipBlob = zip.buildZipBlob();
  const safeBookName = book.title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  const fileName = `${safeBookName}_Obsidian_Vault.zip`;

  // Konversi ke Base64 (untuk diunggah ke Google Drive)
  const arrayBuffer = await zipBlob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  onProgress?.('Selesai!', 100);

  return {
    blob: zipBlob,
    fileName,
    base64Data,
    fileCount: totalFiles,
  };
}

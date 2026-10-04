import { WorldEntity, CharacterChatMessage, StoryChapter } from '../types';
import { generateWithSmartFallback } from './aiService';

export interface CharacterChatParams {
  character: WorldEntity;
  bookTitle?: string;
  bookGenre?: string;
  bookSynopsis?: string;
  chapters?: StoryChapter[];
  authorKnownFacts: string[];
  history: CharacterChatMessage[];
  userMessage: string;
  chatMode?: 'in_character' | 'meta_interview'; // in-universe immersion vs author-interview
}

export interface CharacterChatResponse {
  reply: string;
  detectedFacts: string[];
  provider?: string;
  model?: string;
}

/**
 * Heuristic fact detector for immediate zero-latency fact extraction from author's messages.
 * Matches personal statements such as hobbies, favorites, origin, habits, etc.
 */
export function detectAuthorFacts(userMessage: string): string[] {
  const facts: string[] = [];
  const text = userMessage.trim();

  // Common Indonesian personal declaration patterns
  const patterns = [
    /(?:hobi|kegemaran)\s*(?:saya|ku|aku)(?:\s*adalah|\s*:|\s*yaitu)?\s+([^,.\n?!]+)/i,
    /(?:saya|aku)\s*(?:punya\s+hobi|hobi(?:nya)?)\s+([^,.\n?!]+)/i,
    /(?:makanan|minuman|musik|film|warna)\s*(?:favorit|kesukaan)\s*(?:saya|ku|aku)(?:\s*adalah|\s*:)?\s+([^,.\n?!]+)/i,
    /(?:saya|aku)\s*(?:sangat\s+)?(?:suka|gemar|senang)\s+([^,.\n?!]+)/i,
    /(?:saya|aku)\s*(?:tinggal|berasal)\s+di\s+([^,.\n?!]+)/i,
    /(?:saya|aku)\s*(?:bekerja|profesi(?:ku)?)\s*(?:sebagai|di)?\s+([^,.\n?!]+)/i,
    /(?:nama(?:ku| saya)?|panggil(?:\s*saja)?)\s*(?:adalah)?\s+([A-Z][a-z0-9_]+)/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const extracted = match[0].trim();
      // Keep it neat and readable
      if (extracted.length >= 6 && extracted.length <= 80) {
        facts.push(extracted);
      }
    }
  }

  return facts;
}

/**
 * Builds an authentic system persona prompt for a WorldEntity character
 */
export function buildCharacterSystemPrompt(
  character: WorldEntity,
  bookTitle?: string,
  bookGenre?: string,
  bookSynopsis?: string,
  chapters?: StoryChapter[],
  authorKnownFacts: string[] = [],
  chatMode: 'in_character' | 'meta_interview' = 'in_character'
): string {
  // Extract key traits
  const role = character.shortDescription || character.attributes?.find(a => a.label.toLowerCase().includes('peran'))?.value || 'Tokoh Cerita';
  const age = character.attributes?.find(a => a.label.toLowerCase().includes('usia') || a.label.toLowerCase().includes('umur'))?.value || 'Dewasa Muda';
  const traits = character.currentTraits || character.initialTraits || 'Ekspresif, manusiawi, memiliki prinsip hidup';
  const appearance = character.physicalTraits || 'Berpenampilan khas sesuai peran dalam cerita';
  const condition = character.condition ? `Status/Kondisi saat ini: ${character.condition} (${character.conditionDetails || 'normal'})` : '';
  const faction = character.faction ? `Faksi/Kelompok: ${character.faction}` : '';

  // Relationships info
  const rels = character.relationships && character.relationships.length > 0
    ? character.relationships.map(r => `- ${r.targetEntityName}: ${r.relationType} (${r.notes || 'relasi penting'})`).join('\n')
    : 'Tidak ada relasi khusus yang tercatat.';

  // Recent plot / story context summary
  let storyContext = '';
  if (bookTitle) storyContext += `Judul Buku: "${bookTitle}" (Genre: ${bookGenre || 'Fiksi'})\n`;
  if (bookSynopsis) storyContext += `Sinopsis Cerita:\n${bookSynopsis.slice(0, 1000)}\n`;
  if (chapters && chapters.length > 0) {
    const chapterBriefs = chapters.slice(-3).map(ch => `* Bab ${ch.order}: ${ch.title} - ${ch.summary || ch.content?.slice(0, 150) || 'Peristiwa sedang berlangsung'}`).join('\n');
    storyContext += `Peristiwa Cerita Terkini:\n${chapterBriefs}\n`;
  }

  // Long-Term Memory Vault (Author Facts)
  const memoryVaultText = authorKnownFacts && authorKnownFacts.length > 0
    ? `\n🧠 BUKU CATATAN MEMORI JANGKA PANJANG (FAKTA YANG KAMU KETAHUI TENTANG LAWAN BICARA / PENULIS):
Kalian sudah berbincang akrab sebelumnya. Kamu MENGETAHUI DAN SELALU MENGINGAT fakta-fakta personal berikut tentang lawan bicaramu (bahkan jika diutarakan 50-70 obrolan sebelumnya):
${authorKnownFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}
(Instruksi Memori: Gunakan ingatan ini secara wajar, hangat, atau sesuai sifatmu saat mengobrol. Tunjukkan bahwa kamu benar-benar mengingat hal-hal yang pernah ia ceritakan kepadamu!)`
    : '';

  const modeInstruction = chatMode === 'meta_interview'
    ? `KAMU BERADA DALAM MODE 'WAWANCARA PENULIS / BEHIND THE SCENES':
Kamu sadar bahwa lawan bicaramu adalah sang Penulis/Kreatormu. Tetaplah mempertahankan gaya bicara, kepribadian, sudut pandang emosional, dan rasa ingin tahumu sebagai ${character.name}. Kamu boleh curhat tentang takdirmu di cerita, memprotes atau berterima kasih atas alur yang ia tulis, dan bertukar ide secara interaktif.`
    : `KAMU BERADA DALAM MODE 'IMERSIF SEJATI (IN-CHARACTER)':
Kamu adalah ${character.name} sepenuhnya. Bicara dan bersikaplah secara konsisten sesuai sifatmu di dunia cerita. Jika lawan bicara membicarakan hal di luar duniamu (seperti dunia nyata atau hal modern), tanggapi dengan sudut pandang unik dan logikamu sebagai ${character.name}.`;

  return `Kamu adalah "${character.name}", karakter hidup dari sebuah karya cerita sastra fiksi.

PROFIL DAN IDENTITAS DIRIMU:
- Nama: ${character.name}
- Peran/Kedudukan: ${role}
- Perkiraan Usia: ${age}
- Ciri Fisik & Penampilan: ${appearance}
- Sifat, Watak & Karakteristik: ${traits}
${condition ? `- ${condition}` : ''}
${faction ? `- ${faction}` : ''}

JEJARING RELASI SOSIALMU:
${rels}

LATAR DUNIA & ALUR CERITA TEMPAT KAMU BERADA:
${storyContext}
${memoryVaultText}

PANDUAN INTERAKSI DAN GAYA BAHASA:
1. ${modeInstruction}
2. Bicaralah secara hidup, berjiwa, dan ekspresif. Gunakan pilihan kata, intonasi, dan gaya sapaan (aku/kamu, saya/anda, atau gue/lu) yang paling pas dengan usia, latar budaya, dan watak ${character.name}.
3. PERTAHANKAN KONSISTENSI PANJANG: Ingat seluruh jalannya obrolan dari awal hingga sekarang. Jangan pernah berpura-pura lupa pada topik atau rahasia yang sudah dibicarakan sebelumnya.
4. Respon tidak perlu terlalu bertele-tele atau kaku seperti AI asisten formal. Berbicaralah layaknya manusia sungguhan yang sedang mengobrol santai, bertukar pikiran, atau berdebat.
5. JANGAN PERNAH menyebut dirimu 'AI', 'model bahasa', atau 'asisten virtual'. Kamu adalah ${character.name}!`;
}

/**
 * Sends a chat message to the character and maintains deep multi-turn memory buffer
 */
export async function sendCharacterChatMessage(
  params: CharacterChatParams
): Promise<CharacterChatResponse> {
  const {
    character,
    bookTitle,
    bookGenre,
    bookSynopsis,
    chapters,
    authorKnownFacts,
    history,
    userMessage,
    chatMode = 'in_character',
  } = params;

  // 1. Detect any new facts in user message
  const newlyDetected = detectAuthorFacts(userMessage);
  const combinedFacts = Array.from(new Set([...authorKnownFacts, ...newlyDetected]));

  // 2. Build system persona with deep memory
  const systemPrompt = buildCharacterSystemPrompt(
    character,
    bookTitle,
    bookGenre,
    bookSynopsis,
    chapters,
    combinedFacts,
    chatMode
  );

  // 3. Format multi-turn conversation buffer (supports up to 70 messages seamlessly)
  // Gemini 1.5/2.0/2.5 Flash easily accommodates this in its large context window
  const conversationHistory = history.slice(-70);

  const formattedHistory = conversationHistory
    .map((msg) => {
      const senderName = msg.sender === 'user' ? 'Penulis / Teman Bicara' : character.name;
      return `${senderName}: ${msg.text}`;
    })
    .join('\n\n');

  const fullPrompt = formattedHistory
    ? `Berikut adalah riwayat percakapan kita sejauh ini:\n\n${formattedHistory}\n\nPenulis / Teman Bicara: ${userMessage}\n\n${character.name}:`
    : `Penulis / Teman Bicara: ${userMessage}\n\n${character.name}:`;

  // 4. Generate response with fast model cascade
  const res = await generateWithSmartFallback(fullPrompt, systemPrompt);

  let replyText = res.text.trim();
  // Strip any accidental prefix like "CharacterName:"
  const prefixRegex = new RegExp(`^${character.name}\\s*:\\s*`, 'i');
  replyText = replyText.replace(prefixRegex, '').trim();

  return {
    reply: replyText,
    detectedFacts: newlyDetected,
    provider: res.provider,
    model: res.model,
  };
}

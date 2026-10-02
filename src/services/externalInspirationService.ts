/**
 * External Inspiration Services
 * Connects to open public APIs (Open5e / D&D 5e, Tarot, Wikimedia History, Useless Facts)
 * to provide live brainstorm prompts and worldbuilding inspiration.
 * Equipped with robust client-side fallbacks so it works even if offline.
 */

export interface Open5eItem {
  type: 'monster' | 'magic_item' | 'spell';
  name: string;
  category: string;
  description: string;
  extraInfo?: string;
}

export interface TarotCardResult {
  name: string;
  suit?: string;
  arcanaType?: string;
  uprightMeaning: string;
  reversedMeaning?: string;
  narrativePrompt: string;
}

export interface HistoricalEventResult {
  year: number;
  text: string;
  storyPrompt: string;
}

export interface FactResult {
  fact: string;
  thoughtPrompt: string;
}

// ==========================================
// 1. OPEN5E (D&D 5E Open Gaming License API)
// ==========================================
export async function fetchOpen5eInspiration(category: 'monster' | 'magic_item' | 'spell' = 'monster'): Promise<Open5eItem> {
  try {
    const endpoints = {
      monster: 'https://api.open5e.com/v1/monsters/?limit=50',
      magic_item: 'https://api.open5e.com/v1/magicitems/?limit=50',
      spell: 'https://api.open5e.com/v1/spells/?limit=50',
    };

    const res = await fetch(endpoints[category], { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const results = data.results || [];
    if (results.length === 0) throw new Error('No items returned');

    // Pick random item from batch
    const randomItem = results[Math.floor(Math.random() * results.length)];

    if (category === 'monster') {
      const abilities = (randomItem.special_abilities || [])
        .map((a: any) => `${a.name}: ${a.desc}`)
        .slice(0, 2)
        .join('\n');
      return {
        type: 'monster',
        name: randomItem.name,
        category: `${randomItem.size} ${randomItem.type} (CR ${randomItem.challenge_rating || '1'})`,
        description: randomItem.desc || randomItem.actions?.[0]?.desc || 'Makhluk legendaris dengan aura mengintimidasi.',
        extraInfo: abilities ? `Kemampuan Khusus:\n${abilities}` : undefined,
      };
    } else if (category === 'magic_item') {
      return {
        type: 'magic_item',
        name: randomItem.name,
        category: `${randomItem.rarity || 'Langka'} • ${randomItem.type || 'Artefak Magis'}`,
        description: (randomItem.desc || 'Sebuah artefak kuno yang memancarkan energi magis misterius.').slice(0, 500),
      };
    } else {
      return {
        type: 'spell',
        name: randomItem.name,
        category: `Tingkat ${randomItem.level || 'Dasar'} • Aliran ${randomItem.school || 'Misteri'}`,
        description: (randomItem.desc || 'Mantra sihir dengan efek manipulasi realitas.').slice(0, 500),
      };
    }
  } catch (err) {
    console.warn('Open5e API offline or blocked, using creative fallback:', err);
    // Creative offline fallbacks
    const fallbackMonsters: Open5eItem[] = [
      {
        type: 'monster',
        name: 'Gargoyle Mata Ambar',
        category: 'Makhluk Batu Terkutuk (CR 4)',
        description: 'Patung gargoyle yang hidup saat kegelapan turun. Tubuhnya kebal terhadap senjata tumpul konvensional dan matanya menyala ketika mendeteksi kebohongan.',
        extraInfo: 'Kelemahan: Cahaya fajar murni dan air suci yang diberkati.',
      },
      {
        type: 'magic_item',
        name: 'Kompas Jiwa yang Hilang',
        category: 'Sangat Langka • Artefak Navigasi Gaib',
        description: 'Jarum kompas ini tidak mengarah ke utara, melainkan ke arah hal yang paling dirindukan oleh orang yang sedang memegangnya. Namun, semakin sering dipakai, semakin kabur ingatan si pemegang.',
      },
      {
        type: 'spell',
        name: 'Kabut Memori Semu',
        category: 'Tingkat 3 • Aliran Ilusi & Pikiran',
        description: 'Menciptakan kabut perak pekat yang membuat siapapun yang menghirupnya mengingat kenangan terindah mereka, menjebak mereka dalam nostalgia sementara waktu berjalan.',
      },
    ];
    return fallbackMonsters[Math.floor(Math.random() * fallbackMonsters.length)];
  }
}

// ==========================================
// 2. TAROT CARDS (Plot Twist & Dilemma Prompts)
// ==========================================
export async function fetchTarotPrompt(): Promise<TarotCardResult> {
  try {
    const res = await fetch('https://tarotapi.dev/api/v1/cards/random?n=1');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const card = data.cards?.[0];
    if (!card) throw new Error('No tarot card');

    const isReversed = Math.random() > 0.6;
    const meaning = isReversed ? card.meaning_rev || card.meaning_up : card.meaning_up;

    return {
      name: card.name,
      suit: card.suit,
      arcanaType: card.type === 'major' ? 'Mayor Arcana' : 'Minor Arcana',
      uprightMeaning: card.meaning_up,
      reversedMeaning: card.meaning_rev,
      narrativePrompt: `🃏 **Kartu: ${card.name} (${isReversed ? 'Terbalik / Krisis' : 'Tegak / Takdir'})**
Makna Simbolik: "${meaning}"
💡 *Gunakan ini sebagai pemantik plot:* Hadirkan peristiwa atau pilihan moral di mana sang tokoh dihadapkan pada "${meaning}". Apakah ini ujian atau kehancuran baginya?`,
    };
  } catch (err) {
    console.warn('Tarot API offline, using fallback cards:', err);
    const fallbacks: TarotCardResult[] = [
      {
        name: 'The Tower (Menara Kehancuran)',
        arcanaType: 'Mayor Arcana',
        uprightMeaning: 'Krisis mendadak, rahasia terbongkar, keruntuhan tatanan lama.',
        narrativePrompt: '🃏 **Kartu: The Tower (Menara Kehancuran)**\nMakna Simbolik: Krisis mendadak dan keruntuhan ilusi.\n💡 *Gunakan ini sebagai plot twist:* Sebuah rencana yang disusun tokoh utama mendadak hancur berantakan akibat fakta rahasia yang terbongkar!',
      },
      {
        name: 'The Moon (Bulan Ilusi)',
        arcanaType: 'Mayor Arcana',
        uprightMeaning: 'Ketidakpastian, ilusi, ketakutan batin, pengkhianatan tersembunyi.',
        narrativePrompt: '🃏 **Kartu: The Moon (Bulan Ilusi)**\nMakna Simbolik: Sesuatu tidak tampak seperti aslinya.\n💡 *Gunakan ini sebagai plot twist:* Sekutu yang paling dipercaya ternyata memiliki motif tersembunyi, atau bukti yang ditemukan ternyata jebakan rekayasa.',
      },
      {
        name: 'The Wheel of Fortune (Roda Nasib)',
        arcanaType: 'Mayor Arcana',
        uprightMeaning: 'Titik balik takdir, keberuntungan tak terduga, pergeseran kekuasaan.',
        narrativePrompt: '🃏 **Kartu: The Wheel of Fortune (Roda Nasib)**\nMakna Simbolik: Perubahan nasib secara dramatis.\n💡 *Gunakan ini sebagai plot twist:* Tokoh yang tadinya berada di atas angin tiba-tiba jatuh miskin/terpojok, atau sebaliknya tokoh yang teraniaya mendapat peluang emas tak disengaja.',
      },
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// ==========================================
// 3. WIKIMEDIA "ON THIS DAY" (Historical Spark)
// ==========================================
export async function fetchHistoricalPrompt(): Promise<HistoricalEventResult> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  try {
    const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${month}/${day}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const events = data.events || [];
    if (events.length === 0) throw new Error('No historical events');

    const randomEvt = events[Math.floor(Math.random() * events.length)];
    return {
      year: randomEvt.year,
      text: randomEvt.text,
      storyPrompt: `⏳ **Peristiwa Sejarah (Tahun ${randomEvt.year}):**
"${randomEvt.text}"
💡 *Inspirasi Narasi:* Bayangkan peristiwa dramatis serupa diadopsi ke dalam intrik politik, perang kerajaan, atau penemuan rahasia di dunia ceritamu!`,
    };
  } catch (err) {
    console.warn('Wikipedia OnThisDay offline, using historical fallback:', err);
    const fallbacks: HistoricalEventResult[] = [
      {
        year: 1815,
        text: 'Letusan dahsyat Gunung Tambora yang menggelapkan langit belahan bumi utara dan menciptakan "Tahun Tanpa Musim Panas".',
        storyPrompt: '⏳ **Inspirasi Sejarah (Bencana Alam Global):**\n"Sebuah letusan gunung purba mengubah langit menjadi abu selama berbulan-bulan, menyebabkan gagal panen dan memicu perebutan cadangan makanan antar faksi."',
      },
      {
        year: 1588,
        text: 'Armada laut raksasa Spanyol yang dianggap tak terkalahkan hancur akibat badai laut dahsyat saat menyerang Inggris.',
        storyPrompt: '⏳ **Inspirasi Sejarah (Perang & Cuaca Ekstrem):**\n"Pasukan penakluk yang jauh lebih perkasa dipaksa mundur bukan karena kekuatan pedang musuh, melainkan badai alam yang tak terduga."',
      },
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// ==========================================
// 4. USELESS FACTS (Trivia & Lore Quirk)
// ==========================================
export async function fetchUselessFact(): Promise<FactResult> {
  try {
    const res = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      fact: data.text,
      thoughtPrompt: `💡 **Fakta Unik Dunia:**
"${data.text}"
🧐 *Inspirasi Cerita:* Bisakah fakta unik atau anomali ini dijadikan bahan obrolan santai antar karakter, atau prinsip hukum alam unik di duniamu?`,
    };
  } catch (err) {
    console.warn('Facts API offline, using fallback:', err);
    return {
      fact: 'Gagak mampu mengingat wajah manusia yang pernah berbuat jahat kepada mereka dan mengajarkan dendam tersebut kepada anak-anak mereka.',
      thoughtPrompt: '💡 **Fakta Unik Dunia:**\n"Burung gagak mewariskan memori wajah musuh antar generasi."\n🧐 *Inspirasi Cerita:* Bagaimana jika ada binatang mata-mata atau suku pengintai yang mewariskan dendam visual turun temurun seperti ini?',
    };
  }
}

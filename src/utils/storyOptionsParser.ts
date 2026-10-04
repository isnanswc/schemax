export interface StoryOptionItem {
  id: string;
  key: string;       // e.g. "Opsi 1", "Opsi A"
  title: string;     // e.g. "Gerbang Langit Misterius"
  content: string;   // full text of this option
  preview: string;   // short excerpt for display
}

export function parseStoryOptions(text: string): StoryOptionItem[] | null {
  if (!text || typeof text !== 'string') return null;

  // Regex to match option headers like:
  // ### Opsi 1: Judul
  // ### Opsi A: Judul
  // **Opsi 1: Judul**
  // 1. **Opsi A: Judul**
  // **1. Opsi A: Judul**
  // ### Alternatif 2: Judul
  // **Pilihan B:** Judul
  // Konsep 1: Judul
  const pattern = /(?:^|\n)(?:#{1,4}\s*)?(?:\d+[\.\)]\s*)?(?:\*\*)?(?:(?:\d+[\.\)]\s*)?)?(Opsi|Pilihan|Alternatif|Konsep)\s+([A-Za-z0-9]+|\b(?:Satu|Dua|Tiga|Empat|Lima|Pertama|Kedua|Ketiga|Keempat|Kelima)\b)(?:[\*:]*)\s*([^\n\r]*)/gi;

  const matches: Array<{
    index: number;
    prefix: string;
    label: string;
    title: string;
  }> = [];

  let m;
  while ((m = pattern.exec(text)) !== null) {
    matches.push({
      index: m.index,
      prefix: m[1],
      label: m[2],
      title: m[3] ? m[3].replace(/^\*\*|\*\*$/g, '').replace(/^[:\-\s]+/, '').trim() : ''
    });
  }

  if (matches.length < 2) return null;

  const options: StoryOptionItem[] = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i < matches.length - 1 ? matches[i + 1].index : text.length;
    const rawContent = text.slice(start, end).trim();
    // remove potential ending tags like [STORY_BLUEPRINT_READY] and [NEXT_CHAPTER_PLAN_READY]
    const content = rawContent.replace(/\[STORY_BLUEPRINT_READY\]|\[NEXT_CHAPTER_PLAN_READY\]/g, '').trim();

    // First 2-3 descriptive lines as preview summary
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const preview = lines.slice(1, 4).join(' ').replace(/[*#_`]/g, '').slice(0, 140) + '...';

    options.push({
      id: `opt_${i + 1}`,
      key: `${matches[i].prefix} ${matches[i].label}`,
      title: matches[i].title || `${matches[i].prefix} ${matches[i].label}`,
      content: content,
      preview: preview
    });
  }

  return options;
}

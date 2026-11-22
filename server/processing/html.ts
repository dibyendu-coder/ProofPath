const ignoredBlocks =
  /<(script|style|noscript|svg|nav|footer|header|form|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const blockBreak =
  /<\/?(?:p|div|section|article|main|h[1-6]|li|br|tr|blockquote|address)\b[^>]*>/gi;
const tags = /<[^>]*>/g;

function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
  };
  return input.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith('#')) {
        const codePoint =
          entity[1]?.toLowerCase() === 'x'
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return codePoint > 0 &&
          codePoint <= 0x10ffff &&
          !(codePoint >= 0xd800 && codePoint <= 0xdfff)
          ? String.fromCodePoint(codePoint)
          : match;
      }
      return named[entity.toLowerCase()] ?? match;
    },
  );
}

export function extractHtml(input: string): {
  title?: string;
  text: string;
  partial: boolean;
} {
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(input);
  const title = titleMatch
    ? decodeEntities(
        titleMatch[1].replace(tags, '').replace(/\s+/g, ' ').trim(),
      ).slice(0, 240)
    : undefined;
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(input);
  const relevant = bodyMatch?.[1] ?? input;
  const text = decodeEntities(
    relevant
      .replace(ignoredBlocks, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ')
      .replace(blockBreak, '\n')
      .replace(tags, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
  return { title, text: text.slice(0, 20_000), partial: text.length > 20_000 };
}

export function extractPlainText(input: string): {
  text: string;
  partial: boolean;
} {
  const text = input.replace(/\r\n?/g, '\n').trim();
  return { text: text.slice(0, 20_000), partial: text.length > 20_000 };
}

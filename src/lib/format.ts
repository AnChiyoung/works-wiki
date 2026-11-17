const dateTimeFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 2026-11-18 09:05 형식 (한국 시간) */
export function formatDateTime(date: Date): string {
  const parts = Object.fromEntries(dateTimeFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** 렌더링된 HTML에서 검색엔진용 설명 글을 뽑는다. 목차는 뺀다. */
export function htmlToDescription(html: string, maxLength = 150): string {
  const text = html
    .replace(/<nav[\s\S]*?<\/nav>/g, ' ')
    .replace(/<span class="heading-number">[\s\S]*?<\/span>|<a class="heading-number"[\s\S]*?<\/a>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

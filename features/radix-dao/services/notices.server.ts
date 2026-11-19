import 'server-only';
import {
  DAO_EXTERNAL_LINKS,
  DAO_NOTICE_ATTACHMENTS,
  FALLBACK_DAO_NOTICES,
  extractNoticeSlug,
} from '../data/radixDaoData';
import type { DaoNoticeItem } from '../types/radixDao.types';

interface RawJsonFeedItem {
  id?: string;
  url?: string;
  title?: string;
  date_published?: string;
  tags?: string[];
}

interface RawJsonFeed {
  items?: RawJsonFeedItem[];
}

export interface NoticesResult {
  items: DaoNoticeItem[];
  source: 'live' | 'fallback';
}

/**
 * Fetches the official Radix DAO Notices JSON Feed (`https://radixdao.org/notices.json`).
 * Falls back cleanly to the latest verified snapshot if offline or unreachable.
 */
export async function fetchDaoNotices(): Promise<NoticesResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(DAO_EXTERNAL_LINKS.noticesJson, {
      signal: controller.signal,
      next: { revalidate: 3600 },
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return { items: FALLBACK_DAO_NOTICES, source: 'fallback' };
    }

    const data = (await res.json()) as RawJsonFeed;
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return { items: FALLBACK_DAO_NOTICES, source: 'fallback' };
    }

    const items: DaoNoticeItem[] = data.items
      .filter((item): item is Required<Pick<RawJsonFeedItem, 'url' | 'title'>> & RawJsonFeedItem =>
        Boolean(item.url && item.title)
      )
      .map((item) => {
        const slug = extractNoticeSlug(item.url);
        const attachment = DAO_NOTICE_ATTACHMENTS[slug];
        return {
          id: item.id ?? item.url,
          slug,
          url: item.url,
          title: item.title.replace(/\s*—\s*/g, ': '),
          datePublished: item.date_published ?? '',
          category: item.tags?.[0] ?? 'Notice',
          pdfUrl: attachment?.pdfUrl,
          pdfName: attachment?.pdfName,
        };
      });

    if (items.length === 0) {
      return { items: FALLBACK_DAO_NOTICES, source: 'fallback' };
    }

    return { items, source: 'live' };
  } catch {
    return { items: FALLBACK_DAO_NOTICES, source: 'fallback' };
  } finally {
    clearTimeout(timeout);
  }
}

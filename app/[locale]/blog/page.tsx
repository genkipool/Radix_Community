import BlogClient from '@/features/blog/BlogClient';
import { getDictionary, type Locale } from '@/i18n/dictionaries';
import type { BlogPost } from '@/features/blog/types';
import { unstable_cache } from 'next/cache';
import { buildAlternates } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getDictionary(locale as Locale);
  return {
    title: t.seo.blog.title,
    description: t.seo.blog.description,
    alternates: buildAlternates(locale, '/blog'),
  };
}

// ═══════ ISR + SSG — generateStaticParams ═══════
// Pre-build /en/blog and /es/blog at deploy time.
// getDictionary is a pure read of bundled i18n files (no network), so
// we only need a short cache — the content changes only on redeploy anyway.
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

const getBlogPosts = (locale: string): Promise<BlogPost[]> =>
  unstable_cache(
    async () => {
      const dictionary = await getDictionary(locale as Locale);
      return dictionary.blog?.posts ?? [];
    },
    [`blog-posts-${locale}`],
    { revalidate: 3600 },
  )();

interface BlogPageProps {
    params: Promise<{ locale: string }>;
}

export default async function BlogPage({ params }: BlogPageProps) {
    const { locale } = await params;
    const initialPosts = await getBlogPosts(locale);
    return <BlogClient initialPosts={initialPosts} />;
}

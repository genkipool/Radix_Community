import { Suspense } from 'react';
import BlogClient from '@/features/blog/BlogClient';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import type { BlogPost } from '@/features/blog/types';
import { buildMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['blog']);
  return buildMetadata({
    locale,
    pathname: '/blog',
    title: t.seo.blog.title,
    description: t.seo.blog.description,
  });
}

// ═══════ ISR + SSG — generateStaticParams ═══════
// Pre-build /en/blog and /es/blog at deploy time.
// getDictionary is a pure read of bundled i18n files (no network), so
// we only need a short cache — the content changes only on redeploy anyway.
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

const getBlogPosts = async (locale: string): Promise<BlogPost[]> => {
  "use cache";
  const dictionary = await getFeatureDictionary(locale as Locale, ['blog']);
  return dictionary.blog?.posts ?? [];
};

interface BlogPageProps {
    params: Promise<{ locale: string }>;
}

export default async function BlogPage({ params }: BlogPageProps) {
    const { locale } = await params;
    const [t, initialPosts] = await Promise.all([
        getFeatureDictionary(locale as Locale, ['blog']),
        getBlogPosts(locale)
    ]);
    return (
        <Suspense fallback={null}>
            <DictionaryEnricher partial={t} />
            <BlogClient initialPosts={initialPosts} dictionary={t} />
        </Suspense>
    );
}

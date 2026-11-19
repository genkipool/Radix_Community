import type { Metadata } from 'next';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { buildMetadata } from '@/lib/seo';
import {
  DaoContactSection,
  DaoDocumentsSection,
  DaoFoundingSequence,
  DaoHero,
  DaoNoticesSection,
  DaoOverviewSection,
  DaoParticipateSection,
  DaoPeopleSection,
  DaoVerifySection,
  fetchDaoNotices,
} from '@/features/radix-dao';
import '@/features/radix-dao/styles/radixDao.css';

export const revalidate = 3600;

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['radixDao']);

  return buildMetadata({
    locale,
    pathname: '/radix-dao',
    title: t.seo.radixDao.title,
    description: t.seo.radixDao.description,
    keywords: t.seo.radixDao.keywords,
  });
}

interface RadixDaoPageProps {
  params: Promise<{ locale: string }>;
}

export default async function RadixDaoPage({ params }: RadixDaoPageProps) {
  const { locale } = await params;
  const [t, noticesResult] = await Promise.all([
    getFeatureDictionary(locale as Locale, ['radixDao']),
    fetchDaoNotices(),
  ]);

  const dao = t.radixDao;

  return (
    <div>
      <DictionaryEnricher partial={t} />
      <DaoHero hero={dao.hero} sequenceSteps={dao.sequence.steps} />
      <DaoOverviewSection overview={dao.overview} />
      <DaoFoundingSequence sequence={dao.sequence} />
      <DaoParticipateSection participate={dao.participate} />
      <DaoDocumentsSection documents={dao.documents} />
      <DaoPeopleSection people={dao.people} />
      <DaoVerifySection verify={dao.verify} docItems={dao.documents.items} locale={locale} />
      <DaoNoticesSection
        notices={dao.notices}
        docCopy={dao.documents}
        items={noticesResult.items}
        source={noticesResult.source}
        locale={locale}
      />
      <DaoContactSection contact={dao.contact} />
    </div>
  );
}

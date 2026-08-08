'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import type { SignDictionary } from '../types/dictionary';

/**
 * A signing error, with the way out of it as a link.
 *
 * Most of these messages name something the signer has to go and do, and the
 * one that matters most — "you have no signing collection" — used to end in
 * "create them in the steps above" while the steps in question live on another
 * page. So messages may carry a `{collectionLink}` placeholder, which is
 * rendered here as a link into the collection tool.
 */
export function SignErrorText({ t, code }: { t: SignDictionary; code: string }) {
  const { language } = useLanguage();
  const errors = t.errors as Record<string, string>;
  const text = errors[code] ?? errors.generic;
  const [before, after] = text.split('{collectionLink}');
  if (after === undefined) return <>{text}</>;
  return (
    <>
      {before}
      <Link
        href={`/${language}/console/sign-collection`}
        className="font-bold underline underline-offset-2"
        style={{ color: 'var(--color-primary)' }}
      >
        {errors.collectionSectionLink}
      </Link>
      {after}
    </>
  );
}

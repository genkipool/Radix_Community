import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Not Found',
  // A 404 already keeps this out of the index, but the explicit directive
  // covers crawlers that queue the URL before they see the status code.
  robots: { index: false, follow: false },
};

export default function CatchAll() {
  notFound();
}

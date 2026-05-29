import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Not Found',
};

export default function CatchAll() {
  notFound();
}

'use client';
import { AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { ContentHero } from '@/components/layout/ContentHero';
import { SearchBar } from '@/components/ui/SearchBar';
import { TagFilterBar } from '@/components/ui/TagFilterBar';
import { GridToggle } from '@/components/ui/GridToggle';
import { Button } from '@/components/ui/Button';
import { useLayout } from '@/context/LayoutContext';

import { DAPP_TAGS } from './data/dappsData';
import { type DApp } from './types/data.types';
import { type DAppsClientProps } from './types/components.types';
import { RichDescription } from './components/RichDescription';
import { PublishModal } from './components/PublishModal';
import { DAppCard } from './components/DAppCard';

export default function DAppsClient({ t, initialDapps }: DAppsClientProps) {
  const { setShowUnderConstruction } = useLayout();
  const dt = t.dapps_page;

  const [dappList, setDappList] = useState<DApp[]>(initialDapps);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [columns, setColumns] = useState(3);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [dislikedIds, setDislikedIds] = useState<Set<number>>(new Set());
  const [showPublishModal, setShowPublishModal] = useState(false);

  const filtered = (() => {
    let result = [...dappList];
    if (activeTag) result = result.filter(d => d.tags.includes(activeTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => {
        const desc = d.isUserAdded
          ? d.description
          : (dt.items as Record<string, { description: string }>)?.[String(d.id)]?.description || d.description;
        return (
          d.name.toLowerCase().includes(q) ||
          desc.toLowerCase().includes(q) ||
          d.tags.some((tag: string) => tag.toLowerCase().includes(q))
        );
      });
    }
    const sorted = [...result];
    sorted.sort((a, b) => (b.isSponsored ? 1 : 0) - (a.isSponsored ? 1 : 0));
    return sorted;
  })();

  const toggleLike = (id: number) => {
    setLikedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
        setDislikedIds(p => { const m = new Set(p); m.delete(id); return m; });
      }
      return n;
    });
  };

  const toggleDislike = (id: number) => {
    setDislikedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
        setLikedIds(p => { const m = new Set(p); m.delete(id); return m; });
      }
      return n;
    });
  };

  const handlePublish = (data: Omit<DApp, 'id' | 'likes' | 'dislikes' | 'isUserAdded'>) => {
    setDappList(prev => [{
      ...data,
      id: Date.now(),
      likes: 0,
      dislikes: 0,
      isUserAdded: true,
    }, ...prev]);
  };

  /** Placeholder — wire up a real Radix wallet connector here in the future */
  const handleConnectWallet = () => {
    // TODO: integrate Radix wallet connector SDK
    setShowUnderConstruction(true);
  };

  const gridColsClass = ({
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  } as Record<number, string>)[columns] ?? 'grid-cols-1 md:grid-cols-2';

  return (
    <ContentHero
      title={dt.header.title_accent}
      brandName={dt.header.brand}
      heroPadding="pt-32 pb-4"
      subtitle={
        <div className="text-[var(--color-text-muted)] max-w-4xl mx-auto leading-relaxed mb-8 text-center space-y-4">
          <p>
            <RichDescription
              text={dt.header.description}
              keywords={dt.header.description_highlights ?? []}
              ctaPhrase={dt.header.cta_connect_wallet ?? ''}
              onCtaClick={handleConnectWallet}
            />
          </p>
        </div>
      }
    >
      {/* Controls */}
      <section className="pb-0">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 space-y-4 mt-[-8px]">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={dt.controls.search_placeholder}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <TagFilterBar
              tags={[...DAPP_TAGS]}
              activeTag={activeTag}
              onSelect={setActiveTag}
              allLabel={dt.controls.all_tags}
            />

            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <Button
                onClick={() => setShowPublishModal(true)}
                variant="primary"
                size="sm"
                className="!rounded-xl"
                leftIcon={<Plus className="size-4" />}
              >
                {dt.controls.publish}
              </Button>
              <GridToggle
                columns={columns}
                onChange={setColumns}
                label={dt.controls.columns}
                min={1}
                max={3}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="pt-6 pb-24">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className={`grid gap-5 ${gridColsClass}`}>
            {filtered.map((dapp, i) => (
              <DAppCard
                key={dapp.id}
                dapp={dapp}
                index={i}
                searchQuery={searchQuery}
                liked={likedIds.has(dapp.id)}
                disliked={dislikedIds.has(dapp.id)}
                onLike={() => toggleLike(dapp.id)}
                onDislike={() => toggleDislike(dapp.id)}
                t={t}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-[var(--color-text-muted)] py-24 text-lg">
              {dt.no_results}
            </div>
          )}
        </div>
      </section>

      {/* Publish modal */}
      <AnimatePresence>
        {showPublishModal && (
          <PublishModal
            onClose={() => setShowPublishModal(false)}
            onPublish={handlePublish}
            tagLabels={{}}
            t={t}
            setShowUnderConstruction={setShowUnderConstruction}
          />
        )}
      </AnimatePresence>
    </ContentHero>
  );
}

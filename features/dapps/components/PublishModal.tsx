/**
 * features/dapps/components/PublishModal.tsx
 */

'use client';
import { m } from "motion/react";
import React, { useState, useId } from 'react';
import { X, FileText, Layers, ImageIcon, Globe, Tag, Wallet, Sparkles, CheckCircle } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { Button } from '@/components/ui/Button';
import { DAPP_TAGS } from '../data/dappsData';
import { type PublishModalProps } from '../types/components.types';
import { MAX_TAGS, MAX_DESC_CHARS } from '../constants';

export function PublishModal({ onClose, onPublish, t, setShowUnderConstruction }: PublishModalProps) {
  const formId = useId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleTag = (tag: string) =>
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(item => item !== tag)
        : prev.length < MAX_TAGS
          ? [...prev, tag]
          : prev,
    );

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t.dapps_page.modal.error_name;
    if (!description.trim()) e.description = t.dapps_page.modal.error_description;
    if (!websiteUrl.trim()) e.websiteUrl = t.dapps_page.modal.error_website;
    else {
      try {
        new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
      } catch {
        e.websiteUrl = t.dapps_page.modal.error_website_invalid;
      }
    }
    if (!selectedTags.length) e.tags = t.dapps_page.modal.error_tags;
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const normalUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    onPublish({
      name: name.trim(),
      description: description.trim(),
      logoUrl,
      websiteUrl: normalUrl,
      tags: selectedTags,
      isSponsored: false,
    });
    setSubmitted(true);
    setTimeout(onClose, 1800);
  };

  return (
    <>
      <ModalOverlay onClose={onClose} blur="md" />
      <m.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-[var(--color-surface)]/95 backdrop-blur-2xl border border-[var(--color-card-border)] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 flex items-center justify-between border-b border-[var(--color-card-border)] relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/10 via-transparent to-[var(--color-accent)]/5 pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="size-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white shadow-lg shrink-0">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-main)] tracking-tight">
                  {t.dapps_page.modal.title}
                </h3>
                <p className="text-[9px] uppercase tracking-widest font-bold text-[var(--color-primary)] opacity-80">
                  {t.dapps_page.modal.subtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.dapps_page.modal.close_aria}
              className="size-9 rounded-full hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-all border border-transparent hover:border-[var(--color-card-border)] relative z-10"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-5">
            {submitted ? (
              <m.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-16 gap-4"
              >
                <CheckCircle className="size-16 text-[var(--color-primary)]" />
                <p className="text-lg font-bold text-[var(--color-text-main)]">
                  {t.dapps_page.modal.success}
                </p>
              </m.div>
            ) : (
              <>
                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor={`${formId}-name`} className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                    <FileText className="size-3.5 text-[var(--color-primary)]" />
                    {t.dapps_page.modal.field_name}
                  </label>
                  <input
                    id={`${formId}-name`}
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                    placeholder={t.dapps_page.modal.placeholder_name}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[var(--color-card-border)] bg-[var(--color-bg)]/50 text-[var(--color-text-main)] text-sm focus:outline-none focus:border-[var(--color-primary)]/50 transition-all placeholder:text-[var(--color-text-muted)]/40 shadow-inner"
                  />
                  {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label htmlFor={`${formId}-desc`} className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                    <Layers className="size-3.5 text-[var(--color-primary)]" />
                    {t.dapps_page.modal.field_description}
                  </label>
                  <textarea
                    id={`${formId}-desc`}
                    rows={4}
                    value={description}
                    onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })); }}
                    placeholder={t.dapps_page.modal.placeholder_description}
                    maxLength={MAX_DESC_CHARS}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[var(--color-card-border)] bg-[var(--color-bg)]/50 text-[var(--color-text-main)] text-sm leading-relaxed focus:outline-none focus:border-[var(--color-primary)]/50 transition-all resize-none placeholder:text-[var(--color-text-muted)]/40 shadow-inner custom-scrollbar"
                  />
                  <p className="text-right text-[10px] text-[var(--color-text-muted)]/60">
                    {description.length}/{MAX_DESC_CHARS}
                  </p>
                  {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description}</p>}
                </div>

                {/* Logo URL */}
                <div className="space-y-1.5">
                  <label htmlFor={`${formId}-logo`} className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                    <ImageIcon className="size-3.5 text-[var(--color-primary)]" />
                    {t.dapps_page.modal.field_logo}
                    <span className="text-[9px] normal-case tracking-normal font-normal opacity-60">
                      {t.dapps_page.modal.optional}
                    </span>
                  </label>
                  <input
                    id={`${formId}-logo`}
                    type="url"
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    placeholder={t.dapps_page.modal.placeholder_logo}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[var(--color-card-border)] bg-[var(--color-bg)]/50 text-[var(--color-text-main)] text-sm focus:outline-none focus:border-[var(--color-primary)]/50 transition-all placeholder:text-[var(--color-text-muted)]/40 shadow-inner"
                  />
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                  <label htmlFor={`${formId}-url`} className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                    <Globe className="size-3.5 text-[var(--color-primary)]" />
                    {t.dapps_page.modal.field_website}
                  </label>
                  <input
                    id={`${formId}-url`}
                    type="url"
                    value={websiteUrl}
                    onChange={e => { setWebsiteUrl(e.target.value); setErrors(p => ({ ...p, websiteUrl: '' })); }}
                    placeholder={t.dapps_page.modal.placeholder_website}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[var(--color-card-border)] bg-[var(--color-bg)]/50 text-[var(--color-text-main)] text-sm focus:outline-none focus:border-[var(--color-primary)]/50 transition-all placeholder:text-[var(--color-text-muted)]/40 shadow-inner"
                  />
                  {errors.websiteUrl && <p className="text-xs text-red-400 mt-1">{errors.websiteUrl}</p>}
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                    <Tag className="size-3.5 text-[var(--color-primary)]" />
                    {t.dapps_page.modal.field_tags}
                    <span className="text-[9px] normal-case tracking-normal font-normal opacity-60">
                      {t.dapps_page.modal.tags_max}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-[var(--color-bg)]/60 border border-[var(--color-card-border)]">
                    {DAPP_TAGS.map(tag => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button aria-label="button action"
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${isSelected
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                            : 'text-[var(--color-text-main)] bg-[var(--color-bg-alt)] border-[var(--color-border)] opacity-70 hover:opacity-100'
                            }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  {errors.tags && <p className="text-xs text-red-400">{errors.tags}</p>}
                </div>

                {/* Wallet notice */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-accent)]/5 border border-[var(--color-primary)]/20">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-xl bg-white/10 flex items-center justify-center text-[var(--color-primary)] shrink-0 border border-white/10">
                      <Wallet className="size-5" />
                    </div>
                    <div>
                      <button aria-label="button action"
                        type="button"
                        onClick={() => setShowUnderConstruction(true)}
                        className="text-left font-bold text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        {t.dapps_page.modal.badge_title}
                      </button>
                      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mt-0.5">
                        {t.dapps_page.modal.badge_desc}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!submitted && (
            <div className="p-5 pt-0 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
              <Button variant="ghost" onClick={onClose}>
                {t.dapps_page.modal.cancel}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                leftIcon={<Sparkles className="size-4" />}
              >
                {t.dapps_page.modal.publish}
              </Button>
            </div>
          )}
        </div>
      </m.div>
    </>
  );
}

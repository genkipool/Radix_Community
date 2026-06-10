'use client';

import { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence } from "motion/react";
import { X, Send, Building2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { sendInstitutionalPilotMessage } from '../../actions/index';

import type { InstitutionalPilotModalProps } from '../../types';

/* ─── Component ────────────────────────────────────────────────────────────── */
export default function InstitutionalPilotModal({
  isOpen,
  onClose,
  t,
  lang,
}: InstitutionalPilotModalProps) {
  // Access the institutionalPilot namespace
  const c = t.institutionalPilot;

  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX = 1200;

  const validateEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const isEmailPadding = emailTouched && !validateEmail(email);

  /* Focus textarea when modal opens */
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      const id = setTimeout(() => textareaRef.current?.focus(), 120);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  /* Reset on close — key prop on parent handles full remount */

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSend = async () => {
    if (!message.trim() || !validateEmail(email) || status !== 'idle') return;

    setStatus('sending');
    setError(null);

    try {
      const result = await sendInstitutionalPilotMessage({ email, message, lang });

      if (result.success) {
        setStatus('sent');
      } else {
        // Translate the error key or fallback to generic
        const errorKey = result.error as string;
        const translatedError = (c as Record<string, string>)[errorKey] || c.errorGeneric || 'An error occurred';
        setError(translatedError);
        setStatus('idle');
      }
    } catch (_err) {
      setError(c.errorGeneric || 'An unexpected error occurred');
      setStatus('idle');
    }
  };

  const remaining = MAX - message.length;
  const isOverLimit = remaining < 0;

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <m.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Panel */}
            <m.div
              key="panel"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-2xl rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-[var(--color-card-border)]">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-secondary)]/20 border border-[var(--color-accent)]/30 flex items-center justify-center">
                      <Building2 className="size-5 text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)] mb-0.5">
                        {c.badge}
                      </p>
                      <h2 className="text-lg font-bold text-[var(--color-text-main)] leading-none">
                        {c.title}
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="size-8 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg)] transition-colors"
                    aria-label={c.close ?? 'Close'}
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Body */}
                <AnimatePresence mode="wait">
                  {status === 'sent' ? (
                    /* ── Success state ── */
                    <m.div
                      key="success"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-7 py-12 text-center"
                    >
                      <div className="size-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
                        <CheckCircle2 className="size-8 text-green-400" />
                      </div>
                      <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-3">
                        {c.successTitle}
                      </h3>
                      <p className="text-[var(--color-text-muted)] leading-relaxed max-w-md mx-auto text-sm">
                        {c.successBody}
                      </p>
                      <button aria-label={c.close}
                        type="button"
                        onClick={onClose}
                        className="mt-8 px-6 py-2.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-card-border)] text-sm font-semibold text-[var(--color-text-main)] hover:border-[var(--color-primary)]/50 transition-colors"
                      >
                        {c.close}
                      </button>
                    </m.div>
                  ) : (
                    /* ── Form state ── */
                    <m.div
                      key="form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-7 py-6"
                    >
                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
                        {c.subtitle}
                      </p>

                      <label className="block mb-1.5">
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                          {c.emailLabel}
                        </span>
                      </label>
                      <input
                        id="pilot-email"
                        name="email"
                        type="email"
                        aria-label={c.emailLabel}
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onBlur={() => setEmailTouched(true)}
                        placeholder={c.emailPlaceholder}
                        className={`w-full rounded-xl bg-[var(--color-bg)] border ${isEmailPadding ? 'border-red-500' : 'border-[var(--color-card-border)]'
                          } text-[var(--color-text-main)] text-sm placeholder:text-[var(--color-text-muted)]/50 p-4 mb-4 focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors`}
                      />
                      {isEmailPadding && (
                        <p className="text-[10px] text-red-500 font-medium -mt-3 mb-4 pl-1">
                          {c.emailError}
                        </p>
                      )}

                      <label className="block mb-1.5">
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                          {c.label}
                        </span>
                      </label>
                      <textarea
                        ref={textareaRef}
                        id="pilot-message"
                        name="message"
                        aria-label={c.label}
                        value={message}
                        onChange={e => {
                          if (e.target.value.length <= MAX + 20) setMessage(e.target.value);
                        }}
                        rows={8}
                        placeholder={c.placeholder}
                        className="w-full rounded-xl bg-[var(--color-bg)] border border-[var(--color-card-border)] text-[var(--color-text-main)] text-sm placeholder:text-[var(--color-text-muted)]/50 p-4 resize-none focus:outline-none focus:border-[var(--color-primary)]/60 transition-colors leading-relaxed"
                      />

                      <div className="flex items-center justify-between mt-2 mb-6">
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed max-w-sm">
                          {c.hint}
                        </p>
                        <span
                          className={`text-xs font-mono tabular-nums ${isOverLimit
                            ? 'text-red-400'
                            : remaining < 100
                              ? 'text-amber-400'
                              : 'text-[var(--color-text-muted)]'
                            }`}
                        >
                          {message.length} / {MAX}
                        </span>
                      </div>

                      {error && (
                        <div className="flex items-center gap-2 p-3 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs animate-in fade-in slide-in-from-top-1">
                          <AlertCircle className="size-4 shrink-0" />
                          <p>{error}</p>
                        </div>
                      )}

                      <button aria-label={status === 'sending' ? c.sending : c.send}
                        type="button"
                        onClick={handleSend}
                        disabled={!message.trim() || !validateEmail(email) || isOverLimit || status === 'sending'}
                        className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                      >
                        {status === 'sending' ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            {c.sending}
                          </>
                        ) : (
                          <>
                            <Send className="size-4" />
                            {c.send}
                          </>
                        )}
                      </button>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}

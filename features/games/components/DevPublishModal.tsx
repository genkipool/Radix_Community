'use client';

import { X, Code2, Trophy, Percent, Wallet, Gamepad2, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useEffect } from 'react';

import { DevPublishModalProps } from '../types';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-bold mb-3" style={{ color: 'var(--color-text-main)' }}>
        <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatBox({ value, label, gradient }: { value: string; label: string; gradient: string }) {
  return (
    <div className="rounded-2xl p-4 text-center flex-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
      <p className={`text-3xl font-black bg-gradient-to-br ${gradient} bg-clip-text text-transparent`}>{value}</p>
      <p className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
    </div>
  );
}

export default function DevPublishModal({ isOpen, onClose }: DevPublishModalProps) {
  const { t: dict } = useLanguage();
  const t = dict.games.devModal;

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl flex flex-col"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b sticky top-0 z-10"
          style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)' }}
        >
          <div className="flex items-center gap-3">
            <Code2 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-main)' }}>
              {t.title ?? 'Publica tu juego en Radix Games'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-muted)' }} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-8">

          {/* Intro */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {t.intro ?? 'Con tu badge de Radix Games puedes publicar tus propios juegos en la plataforma y hacerlos accesibles a toda la comunidad. Cualquier desarrollador con badge puede subir su juego, crear torneos y compartir sus creaciones con miles de jugadores.'}
            </p>
          </div>

          {/* How it works */}
          <Section icon={<Gamepad2 className="w-5 h-5" />} title={t.how_title ?? '¿Cómo funciona?'}>
            <div className="space-y-3">
              {[
                { step: '1', label: t.step1_title ?? 'Adquiere tu badge', desc: t.step1_desc ?? 'Obtén tu badge de desarrollador pagando en XRD. La misma badge te permite jugar en torneos y publicar tus juegos.' },
                { step: '2', label: t.step2_title ?? 'Sube tu juego', desc: t.step2_desc ?? 'Envía tu juego a través del panel de desarrolladores. Nuestro equipo lo revisa y lo publica en la plataforma.' },
                { step: '3', label: t.step3_title ?? 'Crea torneos', desc: t.step3_desc ?? 'Configura torneos semanales para tu juego. Los jugadores pagan con XRD para participar y compiten por el bote de premios.' },
                { step: '4', label: t.step4_title ?? 'Gana con tu juego', desc: t.step4_desc ?? 'Cada vez que se juegue un torneo en tu juego, recibes parte de la recaudación directamente en tu billetera Radix.' },
              ].map(({ step, label, desc }) => (
                <div key={step} className="flex gap-4 p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-bg)' }}
                  >
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--color-text-main)' }}>{label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Revenue split */}
          <Section icon={<Percent className="w-5 h-5" />} title={t.revenue_title ?? 'Distribución de ingresos del torneo'}>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatBox value="80%" label={t.rev_players ?? 'Premios jugadores'} gradient="from-green-500 to-emerald-400" />
              <StatBox value="15%" label={t.rev_dev ?? 'Para el desarrollador'} gradient="from-violet-500 to-purple-400" />
              <StatBox value="5%" label={t.rev_community ?? 'Comunidad Radix'} gradient="from-cyan-500 to-blue-400" />
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {t.revenue_desc ?? 'De cada torneo celebrado en tu juego, el 80% de la recaudación va íntegra a premios para los jugadores, el 15% lo recibes tú como desarrollador directamente en XRD en tu billetera Radix, y el 5% restante se destina al fondo de la comunidad Radix para financiar el crecimiento del ecosistema.'}
              </p>
            </div>
          </Section>

          {/* Badge requirement */}
          <Section icon={<Wallet className="w-5 h-5" />} title={t.badge_title ?? 'Requisito: tu badge de Radix Games'}>
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-primary)' }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--color-primary)', opacity: 0.9 }}
              >
                <Trophy className="w-5 h-5" style={{ color: 'var(--color-bg)' }} />
              </div>
              <div>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-primary)' }}>
                  {t.badge_note_title ?? 'Una badge, múltiples beneficios'}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {t.badge_note_desc ?? 'Con una única badge pagada en XRD tienes acceso a competir en torneos, registrar tus puntuaciones y publicar tus propios juegos. La badge te acredita como miembro activo del ecosistema Radix Games.'}
                </p>
              </div>
            </div>
          </Section>

          {/* CTA */}
          <div className="flex items-center justify-center">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-primary)', color: 'var(--color-bg)' }}
            >
              {t.cta ?? 'Adquiere tu badge y empieza a crear'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

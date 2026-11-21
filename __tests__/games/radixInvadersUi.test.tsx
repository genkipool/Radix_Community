import { createRef } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import esGames from '@/features/games/locales/es.json';
import { BadgeScreen, IntroScreen } from '@/features/games/games/radix-invaders/components/GameIntroScreens';
import FunLevelSelectScreen from '@/features/games/games/radix-invaders/components/FunLevelSelectScreen';
import { GamePlayfield } from '@/features/games/games/radix-invaders/components/GamePlayfield';

vi.mock('@/features/games/hooks/useXrdPrice', () => ({
  useXrdPrice: () => ({ price: { usd: 0.025, eur: 0.023 }, error: false }),
}));

const t = esGames.games.space_invaders as Record<string, string>;
const noop = () => {};

function getCssRuleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
}

describe('Radix Invaders — UI alignment, pause menu & canvas focus guardrails', () => {
  it('enforces vertical centering and cap-height text trimming in radix-invaders.css for buttons and boxes', () => {
    const cssPath = resolve(
      process.cwd(),
      'features/games/games/radix-invaders/styles/radix-invaders.css',
    );
    const css = readFileSync(cssPath, 'utf8');

    const centeredLabelRule = getCssRuleBody(css, '.ri-centered-label');
    expect(centeredLabelRule).toContain('display: block');
    expect(centeredLabelRule).not.toMatch(/display:\s*(inline-)?flex/);
    expect(centeredLabelRule).toContain('line-height: 1');
    expect(centeredLabelRule).toContain('text-box: trim-both cap alphabetic');
    expect(css).toContain('@supports not (text-box: trim-both cap alphabetic)');

    for (const selector of ['.ri-game-btn', '.ri-tournament-badge', '.ri-pause-menu-btn']) {
      const rule = getCssRuleBody(css, selector);
      expect(rule, `${selector} must exist in radix-invaders.css`).not.toBe('');
      expect(rule, `${selector} must use flex/inline-flex`).toMatch(/display:\s*(inline-)?flex/);
      expect(rule, `${selector} must vertically center items`).toContain('align-items: center');
      expect(rule, `${selector} must horizontally center items`).toContain('justify-content: center');
      expect(rule, `${selector} must set line-height: 1`).toContain('line-height: 1');
    }
  });

  it('wraps text of ENTRAR AL TORNEO, JUGAR POR DIVERSIÓN, and TORNEO ACTIVO in .ri-centered-label', () => {
    render(
      <IntroScreen t={t} lang="es" onTournament={noop} onFun={noop} />,
    );

    const badgeText = screen.getByText('TORNEO ACTIVO');
    expect(badgeText).toHaveClass('ri-centered-label');
    expect(badgeText.parentElement).toHaveClass('ri-tournament-badge');

    const tournamentBtn = screen.getByRole('button', { name: /ENTRAR AL TORNEO/i });
    expect(tournamentBtn).toHaveClass('ri-game-btn');
    expect(tournamentBtn.querySelector('.ri-centered-label')?.textContent).toBe('ENTRAR AL TORNEO');

    const funBtn = screen.getByRole('button', { name: /JUGAR POR DIVERSIÓN/i });
    expect(funBtn).toHaveClass('ri-game-btn');
    expect(funBtn.querySelector('.ri-centered-label')?.textContent).toBe('JUGAR POR DIVERSIÓN');
  });

  it('wraps text labels in .ri-centered-label across BadgeScreen and FunLevelSelectScreen buttons', () => {
    const { unmount } = render(<BadgeScreen t={t} step="success" onPlay={noop} />);
    const playBtn = screen.getByRole('button', { name: /EMPEZAR A JUGAR/i });
    expect(playBtn.querySelector('.ri-centered-label')?.textContent).toBe('EMPEZAR A JUGAR');
    unmount();

    render(
      <FunLevelSelectScreen
        t={t}
        level={1}
        bossRush={false}
        onChangeLevel={noop}
        onSetBossRush={noop}
        onStart={noop}
        onBack={noop}
      />,
    );

    for (const label of [/CAMPAÑA/i, /SOLO JEFES/i, /EMPEZAR NIVEL/i, /VOLVER/i]) {
      const btn = screen.getByRole('button', { name: label });
      expect(btn.querySelector('.ri-centered-label')).not.toBeNull();
    }
  });

  it('renders a VOLVER AL INICIO button only while paused and prevents canvas focus outlines', () => {
    const onReturnToMenu = vi.fn();
    const onCanvasClick = vi.fn();
    const canvasRef = createRef<HTMLCanvasElement>();
    const playfieldWrapRef = createRef<HTMLDivElement>();

    const baseProps = {
      isMobilePortrait: false,
      theaterMode: false,
      soundMuted: false,
      t,
      canvasRef,
      playfieldWrapRef,
      onTouchStart: noop,
      onTouchMove: noop,
      onTouchEnd: noop,
      onMouseMove: noop,
      onMouseLeave: noop,
      onMouseDown: noop,
      onMouseUp: noop,
      onCanvasClick,
      onToggleSound: noop,
      onTogglePause: noop,
      onReturnToMenu,
      onExitTheater: noop,
    };

    const { rerender, container } = render(<GamePlayfield {...baseProps} isPaused={false} />);
    expect(screen.queryByRole('button', { name: /VOLVER AL INICIO/i })).toBeNull();

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveClass('outline-none', 'focus:outline-none', 'focus-visible:outline-none');

    rerender(<GamePlayfield {...baseProps} isPaused />);
    const backBtn = screen.getByRole('button', { name: /VOLVER AL INICIO/i });
    expect(backBtn).toHaveClass('ri-pause-menu-btn');
    expect(backBtn.querySelector('.ri-centered-label')?.textContent).toBe('VOLVER AL INICIO');

    fireEvent.click(backBtn);
    expect(onReturnToMenu).toHaveBeenCalledTimes(1);
    expect(onCanvasClick).not.toHaveBeenCalled();
  });
});

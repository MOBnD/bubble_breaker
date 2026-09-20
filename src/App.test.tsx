import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { AdventureProvider } from './state/AdventureContext';

function renderApp() {
  return render(<AdventureProvider><App /></AdventureProvider>);
}

describe('BubbleBreaker Adventure Core', () => {
  it('offers only game as an actionable departure and keeps later labels hidden', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'どこから旅を始めますか？' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ゲーム/ })).toBeInTheDocument();
    expect(screen.queryByText('ウェイファインディング')).not.toBeInTheDocument();
    expect(screen.queryByText('都市／建築')).not.toBeInTheDocument();
  });

  it('completes the vertical slice and records discoveries in the journal', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /ゲーム/ }));
    await user.click(screen.getByRole('button', { name: /近づいてみる/ }));
    expect(screen.getByRole('heading', { name: /次の場所へ行きたくなる/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^調べる/ }));
    expect(screen.getByText('ウェイファインディング')).toBeInTheDocument();
    expect(screen.getByText(/現実世界から得られたナビゲーション/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /世界を見る/ }));
    expect(screen.getByTestId('adventure-scene')).toHaveAttribute('data-first-expanded', 'true');
    await user.click(screen.getByRole('button', { name: /光を追う/ }));
    await user.click(screen.getByRole('button', { name: /^調べる/ }));
    expect(screen.getByText('都市／建築')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /世界を見る/ }));
    expect(screen.getByRole('button', { name: /追う/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /寄り道/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /深く潜る/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /寄り道/ }));
    expect(screen.getByRole('heading', { name: /安全な出口/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /冒険記を見る/ }));
    expect(screen.getByRole('dialog', { name: 'あなたの冒険記' })).toBeInTheDocument();
    expect(screen.getAllByText(/ゲームの道は、現実の道とつながっていた/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/空間は、気づかないうちに選択へ働きかける/).length).toBeGreaterThan(0);
  });
});

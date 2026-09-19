import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { JourneyProvider } from './state/JourneyContext';

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <JourneyProvider><App /></JourneyProvider>
    </MemoryRouter>,
  );
}

describe('BubbleBreaker v2 app', () => {
  it('shows the three departure choices', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: /今日は/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /興味から出発/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /偶然に任せる/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /未知へ飛ぶ/ })).toBeInTheDocument();
  });

  it('starts the guided demo at game and opens the world map', async () => {
    const user = userEvent.setup();
    renderApp('/demo');
    await user.click(screen.getByRole('button', { name: /興味から出発/ }));
    await user.click(screen.getByRole('button', { name: /この場所から出発/ }));
    expect(await screen.findByRole('heading', { name: /ゲームから、どこへ行く/ })).toBeInTheDocument();
    expect(screen.getByTestId('demo-guide')).toHaveTextContent('最初の予想外');
  });
});

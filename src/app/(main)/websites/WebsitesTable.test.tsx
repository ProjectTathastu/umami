import { act } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@/test/render';
import { WebsitesTable } from './WebsitesTable';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock('@umami/react-zen', async importOriginal => ({
  ...(await importOriginal<typeof import('@umami/react-zen')>()),
  useToast: () => ({ toast }),
}));

vi.mock('@/components/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/components/hooks')>()),
  useWebsiteListChartsQuery: () => ({ data: { data: {} }, isLoading: false }),
}));

const websites = [
  { id: 'first', name: 'First website', domain: 'first.example', createdAt: '2026-01-01' },
  {
    id: 'second',
    name: 'Second website',
    domain: 'xn--bcher-kva.example',
    createdAt: '2026-01-02',
  },
];

function renderTable(showActions = true) {
  return render(
    <WebsitesTable
      data={websites}
      showActions={showActions}
      renderLink={row => <a href={`/websites/${row.id}`}>{row.name}</a>}
    />,
    { route: '/websites' },
  );
}

beforeEach(() => {
  toast.mockReset();
});

describe('WebsitesTable copy domain', () => {
  test('copies each row’s displayed domain using Tab, Enter and Space, preserving website links', async () => {
    const { user } = renderTable();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const first = screen.getByRole('button', { name: 'Copy domain: first.example' });
    const second = screen.getByRole('button', { name: 'Copy domain: bücher.example' });

    expect(screen.getByText('bücher.example')).toBeVisible();
    expect(screen.queryByText('xn--bcher-kva.example')).not.toBeInTheDocument();

    for (let i = 0; i < 12 && document.activeElement !== first; i++) {
      await user.tab();
    }
    expect(first).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(writeText).toHaveBeenNthCalledWith(1, 'first.example'));
    expect(toast).toHaveBeenCalledWith('Copied domain: first.example', { variant: 'success' });

    for (let i = 0; i < 12 && document.activeElement !== second; i++) {
      await user.tab();
    }
    expect(second).toHaveFocus();
    await user.keyboard(' ');
    await waitFor(() => expect(writeText).toHaveBeenNthCalledWith(2, 'bücher.example'));
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenLastCalledWith('Copied domain: bücher.example', { variant: 'success' });

    for (const website of websites) {
      const link = screen.getByRole('link', { name: website.name });
      expect(link).toHaveAttribute('href', `/websites/${website.id}`);
      const row = link.closest('tr');
      if (!row) throw new Error('Website link must belong to a table row');
      expect(
        within(row)
          .getAllByRole('link')
          .some(link => link.getAttribute('href')?.startsWith(`/websites/${website.id}/settings`)),
      ).toBe(true);
    }
  });

  test('shows success only after the clipboard promise resolves', async () => {
    const { user } = renderTable();
    let resolveCopy: () => void = () => {};
    const pendingCopy = new Promise<void>(resolve => {
      resolveCopy = resolve;
    });
    vi.spyOn(navigator.clipboard, 'writeText').mockReturnValue(pendingCopy);

    await user.click(screen.getByRole('button', { name: 'Copy domain: first.example' }));
    expect(toast).not.toHaveBeenCalled();

    await act(async () => resolveCopy());
    expect(toast).toHaveBeenCalledExactlyOnceWith('Copied domain: first.example', {
      variant: 'success',
    });
  });

  test('reports rejection truthfully and allows a successful retry', async () => {
    const { user } = renderTable();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined);
    const button = screen.getByRole('button', { name: 'Copy domain: bücher.example' });

    await user.click(button);
    expect(toast).toHaveBeenCalledExactlyOnceWith(
      'Could not copy domain: bücher.example. Clipboard access may be unavailable or denied.',
      { variant: 'error' },
    );

    await user.click(button);
    expect(writeText).toHaveBeenNthCalledWith(2, 'bücher.example');
    expect(toast).toHaveBeenLastCalledWith('Copied domain: bücher.example', { variant: 'success' });
  });

  test.each([undefined, {}])('reports an unavailable clipboard (%s)', async clipboard => {
    const { user } = renderTable();
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    if (!descriptor) throw new Error('Expected the test clipboard fixture');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });

    try {
      await user.click(screen.getByRole('button', { name: 'Copy domain: first.example' }));
      expect(toast).toHaveBeenCalledExactlyOnceWith(
        'Could not copy domain: first.example. Clipboard access may be unavailable or denied.',
        { variant: 'error' },
      );
    } finally {
      Object.defineProperty(navigator, 'clipboard', descriptor);
    }
  });

  test('keeps copy available without granting website editing actions', () => {
    renderTable(false);
    expect(screen.getAllByRole('button', { name: /^Copy domain:/ })).toHaveLength(2);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});

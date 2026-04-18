// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanTerminal } from './ScanTerminal';

describe('ScanTerminal', () => {
  it('renders custom title and description', () => {
    render(
      <ScanTerminal
        title="Closed job check"
        description="Test description"
        logs={[]}
        isComplete={false}
        emptyMessage="Loading…"
      />
    );

    expect(screen.getByText('Closed job check')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders log lines with bold segments', () => {
    render(
      <ScanTerminal
        logs={['**[1/1]** Job', '  Result: **closed** (inactive)']}
        isComplete
      />
    );

    expect(screen.getByText(/Job/)).toBeInTheDocument();
    expect(screen.getByText(/closed/)).toBeInTheDocument();
  });

  it('shows spinner when not complete', () => {
    const { container } = render(
      <ScanTerminal logs={['x']} isComplete={false} />
    );

    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});

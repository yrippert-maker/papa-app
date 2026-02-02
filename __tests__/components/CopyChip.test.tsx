/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { CopyChip } from '@/app/governance/anchoring/_components/CopyChip';

describe('CopyChip', () => {
  const defaultProps = {
    copyKey: 'tx:1',
    text: '0x123abc',
    labelDefault: 'Copy',
    copyState: null,
    lockedKey: null,
    onCopy: jest.fn(),
  };

  it('shows default label when no status', () => {
    render(<CopyChip {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('shows ✓ when status is ok', () => {
    render(
      <CopyChip
        {...defaultProps}
        copyState={{ key: 'tx:1', status: 'ok' }}
      />
    );
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows ⚠︎ when status is error', () => {
    render(
      <CopyChip
        {...defaultProps}
        copyState={{ key: 'tx:1', status: 'error' }}
      />
    );
    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
    expect(screen.getByText('⚠︎')).toBeInTheDocument();
  });

  it('is disabled when lockedKey matches copyKey', () => {
    render(
      <CopyChip
        {...defaultProps}
        lockedKey="tx:1"
      />
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is not disabled when lockedKey does not match', () => {
    render(
      <CopyChip
        {...defaultProps}
        lockedKey="tx:2"
      />
    );
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('calls onCopy with copyKey and text on click', () => {
    const onCopy = jest.fn();
    render(<CopyChip {...defaultProps} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onCopy).toHaveBeenCalledWith('tx:1', '0x123abc');
  });

  it('uses labelDefault for Copy link variant', () => {
    render(
      <CopyChip
        {...defaultProps}
        labelDefault="Copy link"
      />
    );
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });
});

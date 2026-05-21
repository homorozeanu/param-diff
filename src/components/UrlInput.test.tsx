import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UrlInput } from './UrlInput';

function ControlledHarness({ onChange }: { readonly onChange: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <UrlInput
      index={0}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('UrlInput', () => {
  it('renders with the supplied value and a numbered label', () => {
    render(<UrlInput index={0} value="https://x.com/?a=1" onChange={() => {}} />);
    expect(screen.getByLabelText('URL 1')).toHaveValue('https://x.com/?a=1');
  });

  it('numbers labels from index + 1', () => {
    render(<UrlInput index={2} value="" onChange={() => {}} />);
    expect(screen.getByLabelText('URL 3')).toBeInTheDocument();
  });

  it('calls onChange with the accumulated value as the user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledHarness onChange={onChange} />);
    await user.type(screen.getByLabelText('URL 1'), 'ab');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 'a');
    expect(onChange).toHaveBeenNthCalledWith(2, 'ab');
  });

  it('hides the Remove button when no onRemove prop is provided', () => {
    render(<UrlInput index={0} value="" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('renders the Remove button and invokes onRemove when clicked', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<UrlInput index={0} value="" onChange={() => {}} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

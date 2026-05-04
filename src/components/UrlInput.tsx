import type { ChangeEvent } from 'react';

type Props = {
  index: number;
  value: string;
  onChange: (next: string) => void;
  onRemove?: () => void;
};

export function UrlInput({ index, value, onChange, onRemove }: Props) {
  return (
    <div className="url-input">
      <div className="url-input-header">
        <label htmlFor={`url-${index}`} className="url-label">
          URL {index + 1}
        </label>
        {onRemove && (
          <button type="button" className="btn btn-ghost" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <textarea
        id={`url-${index}`}
        className="url-textarea"
        placeholder="Paste a URL here..."
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        rows={3}
        spellCheck={false}
      />
    </div>
  );
}

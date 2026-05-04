import type { ParsedUrl } from '../types';
import { ParamRow } from './ParamRow';

type Props = {
  parsed: ParsedUrl;
  index: number;
  onDecode: (id: string) => void;
  onExpand: (id: string) => void;
  onReset: (id: string) => void;
};

export function ParamList({ parsed, index, onDecode, onExpand, onReset }: Props) {
  if (!parsed.base && parsed.params.length === 0) {
    return (
      <div className="param-list-empty">
        <span className="muted">URL {index + 1} — paste a URL above to see its query params.</span>
      </div>
    );
  }
  return (
    <div className="param-list">
      <div className="param-list-base">
        <span className="muted">Base:</span> <code>{parsed.base || '(none)'}</code>
      </div>
      {parsed.params.length === 0 ? (
        <div className="param-list-empty">
          <span className="muted">No query parameters.</span>
        </div>
      ) : (
        <div className="param-rows">
          <div className="param-row param-row-header">
            <div className="param-key">Key</div>
            <div className="param-value">Value</div>
            <div className="param-actions">Actions</div>
          </div>
          {parsed.params.map((p) => (
            <ParamRow
              key={p.id}
              param={p}
              depth={0}
              onDecode={onDecode}
              onExpand={onExpand}
              onReset={onReset}
            />
          ))}
        </div>
      )}
    </div>
  );
}

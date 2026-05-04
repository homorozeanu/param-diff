import type { Param } from '../types';
import { canDecodeFurther, looksExpandable } from '../parse';

type Props = {
  param: Param;
  depth: number;
  onDecode: (id: string) => void;
  onExpand: (id: string) => void;
  onReset: (id: string) => void;
};

export function ParamRow({ param, depth, onDecode, onExpand, onReset }: Props) {
  const canDecode = !param.expanded && canDecodeFurther(param.value);
  const canExpand = !param.expanded && looksExpandable(param.value);
  const isModified = param.decodeCount > 0 || param.expanded;

  return (
    <>
      <div className="param-row" style={{ paddingLeft: `${depth * 1.5}rem` }}>
        <div className="param-key">{param.key}</div>
        <div className="param-value">
          {param.expanded ? (
            <span className="param-value-base">
              {param.nestedBase || <em className="muted">(no base)</em>}
              {param.nestedBase && <span className="muted">?</span>}
            </span>
          ) : (
            <code>{param.value || <em className="muted">(empty)</em>}</code>
          )}
          {param.decodeCount > 0 && (
            <span className="badge" title={`Decoded ${param.decodeCount}x`}>
              decoded ×{param.decodeCount}
            </span>
          )}
        </div>
        <div className="param-actions">
          <button
            type="button"
            className="btn"
            disabled={!canDecode}
            onClick={() => onDecode(param.id)}
            title="URL-decode this value once"
          >
            Decode
          </button>
          <button
            type="button"
            className="btn"
            disabled={!canExpand}
            onClick={() => onExpand(param.id)}
            title="Split this value into nested query params"
          >
            Expand
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!isModified}
            onClick={() => onReset(param.id)}
            title="Restore the original raw value"
          >
            Reset
          </button>
        </div>
      </div>
      {param.expanded &&
        param.nestedParams?.map((np) => (
          <ParamRow
            key={np.id}
            param={np}
            depth={depth + 1}
            onDecode={onDecode}
            onExpand={onExpand}
            onReset={onReset}
          />
        ))}
    </>
  );
}

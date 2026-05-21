import type { ParsedUrl } from '../types';
import { flatten } from '../parse';

type Props = {
  readonly parsedUrls: readonly ParsedUrl[];
};

const MISSING = Symbol('missing');
type Cell = string | typeof MISSING;

function cellClassName(c: Cell, allSame: boolean): string {
  if (c === MISSING) return 'diff-cell diff-cell-missing';
  if (allSame) return 'diff-cell diff-cell-same';
  return 'diff-cell diff-cell-diff';
}

export function DiffView({ parsedUrls }: Props) {
  const active = parsedUrls
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.base || p.params.length > 0);

  if (active.length < 2) {
    return (
      <div className="diff-empty muted">
        Add a second URL to enable diff. (Currently {active.length} URL{active.length === 1 ? '' : 's'} parsed.)
      </div>
    );
  }

  // Build per-URL flat maps.
  const maps = active.map(({ p }) => {
    const m = new Map<string, string>();
    for (const e of flatten(p.params)) m.set(e.keyPath, e.value);
    return m;
  });

  // Union of all keys, preserved in insertion order across URLs.
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const m of maps) {
    for (const k of m.keys()) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }

  if (keys.length === 0) {
    return <div className="diff-empty muted">No query params parsed yet.</div>;
  }

  const slotIds = active.map(({ i }) => i);
  const rows = keys.map((k) => {
    const cells: Cell[] = maps.map((m) => m.get(k) ?? MISSING);
    const presentValues = cells.filter((c): c is string => c !== MISSING);
    const allSame =
      presentValues.length === cells.length &&
      presentValues.every((v) => v === presentValues[0]);
    return { key: k, cells, allSame };
  });

  return (
    <div className="diff-view">
      <table className="diff-table">
        <thead>
          <tr>
            <th>Param</th>
            {active.map(({ i }) => (
              <th key={i}>URL {i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, cells, allSame }) => (
            <tr key={key} className={allSame ? 'diff-row-same' : 'diff-row-diff'}>
              <td className="diff-key">{key}</td>
              {cells.map((c, idx) => (
                <td key={slotIds[idx]} className={cellClassName(c, allSame)}>
                  {c === MISSING ? <em className="muted">missing</em> : <code>{c}</code>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="diff-legend muted">
        <span className="legend-item">
          <span className="legend-swatch swatch-same" />
          <span>identical across all URLs</span>
        </span>
        <span className="legend-item">
          <span className="legend-swatch swatch-diff" />
          <span>differs</span>
        </span>
        <span className="legend-item">
          <span className="legend-swatch swatch-missing" />
          <span>missing in this URL</span>
        </span>
      </div>
    </div>
  );
}

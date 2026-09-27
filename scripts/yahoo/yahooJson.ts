/**
 * Helpers for Yahoo Fantasy's XML→JSON encoding.
 *
 * A single logical record is often an array of tiny property bags, sometimes
 * nested one level, and often interspersed with empty arrays:
 *
 *   [
 *     [ { team_key: "..." }, { team_id: "1" }, { name: "..." }, [] ],
 *     { team_points: [ { coverage_type: "week" }, { total: "142.18" } ] },
 *     { win_probability: 0.62 }
 *   ]
 *
 * Treating that as a list of independent objects drops scores, standings,
 * selected positions, and transaction_data onto the floor.
 */

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function isNoise(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (isPlainObject(v) && Object.keys(v).length === 0) return true;
  return false;
}

function objectKeys(v: unknown): string[] {
  return isPlainObject(v) ? Object.keys(v) : [];
}

/**
 * Property-bag lists are arrays of mostly single-key objects whose keys are
 * unique (team_key, team_id, name, team_points, …). Entity lists repeat the
 * same wrapper key (matchup, team, player).
 */
export function looksLikePropertyBags(arr: unknown[]): boolean {
  const objects = arr.filter(isPlainObject);
  if (objects.length === 0) return false;
  const keys = objects.flatMap(objectKeys);
  const unique = new Set(keys);
  const mostlySingleKey = objects.filter((o) => Object.keys(o).length <= 3).length / objects.length >= 0.5;
  return mostlySingleKey && unique.size >= Math.max(2, objects.length * 0.45);
}

function flattenOneLevel(arr: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      const inner = item.filter((x) => !isNoise(x));
      if (inner.length === 0) continue;
      if (looksLikePropertyBags(inner) || inner.every((x) => isPlainObject(x) || Array.isArray(x))) {
        out.push(...inner);
      } else {
        out.push(item);
      }
    } else if (!isNoise(item)) {
      out.push(item);
    }
  }
  return out;
}

/** Deep-merge Yahoo property-bag arrays into a single record. */
export function mergeYahooRecord(node: unknown): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  const visit = (item: unknown): void => {
    if (isNoise(item)) return;
    if (Array.isArray(item)) {
      const flat = flattenOneLevel(item);
      if (looksLikePropertyBags(flat) || flat.every((x) => isPlainObject(x) || Array.isArray(x))) {
        for (const child of flat) visit(child);
        return;
      }
      for (const child of item) visit(child);
      return;
    }
    if (!isPlainObject(item)) return;
    for (const [k, v] of Object.entries(item)) {
      if (isNoise(v)) continue;
      if (Array.isArray(v)) {
        const inner = v.filter((x) => !isNoise(x));
        if (inner.length > 0 && looksLikePropertyBags(inner)) {
          const nested = mergeYahooRecord(inner);
          const existing = merged[k];
          merged[k] = isPlainObject(existing) ? { ...existing, ...nested } : nested;
          continue;
        }
        if (!(k in merged)) merged[k] = v;
        continue;
      }
      if (isPlainObject(v) && isPlainObject(merged[k])) {
        merged[k] = { ...(merged[k] as Record<string, unknown>), ...v };
      } else if (!(k in merged) || merged[k] == null) {
        merged[k] = v;
      }
    }
  };

  visit(node);
  return merged;
}

export function recordsWithKey(node: unknown, key: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  if (!node || typeof node !== "object") return result;

  if (Array.isArray(node)) {
    const flat = flattenOneLevel(node);
    if (looksLikePropertyBags(flat)) {
      const merged = mergeYahooRecord(flat);
      if (key in merged) result.push(merged);
      for (const value of Object.values(merged)) {
        result.push(...recordsWithKey(value, key));
      }
      return result;
    }
    for (const item of node) result.push(...recordsWithKey(item, key));
    return result;
  }

  const obj = node as Record<string, unknown>;
  if (key in obj) result.push(obj);
  for (const value of Object.values(obj)) result.push(...recordsWithKey(value, key));
  return result;
}

export function findObjects(node: unknown, key: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  if (!node || typeof node !== "object") return result;

  if (Array.isArray(node)) {
    const flat = flattenOneLevel(node);
    if (looksLikePropertyBags(flat)) {
      const merged = mergeYahooRecord(flat);
      if (key in merged) result.push(...materialize(merged[key]));
      for (const value of Object.values(merged)) result.push(...findObjects(value, key));
      return result;
    }
    for (const item of node) result.push(...findObjects(item, key));
    return result;
  }

  const obj = node as Record<string, unknown>;
  if (key in obj) result.push(...materialize(obj[key]));
  for (const value of Object.values(obj)) result.push(...findObjects(value, key));
  return result;
}

function materialize(value: unknown): Record<string, unknown>[] {
  if (isNoise(value)) return [];
  if (Array.isArray(value)) {
    const inner = value.filter((x) => !isNoise(x));
    if (looksLikePropertyBags(inner)) return [mergeYahooRecord(inner)];
    return inner.filter(isPlainObject);
  }
  if (isPlainObject(value)) return [value];
  return [];
}

function firstScalar(node: unknown, key: string): string | number | boolean | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    const flat = flattenOneLevel(node);
    if (looksLikePropertyBags(flat)) return firstScalar(mergeYahooRecord(flat), key);
    for (const item of node) {
      const found = firstScalar(item, key);
      if (found !== null) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (key in obj) {
    const v = obj[key];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  }
  for (const v of Object.values(obj)) {
    const found = firstScalar(v, key);
    if (found !== null) return found;
  }
  return null;
}

export function value(node: unknown, key: string): string | number | boolean | null {
  return firstScalar(node, key);
}

/** Prefer the numeric Yahoo team id (`1`) over a full `470.l.344338.t.1` key. */
export function normalizeTeamId(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue;
    const s = String(candidate);
    const keyed = s.match(/\.t\.(\d+)\s*$/);
    if (keyed) return keyed[1];
  }
  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue;
    const s = String(candidate).trim();
    if (/^\d+$/.test(s)) return s;
  }
  const first = candidates.find((c) => c != null && String(c) !== "");
  return first == null ? "" : String(first);
}

export function nestedTotal(node: unknown): number | undefined {
  if (node == null || node === "") return undefined;
  if (typeof node === "number" || typeof node === "string") {
    const n = Number(node);
    return Number.isFinite(n) ? n : undefined;
  }
  const merged = Array.isArray(node) || isPlainObject(node) ? mergeYahooRecord(node) : {};
  if ("total" in merged) {
    const n = Number(merged.total);
    if (Number.isFinite(n)) return n;
  }
  const scalar = firstScalar(node, "total");
  if (scalar != null) {
    const n = Number(scalar);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function pointsFrom(record: Record<string, unknown>, key: string): number {
  const direct = nestedTotal(record[key]);
  if (direct !== undefined) return direct;
  for (const found of findObjects(record, key)) {
    const n = nestedTotal(found);
    if (n !== undefined) return n;
  }
  return 0;
}

/**
 * True if `key` (e.g. "player_points") resolves to an actual total anywhere
 * under `node`, as opposed to being structurally absent.
 *
 * Yahoo's API can return HTTP 200 for a roster request where the `stats`
 * sub-resource silently didn't attach (a known quirk when `stats` is chained
 * three levels deep across a `teams` collection, e.g.
 * `/league/{league_key}/teams/roster/players/stats`). That response still has
 * every player, so callers relying on network errors alone to detect a bad
 * fetch won't catch it — the points are just missing. This lets a caller
 * distinguish "the field is present with a real (possibly zero) total" from
 * "the field never came through," so it can fall back to a more reliable
 * per-team request instead of silently caching zeroed-out points.
 */
export function hasResolvableTotal(record: Record<string, unknown>, key: string): boolean {
  if (nestedTotal(record[key]) !== undefined) return true;
  return findObjects(record, key).some((found) => nestedTotal(found) !== undefined);
}

export function richerRecord(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown>,
): Record<string, unknown> {
  if (!a) return b;
  return Object.keys(b).length >= Object.keys(a).length ? b : a;
}

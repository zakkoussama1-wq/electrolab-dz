import type { Circuit, Part } from './solver';
/** A terminal's identity never changes with its screen position or rotation. */
export const terminalId = (id: string, n: number) => `${id}:${n}`;
export function terminalPosition(p: Part, n: number) {
  const angle = p.rotation * Math.PI / 180, d = n === 0 ? -58 : 58;
  return { x: p.x + Math.cos(angle) * d, y: p.y + Math.sin(angle) * d };
}
export function connectivity(c: Circuit) {
  const parent = new Map<string, string>();
  const ids = new Set<string>();
  for (const p of c.parts) {
    if (!p.id || ids.has(p.id)) throw new Error('معرّف عنصر مكرر أو فارغ؛ أعد تسمية العنصر أو استرجع ملفًا صحيحًا.');
    ids.add(p.id);
    for (const n of [0, 1]) parent.set(terminalId(p.id, n), terminalId(p.id, n));
  }
  const root = (t: string): string => {
    if (!parent.has(t)) throw new Error('سلك متصل بطرف غير موجود. احذف السلك وأعد توصيله.');
    const p = parent.get(t)!;
    if (p !== t) parent.set(t, root(p));
    return parent.get(t)!;
  };
  const join = (a: string, b: string) => {
    const x = root(a), y = root(b);
    // Canonical roots, independent of wire order and direction.
    parent.set(x < y ? y : x, x < y ? x : y);
  };
  const wireIds = new Set<string>();
  for (const w of c.wires) {
    if (wireIds.has(w.id)) throw new Error('معرّف سلك مكرر؛ احذف السلك المكرر وأعد التوصيل.');
    wireIds.add(w.id);
    join(w.a, w.b);
  }
  const groups = new Map<string, string[]>();
  for (const t of parent.keys()) groups.set(root(t), [...(groups.get(root(t)) ?? []), t]);
  const nodes = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, terminals], i) => ({id: `N${i + 1}`, terminals: terminals.sort(), name: terminals.map(t => c.nodeNames?.[t]).find(Boolean)}));
  const nodeOf = Object.fromEntries(nodes.flatMap(n => n.terminals.map(t => [t, n.id])));
  return { nodes, nodeOf };
}

/** The hit target and visible wire share this exact endpoint-derived path. */
export function wirePath(p: Part, n: number, q: Part, m: number) {
  const a = terminalPosition(p,n), b = terminalPosition(q,m);
  if (Math.abs(a.x-b.x)<1e-6 || Math.abs(a.y-b.y)<1e-6) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const vertical = (v: Part) => Math.abs(Math.sin(v.rotation*Math.PI/180)) > .99;
  if (vertical(p) && vertical(q)) {
    const up = (v: Part, pin: number) => Math.sin(v.rotation*Math.PI/180)*(pin===0?-1:1)<0;
    if (up(p,n) === up(q,m)) {
      const rail = up(p,n) ? Math.min(a.y,b.y) : Math.max(a.y,b.y);
      return `M ${a.x} ${a.y} V ${rail} H ${b.x} V ${b.y}`;
    }
  }
  return `M ${a.x} ${a.y} H ${(a.x+b.x)/2} V ${b.y} H ${b.x}`;
}

import {
  solve,
  terminal,
  type Circuit,
  type Part,
  type Result,
} from "./solver";
export const fmt = (v: number) =>
  Number.isFinite(v) ? Number(v.toPrecision(6)).toString() : "غير معرّف";
export const ref = (v: 1 | -1 | undefined) => (v === -1 ? -1 : 1);
export function reading(p: Part, r: Result) {
  const v = r.values[p.id];
  return v
    ? {
        voltage: v.voltage * ref(p.voltageRef),
        current: v.current * ref(p.currentRef),
        power: v.power,
      }
    : undefined;
}
export const resistance = (p: Part) => (p.kind === "ammeter" ? 0.001 : p.value);
export type Branch = { id: string; a: string; b: string; active: boolean };
export type Loop = { id: string; steps: { id: string; sign: number }[] };
export type Topology = {
  nodes: { id: string; terminals: string[] }[];
  branches: Branch[];
  loops: Loop[];
  nodeOf: Record<string, string>;
  open: string[];
  shorted: string[];
  error?: string;
};
export function topology(c: Circuit): Topology {
  const nodeOf: Record<string, string> = {};
  const parent = new Map<string, string>();
  for (const p of c.parts)
    for (const n of [0, 1]) parent.set(terminal(p.id, n), terminal(p.id, n));
  const root = (a: string): string =>
    parent.get(a) === a ? a : root(parent.get(a)!);
  for (const w of c.wires) {
    if (!parent.has(w.a) || !parent.has(w.b))
      return {
        nodes: [],
        branches: [],
        loops: [],
        nodeOf,
        open: [],
        shorted: [],
        error: "طرف سلك غير موجود",
      };
    parent.set(root(w.a), root(w.b));
  }
  const groups = new Map<string, string[]>();
  for (const t of parent.keys()) {
    const r = root(t);
    groups.set(r, [...(groups.get(r) || []), t]);
  }
  const nodes = [...groups.values()].map((terminals, i) => ({
    id: `N${i + 1}`,
    terminals,
  }));
  nodes.forEach((n) => n.terminals.forEach((t) => (nodeOf[t] = n.id)));
  const branches = c.parts.map((p) => ({
    id: p.id,
    a: nodeOf[terminal(p.id, 0)],
    b: nodeOf[terminal(p.id, 1)],
    active: p.kind !== "voltmeter" && !(p.kind === "switch" && !p.closed),
  }));
  // A spanning forest plus one non-tree edge gives each independent cycle.
  const tree = new Map(
    nodes.map((n) => [n.id, [] as { to: string; id: string; sign: number }[]]),
  );
  const loops: Loop[] = [];
  function path(
    a: string,
    b: string,
    seen = new Set<string>(),
  ): Loop["steps"] | undefined {
    if (a === b) return [];
    seen.add(a);
    for (const e of tree.get(a)!) {
      if (seen.has(e.to)) continue;
      const tail = path(e.to, b, seen);
      if (tail) return [{ id: e.id, sign: e.sign }, ...tail];
    }
    return undefined;
  }
  for (const e of branches.filter((e) => e.active)) {
    const back = path(e.b, e.a);
    if (back)
      loops.push({
        id: `L${loops.length + 1}`,
        steps: [{ id: e.id, sign: 1 }, ...back],
      });
    else {
      tree.get(e.a)!.push({ to: e.b, id: e.id, sign: 1 });
      tree.get(e.b)!.push({ to: e.a, id: e.id, sign: -1 });
    }
  }
  const cyclic = new Set(loops.flatMap((l) => l.steps.map((s) => s.id)));
  return {
    nodes,
    branches,
    loops,
    nodeOf,
    open: branches
      .filter((b) => !b.active || !cyclic.has(b.id))
      .map((b) => b.id),
    shorted: branches.filter((b) => b.a === b.b).map((b) => b.id),
  };
}
export type ResistanceExpression =
  | { kind: "element"; id: string }
  | {
      kind: "series" | "parallel";
      left: ResistanceExpression;
      right: ResistanceExpression;
    };
export type Reduction = {
  tree: ResistanceExpression;
  operands: [number, number];
  kind: "series" | "parallel";
  expression: string;
  numeric: string;
  value: number;
  members: string[];
};
export function equivalent(c: Circuit): {
  value?: number;
  steps: Reduction[];
  reason?: string;
} {
  const batteries = c.parts.filter((p) => p.kind === "battery");
  const steps: Reduction[] = [];
  if (batteries.length !== 1)
    return {
      steps,
      reason:
        "المقاومة المكافئة هنا تُحسب عند طرفي بطارية واحدة فقط. تحليل مصادر متعددة مدعوم بـ MNA، لكن تعطيل المصادر العام ليس ضمن هذه المرحلة.",
    };
  const t = topology(c);
  if (t.error) return { steps, reason: t.error };
  const source = batteries[0];
  // Merge zero-ohm closed switches only for resistor network reduction.
  const parent = new Map(t.nodes.map((n) => [n.id, n.id]));
  const root = (n: string): string =>
    parent.get(n) === n ? n : root(parent.get(n)!);
  t.branches
    .filter(
      (b) => c.parts.find((p) => p.id === b.id)?.kind === "switch" && b.active,
    )
    .forEach((b) => parent.set(root(b.a), root(b.b)));
  const a = root(t.nodeOf[terminal(source.id, 0)]),
    b = root(t.nodeOf[terminal(source.id, 1)]);
  type E = {
    a: string;
    b: string;
    r: number;
    expression: string;
    members: string[];
    tree: ResistanceExpression;
  };
  let edges: E[] = c.parts
    .filter((p) => ["resistor", "lamp", "ammeter"].includes(p.kind))
    .map((p) => ({
      a: root(t.nodeOf[terminal(p.id, 0)]),
      b: root(t.nodeOf[terminal(p.id, 1)]),
      r: resistance(p),
      expression: p.id,
      tree: { kind: "element" as const, id: p.id },
      members: [p.id],
    }))
    .filter((e) => e.a !== e.b);
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < edges.length; i++)
      for (let j = i + 1; j < edges.length; j++) {
        const x = edges[i],
          y = edges[j];
        if ((x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a)) {
          const r = 1 / (1 / x.r + 1 / y.r),
            expression = `(1/(${x.expression}) + 1/(${y.expression}))⁻¹`;
          const members = [...x.members, ...y.members];
          const tree: ResistanceExpression = {
            kind: "parallel",
            left: x.tree,
            right: y.tree,
          };
          steps.push({
            kind: "parallel",
            tree,
            operands: [x.r, y.r],
            expression,
            numeric: `(1/${fmt(x.r)} + 1/${fmt(y.r)})⁻¹`,
            value: r,
            members,
          });
          edges = edges
            .filter((_, k) => k !== i && k !== j)
            .concat({ ...x, r, expression, members, tree });
          changed = true;
          break outer;
        }
      }
    if (changed) continue;
    for (const n of parent.keys()) {
      if (root(n) !== n || n === a || n === b) continue;
      const attached = edges.filter((e) => e.a === n || e.b === n);
      if (attached.length !== 2) continue;
      const [x, y] = attached;
      const members = [...x.members, ...y.members],
        expression = `(${x.expression} + ${y.expression})`,
        r = x.r + y.r;
      const tree: ResistanceExpression = {
        kind: "series",
        left: x.tree,
        right: y.tree,
      };
      steps.push({
        kind: "series",
        tree,
        operands: [x.r, y.r],
        expression,
        numeric: `${fmt(x.r)} + ${fmt(y.r)}`,
        value: r,
        members,
      });
      edges = edges
        .filter((e) => e !== x && e !== y)
        .concat({
          a: x.a === n ? x.b : x.a,
          b: y.a === n ? y.b : y.a,
          r,
          expression,
          members,
          tree,
        });
      changed = true;
      break;
    }
  }
  const test = solve({
    ...c,
    parts: c.parts.map((p) => (p.id === source.id ? { ...p, value: 1 } : p)),
  });
  if (test.error) return { steps, reason: test.error };
  const i = -test.values[source.id].current;
  if (i < 1e-12)
    return {
      steps,
      reason: "لا يوجد حمل موصل بين قطبي المصدر: المقاومة المكافئة لا نهائية.",
    };
  return {
    value: 1 / i,
    steps,
    reason: edges.some(
      (e) => (e.a === a && e.b === b) || (e.b === a && e.a === b),
    )
      ? "اختزال التوالي والتوازي، والتحقق بمصدر اختبار 1V."
      : "شبكة غير قابلة للاختزال البسيط: حُسبت المكافئة بتحليل العقد ومصدر اختبار 1V.",
  };
}
export function checks(c: Circuit, r: Result, t = topology(c)) {
  const kcl = t.nodes
    .map((n) => ({
      id: n.id,
      terms: t.branches
        .filter((b) => b.active && (b.a === n.id || b.b === n.id))
        .flatMap((b) => {
          const p = c.parts.find((p) => p.id === b.id)!;
          return [
            {
              id: b.id,
              sign:
                ((b.a === n.id ? 1 : 0) - (b.b === n.id ? 1 : 0)) *
                ref(p.currentRef),
            },
          ];
        })
        .filter((s) => s.sign !== 0),
    }))
    .map((n) => ({
      ...n,
      residual: n.terms.reduce(
        (sum, s) =>
          sum +
          s.sign *
            (reading(
              c.parts.find((p) => p.id === s.id)!,
              r,
            )?.current ?? NaN),
        0,
      ),
    }));
  const kvl = t.loops.map((l) => ({
    ...l,
    terms: l.steps.map((s) => ({
      id: s.id,
      sign: s.sign * ref(c.parts.find((p) => p.id === s.id)!.voltageRef),
    })),
    residual: l.steps.reduce(
      (sum, s) => sum + s.sign * (r.values[s.id]?.voltage ?? NaN),
      0,
    ),
  }));
  const power = Object.values(r.values).reduce((sum, v) => sum + v.power, 0);
  return { kcl, kvl, power };
}

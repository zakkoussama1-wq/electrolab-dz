import { connectivity } from "./connectivity";
export type Kind =
  | "battery"
  | "resistor"
  | "lamp"
  | "switch"
  | "ammeter"
  | "voltmeter"
  | "capacitor";
export type Part = {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  rotation: number;
  value: number;
  closed: boolean;
  voltageRef?: 1 | -1;
  currentRef?: 1 | -1;
  initialVoltage?: number;
  label?: string;
  terminalLabels?: [string, string];
  capUnit?: "F" | "mF" | "µF" | "nF";
};
export type Wire = { id: string; a: string; b: string };
export type Circuit = { parts: Part[]; wires: Wire[]; nodeNames?: Record<string, string> };
export type Result = {
  error?: string;
  warning?: string;
  terminalVoltages?: Record<string, number>;
  values: Record<string, { voltage: number; current: number; power: number }>;
};
export const terminal = (id: string, n: number) => `${id}:${n}`;
export function solve(
  c: Circuit,
  sourceValues: Record<string, number> = {},
): Result {
  const values: Result["values"] = {};
  const fail = (error: string): Result => ({ error, values: {} });
  if (c.parts.some((p) => p.kind === "capacitor"))
    return fail(
      "المكثف عنصر زمني. استخدم مختبر RC لتحليله، ولا يُعامل كمقاومة في محرك DC.",
    );
  if (!c.parts.some((p) => p.kind === "battery"))
    return fail("لا يوجد مصدر جهد. أضف بطارية وأوصل قطبيها بالدارة.");
  if (c.parts.some((p) => !Number.isFinite(p.value) || p.value <= 0))
    return fail("القيم يجب أن تكون أعدادًا موجبة ومحدودة.");
  let connections: ReturnType<typeof connectivity>;
  try { connections = connectivity(c); }
  catch (e) { return fail((e as Error).message); }
  const parent = new Map<string, string>();
  for (const n of connections.nodes) for (const t of n.terminals) parent.set(t, n.terminals[0]);
  const root = (s: string): string => parent.get(s) === s ? s : root(parent.get(s)!);
  const join = (a: string, b: string) => parent.set(root(a), root(b));
  // Validate ideal short paths separately; keep switches as MNA branches so
  // their currents are solved rather than silently reported as zero.
  const shortParent = new Map(parent);
  c.parts
    .filter((p) => p.kind === "switch" && p.closed)
    .forEach((p) => join(terminal(p.id, 0), terminal(p.id, 1)));
  for (const p of c.parts.filter((p) => p.kind === "battery"))
    if (root(terminal(p.id, 0)) === root(terminal(p.id, 1)))
      return fail(
        "قصر كهربائي على البطارية! يوجد مسار أسلاك أو مفاتيح مغلقة بين قطبيها. أزل المسار وأضف مقاومة على التوالي.",
      );
  parent.clear();
  shortParent.forEach((v, k) => parent.set(k, v));
  // Modified nodal analysis, each connected island has its own reference node.
  const nodes = [...new Set([...parent.keys()].map(root))];
  const graph = new Map(nodes.map((n) => [n, new Set<string>()]));
  const active = c.parts.filter(
    (p) => p.kind !== "voltmeter" && !(p.kind === "switch" && !p.closed),
  );
  active.forEach((p) => {
    const a = root(terminal(p.id, 0)),
      b = root(terminal(p.id, 1));
    graph.get(a)!.add(b);
    graph.get(b)!.add(a);
  });
  const island = new Map<string, number>();
  const refs = new Set<string>();
  let count = 0;
  for (const n of nodes)
    if (!island.has(n)) {
      refs.add(n);
      const stack = [n];
      island.set(n, count);
      while (stack.length) {
        for (const k of graph.get(stack.pop()!)!)
          if (!island.has(k)) {
            island.set(k, count);
            stack.push(k);
          }
      }
      count++;
    }
  const unknown = nodes.filter((n) => !refs.has(n));
  const idx = new Map(unknown.map((n, i) => [n, i]));
  const sources = c.parts.filter(
    (p) => p.kind === "battery" || (p.kind === "switch" && p.closed),
  );
  const size = unknown.length + sources.length;
  const A = Array.from({ length: size }, () => Array(size + 1).fill(0));
  const add = (i: number | undefined, j: number | undefined, v: number) => {
    if (i !== undefined && j !== undefined) A[i][j] += v;
  };
  for (const p of active) {
    const a = idx.get(root(terminal(p.id, 0))),
      b = idx.get(root(terminal(p.id, 1)));
    if (sources.includes(p)) {
      const k = unknown.length + sources.indexOf(p);
      add(a, k, 1);
      add(b, k, -1);
      add(k, a, 1);
      add(k, b, -1);
      A[k][size] = p.kind === "battery" ? (sourceValues[p.id] ?? p.value) : 0;
    } else if (p.kind !== "switch") {
      const g = 1 / (p.kind === "ammeter" ? 0.001 : p.value);
      add(a, a, g);
      add(b, b, g);
      add(a, b, -g);
      add(b, a, -g);
    }
  }
  for (let k = 0; k < size; k++) {
    let pivot = k;
    for (let i = k + 1; i < size; i++)
      if (Math.abs(A[i][k]) > Math.abs(A[pivot][k])) pivot = i;
    if (Math.abs(A[pivot][k]) < 1e-12)
      return fail(
        "نظام غير قابل للحل بشكل فريد: مصادر متعارضة أو فروع مثالية زائدة (بطاريات أو مفاتيح مغلقة في حلقة مثالية). راجع التوصيلات.",
      );
    [A[k], A[pivot]] = [A[pivot], A[k]];
    const d = A[k][k];
    for (let j = k; j <= size; j++) A[k][j] /= d;
    for (let i = 0; i < size; i++)
      if (i !== k) {
        const f = A[i][k];
        for (let j = k; j <= size; j++) A[i][j] -= f * A[k][j];
      }
  }
  const voltage = (t: string) => {
    const i = idx.get(root(t));
    return i === undefined ? 0 : A[i][size];
  };
  let flowing = false;
  let floatingMeter = false;
  for (const p of c.parts) {
    const a = terminal(p.id, 0),
      b = terminal(p.id, 1);
    let v = voltage(a) - voltage(b);
    let current = 0;
    if (sources.includes(p))
      current = A[unknown.length + sources.indexOf(p)][size];
    else if (p.kind === "resistor" || p.kind === "lamp" || p.kind === "ammeter")
      current = v / (p.kind === "ammeter" ? 0.001 : p.value);
    if (island.get(root(a)) !== island.get(root(b))) {
      floatingMeter = true;
      v = NaN;
    }
    if (Math.abs(current) > 1e-9) flowing = true;
    values[p.id] = {
      voltage: v,
      current,
      power: current === 0 ? 0 : v * current,
    };
  }
  if (
    Object.values(values).some(
      (v) => !Number.isFinite(v.current) || !Number.isFinite(v.power),
    )
  )
    return fail("تعذر الحصول على حل عددي مستقر. راجع القيم والتوصيلات.");
  return {
    values,
    terminalVoltages: Object.fromEntries(
      [...parent.keys()].map((t) => [t, voltage(t)]),
    ),
    warning: floatingMeter
      ? "جهد فرع بين جزيرتين منفصلتين غير معرّف. أوصل طرفيه ضمن الدارة نفسها إذا أردت قياس فرق الجهد."
      : !flowing
        ? "لا يمر تيار: قد يكون المسار مفتوحًا أو فرق الجهد عبر الحمل صفرًا. افحص المفتاح ومسار الرجوع وقيم المصادر."
        : undefined,
  };
}
export const labels: Record<Kind, string> = {
  capacitor: "مكثف",
  battery: "بطارية",
  resistor: "مقاومة",
  lamp: "مصباح",
  switch: "مفتاح",
  ammeter: "أمبيرمتر",
  voltmeter: "فولتمتر",
};
export function example(n = 0): Circuit {
  const p = (
    id: string,
    kind: Kind,
    x: number,
    y: number,
    value: number,
  ): Part => ({ id, kind, x, y, value, rotation: 0, closed: true });
  const parts = [
    p("B1", "battery", 160, 230, 12),
    p("R1", "resistor", 420, 130, 100),
    p("R2", n === 2 ? "lamp" : "resistor", 680, 230, n === 2 ? 60 : 200),
  ];
  const pairs =
    n === 1
      ? [
          ["B1:0", "R1:0"],
          ["R1:0", "R2:0"],
          ["B1:1", "R1:1"],
          ["R1:1", "R2:1"],
        ]
      : [
          ["B1:0", "R1:0"],
          ["R1:1", "R2:0"],
          ["R2:1", "B1:1"],
        ];
  return { parts, wires: pairs.map(([a, b], i) => ({ id: `w${i}`, a, b })) };
}

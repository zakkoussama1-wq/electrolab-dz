export type Kind =
  "battery" | "resistor" | "lamp" | "switch" | "ammeter" | "voltmeter";
export type Part = {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  rotation: number;
  value: number;
  closed: boolean;
};
export type Wire = { id: string; a: string; b: string };
export type Circuit = { parts: Part[]; wires: Wire[] };
export type Result = {
  error?: string;
  warning?: string;
  values: Record<string, { voltage: number; current: number; power: number }>;
};
export const terminal = (id: string, n: number) => `${id}:${n}`;
export function solve(c: Circuit): Result {
  const values: Result["values"] = {};
  const fail = (error: string): Result => ({ error, values: {} });
  if (!c.parts.some((p) => p.kind === "battery"))
    return fail("لا يوجد مصدر جهد. أضف بطارية وأوصل قطبيها بالدارة.");
  if (c.parts.some((p) => !Number.isFinite(p.value) || p.value <= 0))
    return fail("القيم يجب أن تكون أعدادًا موجبة ومحدودة.");
  const parent = new Map<string, string>();
  c.parts.forEach((p) =>
    [0, 1].forEach((n) => parent.set(terminal(p.id, n), terminal(p.id, n))),
  );
  const root = (s: string): string => {
    const p = parent.get(s)!;
    return p === s ? s : root(p);
  };
  const join = (a: string, b: string) => parent.set(root(a), root(b));
  for (const w of c.wires) {
    if (!parent.has(w.a) || !parent.has(w.b))
      return fail("سلك متصل بطرف غير موجود. احذف السلك وأعد توصيله.");
    join(w.a, w.b);
  }
  c.parts
    .filter((p) => p.kind === "switch" && p.closed)
    .forEach((p) => join(terminal(p.id, 0), terminal(p.id, 1)));
  for (const p of c.parts.filter((p) => p.kind === "battery"))
    if (root(terminal(p.id, 0)) === root(terminal(p.id, 1)))
      return fail(
        "قصر كهربائي على البطارية! يوجد مسار أسلاك أو مفاتيح مغلقة بين قطبيها. أزل المسار وأضف مقاومة على التوالي.",
      );
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
  const sources = c.parts.filter((p) => p.kind === "battery");
  const size = unknown.length + sources.length;
  const A = Array.from({ length: size }, () => Array(size + 1).fill(0));
  const add = (i: number | undefined, j: number | undefined, v: number) => {
    if (i !== undefined && j !== undefined) A[i][j] += v;
  };
  for (const p of active) {
    const a = idx.get(root(terminal(p.id, 0))),
      b = idx.get(root(terminal(p.id, 1)));
    if (p.kind === "battery") {
      const k = unknown.length + sources.indexOf(p);
      add(a, k, 1);
      add(b, k, -1);
      add(k, a, 1);
      add(k, b, -1);
      A[k][size] = p.value;
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
        "مصادر جهد متعارضة أو زائدة. تجنّب توصيل البطاريات مباشرة على التوازي، وراجع قطبيتها.",
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
    if (p.kind === "battery")
      current = A[unknown.length + sources.indexOf(p)][size];
    else if (p.kind === "resistor" || p.kind === "lamp" || p.kind === "ammeter")
      current = v / (p.kind === "ammeter" ? 0.001 : p.value);
    if (p.kind === "voltmeter" && island.get(root(a)) !== island.get(root(b))) {
      floatingMeter = true;
      v = NaN;
    }
    if (Math.abs(current) > 1e-9) flowing = true;
    values[p.id] = { voltage: v, current, power: v * current };
  }
  return {
    values,
    warning: floatingMeter
      ? "جهاز قياس بين جزيرتين منفصلتين: القراءة غير معرّفة. أوصل طرفيه عبر عنصر ضمن الدارة نفسها."
      : !flowing
        ? "دارة مفتوحة: لا يمر تيار. أغلق المفتاح وتأكد من وجود مسار رجوع إلى البطارية."
        : undefined,
  };
}
export const labels: Record<Kind, string> = {
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

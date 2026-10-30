import { solve, type Circuit, type Part, type Result } from "./solver";
export const capUnits = { F: 1, mF: 1e-3, µF: 1e-6, nF: 1e-9 };
export type RCModel = {
  cap: Part;
  resistance: number;
  finalVoltage: number;
  tau: number;
  isolated: boolean;
  zero: Result;
  one: Result;
};
export type RCAnalysis = { model?: RCModel; error?: string };
export type RCFrame = {
  time: number;
  voltage: number;
  current: number;
  resistorVoltage: number;
  charge: number;
  energy: number;
  derivative: number;
  result: Result;
};
export function analyzeRC(c: Circuit): RCAnalysis {
  const caps = c.parts.filter((p) => p.kind === "capacitor");
  if (caps.length !== 1)
    return {
      error: caps.length
        ? "هذه النسخة تدعم مكثفًا واحدًا فقط. الدارات متعددة المكثفات تحتاج محللًا زمنيًا آخر."
        : "أضف مكثفًا واحدًا إلى دارة RC.",
    };
  const cap = caps[0];
  if (
    !Number.isFinite(cap.value) ||
    cap.value <= 0 ||
    !Number.isFinite(cap.initialVoltage ?? 0)
  )
    return {
      error: "السعة يجب أن تكون موجبة ومحدودة والجهد الابتدائي عددًا محدودًا.",
    };
  // Clamp the capacitor port to 0V and 1V using ideal voltage sources.
  // The external linear network gives Ic(Vc) = a - G Vc.
  const clamped = {
    ...c,
    parts: c.parts.map((p) =>
      p.id === cap.id ? { ...p, kind: "battery" as const, value: 1 } : p,
    ),
  };
  const zero = solve(clamped, { [cap.id]: 0 }),
    one = solve(clamped, { [cap.id]: 1 });
  if (zero.error || one.error)
    return {
      error:
        "تعذر تحليل منفذ المكثف: " +
        (zero.error || one.error) +
        " لا توصل المكثف مباشرة بمصدر مثالي أو قصر؛ يلزم مسار مقاوم محدد.",
    };
  const a = zero.values[cap.id].current,
    g = a - one.values[cap.id].current;
  if (Math.abs(g) < 1e-12) {
    if (Math.abs(a) > 1e-9) return { error: "منفذ غير صالح لنموذج RC السلبي." };
    return {
      model: {
        cap,
        resistance: Infinity,
        finalVoltage: NaN,
        tau: Infinity,
        isolated: true,
        zero,
        one,
      },
    };
  }
  if (g <= 0 || !Number.isFinite(g))
    return { error: "لم تُستخرج مقاومة مكافئة موجبة ومستقرة. راجع الشبكة." };
  const resistance = 1 / g,
    tau = resistance * cap.value,
    finalVoltage = a / g;
  if (!Number.isFinite(tau) || tau <= 0 || !Number.isFinite(finalVoltage))
    return { error: "القيم خارج المجال العددي المدعوم." };
  return {
    model: { cap, resistance, finalVoltage, tau, isolated: false, zero, one },
  };
}
export function sampleRC(
  m: RCModel,
  time: number,
  initial = m.cap.initialVoltage ?? 0,
): RCFrame {
  if (!Number.isFinite(time) || time < 0 || !Number.isFinite(initial))
    throw Error("الزمن والشرط الابتدائي غير صالحين");
  const voltage = m.isolated
    ? initial
    : m.finalVoltage + (initial - m.finalVoltage) * Math.exp(-time / m.tau);
  const current = m.isolated ? 0 : (m.finalVoltage - voltage) / m.resistance;
  const values: Result["values"] = {};
  const terminalVoltages: Record<string, number> = {};
  const mix = (a: number, b: number) => a + voltage * (b - a);
  for (const id of Object.keys(m.zero.values)) {
    const z = m.zero.values[id],
      o = m.one.values[id];
    const v = mix(z.voltage, o.voltage),
      i = id === m.cap.id ? current : mix(z.current, o.current);
    values[id] = { voltage: v, current: i, power: i === 0 ? 0 : v * i };
  }
  // Capacitor voltage is always its differential terminal voltage, even if
  // disconnected from the rest of the circuit.
  values[m.cap.id] = { voltage, current, power: voltage * current };
  for (const t of Object.keys(m.zero.terminalVoltages ?? {}))
    terminalVoltages[t] = mix(
      m.zero.terminalVoltages![t],
      m.one.terminalVoltages![t],
    );
  return {
    time,
    voltage,
    current,
    resistorVoltage: m.isolated ? 0 : m.finalVoltage - voltage,
    charge: m.cap.value * voltage,
    energy: 0.5 * m.cap.value * voltage ** 2,
    derivative: current / m.cap.value,
    result: {
      values,
      terminalVoltages,
      warning: m.isolated
        ? "المكثف معزول عن أي مسار مقاوم مغلق: يحتفظ بجهده ولا يفرغ تلقائيًا."
        : undefined,
    },
  };
}
export function eulerRC(
  m: RCModel,
  end: number,
  initial = m.cap.initialVoltage ?? 0,
  count = 1200,
) {
  if (!Number.isFinite(end) || end < 0 || !Number.isInteger(count) || count < 1)
    throw Error("Invalid integration interval");
  const dt = end / count;
  if (!m.isolated && dt > m.tau)
    throw Error("خطوة Euler كبيرة جدًا؛ قلّل الفترة أو زِد عدد الخطوات.");
  let voltage = initial;
  const points = [{ time: 0, voltage }];
  for (let i = 1; i <= count; i++) {
    if (!m.isolated) voltage += (dt * (m.finalVoltage - voltage)) / m.tau;
    points.push({ time: i * dt, voltage });
  }
  return points;
}
export function rcExample(n = 0): Circuit {
  const p = (
    id: string,
    kind: Part["kind"],
    x: number,
    y: number,
    value: number,
  ): Part => ({ id, kind, x, y, value, rotation: 0, closed: true });
  const cap = {
    ...p("C1", "capacitor", 700, 220, n === 3 ? 0.002 : 0.001),
    initialVoltage: n === 1 ? 12 : 0,
    capUnit: "µF" as const,
  };
  const resistor = p("R1", "resistor", 440, 120, n === 2 ? 2000 : 1000),
    sw = p("S1", "switch", 440, 340, 1);
  const parts =
    n === 1
      ? [resistor, cap, sw]
      : [p("B1", "battery", 160, 220, 12), resistor, cap, sw];
  const pairs =
    n === 1
      ? [
          ["C1:0", "R1:0"],
          ["R1:1", "S1:0"],
          ["S1:1", "C1:1"],
        ]
      : [
          ["B1:0", "R1:0"],
          ["R1:1", "C1:0"],
          ["C1:1", "S1:0"],
          ["S1:1", "B1:1"],
        ];
  return { parts, wires: pairs.map(([a, b], i) => ({ id: `rcw${i}`, a, b })) };
}
// Physical edits start a new experiment; switch-only edits preserve Vc.
export function rcSignature(c: Circuit, includeSwitch = true) {
  return JSON.stringify({
    parts: c.parts.map((p) => ({
      id: p.id,
      kind: p.kind,
      value: p.value,
      initial: p.initialVoltage,
      closed: includeSwitch ? p.closed : undefined,
    })),
    wires: c.wires,
  });
}
export function continueRC(
  old: RCModel,
  time: number,
  initial: number,
  next: Circuit,
) {
  const analysis = analyzeRC(next);
  return { ...analysis, initial: sampleRC(old, time, initial).voltage };
}
export function gradeRC(expected: number, answer: number, relative = 0.02) {
  return (
    Number.isFinite(answer) &&
    Math.abs(expected - answer) <= Math.max(1e-9, Math.abs(expected) * relative)
  );
}

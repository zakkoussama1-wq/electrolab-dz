import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeRC,
  sampleRC,
  rcExample,
  continueRC,
  eulerRC,
  gradeRC,
  capUnits,
} from "./rc.ts";
import { solve, type Circuit } from "./solver.ts";
import { checks } from "./analysis.ts";
const near = (a: number, b: number, tol = 1e-8) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const model = (c: Circuit) => {
  const a = analyzeRC(c);
  assert.equal(a.error, undefined);
  assert.ok(a.model);
  return a.model!;
};
test("RC charge: initial, tau, five tau and final values from independent exponential", () => {
  const m = model(rcExample());
  near(m.resistance, 1000);
  near(m.tau, 1);
  near(m.finalVoltage, 12);
  near(sampleRC(m, 0).voltage, 0);
  near(sampleRC(m, 0).current, 0.012);
  near(sampleRC(m, 1).voltage, 12 * (1 - Math.exp(-1)));
  near(sampleRC(m, 5).voltage, 12 * (1 - Math.exp(-5)));
  near(sampleRC(m, 100).voltage, 12);
});
test("RC discharge without a battery: sign, charge and stored energy", () => {
  const m = model(rcExample(1));
  near(m.finalVoltage, 0);
  const f = sampleRC(m, 1);
  near(f.voltage, 12 / Math.E);
  near(f.current, -0.012 / Math.E);
  near(f.charge, (0.001 * 12) / Math.E);
  near(f.energy, 0.5 * 0.001 * (12 / Math.E) ** 2);
});
test("RC arbitrary signed initial condition and source changes", () => {
  const c = rcExample();
  c.parts.find((p) => p.kind === "capacitor")!.initialVoltage = -3;
  c.parts.find((p) => p.kind === "battery")!.value = 5;
  const m = model(c);
  near(sampleRC(m, 0).voltage, -3);
  near(sampleRC(m, 2).voltage, 5 - 8 * Math.exp(-2));
  near(sampleRC(m, 100).voltage, 5);
});
test("RC changing R and C doubles the time constant independently", () => {
  near(model(rcExample(2)).tau, 2);
  near(model(rcExample(3)).tau, 2);
  near(
    sampleRC(model(rcExample(2)), 2).voltage,
    sampleRC(model(rcExample()), 1).voltage,
  );
});
test("RC instantaneous KCL, KVL, power and capacitor derivative", () => {
  for (const c of [rcExample(), rcExample(1), rcExample(2)]) {
    const m = model(c);
    for (const time of [0, 0.1, 1, 5]) {
      const f = sampleRC(m, time),
        v = checks(c, f.result);
      near(f.current, m.cap.value * f.derivative);
      near(m.finalVoltage - f.resistorVoltage - f.voltage, 0);
      near(v.power, 0);
      v.kcl.forEach((n) => near(n.residual, 0));
      v.kvl.forEach((l) => near(l.residual, 0));
      const dt = 1e-5;
      near(
        (sampleRC(m, time + dt).voltage -
          sampleRC(m, Math.max(0, time - dt)).voltage) /
          (time ? 2 * dt : dt),
        f.derivative,
        1e-4,
      );
    }
  }
});
test("RC opening switch retains voltage and closing it resumes continuously", () => {
  const c = rcExample(),
    m = model(c),
    before = sampleRC(m, 0.7);
  const opened = {
    ...c,
    parts: c.parts.map((p) =>
      p.kind === "switch" ? { ...p, closed: false } : p,
    ),
  };
  const next = continueRC(m, 0.7, 0, opened);
  assert.ok(next.model?.isolated);
  near(next.initial, before.voltage);
  const held = sampleRC(next.model!, 20, next.initial);
  near(held.voltage, before.voltage);
  near(held.current, 0);
  near(held.energy, before.energy);
  const closed = continueRC(next.model!, 20, next.initial, c);
  near(sampleRC(closed.model!, 0, closed.initial).voltage, before.voltage);
  near(
    sampleRC(closed.model!, 1, closed.initial).voltage,
    12 + (before.voltage - 12) / Math.E,
  );
});
test("RC equivalent network is derived from wires, not hard-coded component values", () => {
  const c = rcExample();
  c.parts.push({ ...c.parts.find((p) => p.id === "R1")!, id: "R2" });
  c.wires.push(
    { id: "pa", a: "R2:0", b: "R1:0" },
    { id: "pb", a: "R2:1", b: "R1:1" },
  );
  const m = model(c);
  near(m.resistance, 500);
  near(m.tau, 0.5);
  near(sampleRC(m, 0).current, 0.024);
});
test("RC actual capacitor orientation reverses canonical voltage and current", () => {
  const c = rcExample();
  c.wires = c.wires.map((w) => ({
    ...w,
    a: w.a.startsWith("C1:") ? (w.a === "C1:0" ? "C1:1" : "C1:0") : w.a,
    b: w.b.startsWith("C1:") ? (w.b === "C1:0" ? "C1:1" : "C1:0") : w.b,
  }));
  const m = model(c);
  near(m.finalVoltage, -12);
  near(sampleRC(m, 1).voltage, -12 * (1 - 1 / Math.E));
  near(sampleRC(m, 0).current, -0.012);
});
test("RC display reference changes do not alter physical response", () => {
  const c = rcExample(),
    original = sampleRC(model(c), 1);
  c.parts = c.parts.map((p) => ({ ...p, currentRef: -1, voltageRef: -1 }));
  const reversed = sampleRC(model(c), 1);
  near(reversed.voltage, original.voltage);
  near(reversed.current, original.current);
  near(reversed.energy, original.energy);
});
test("RC Euler comparison converges toward the analytic curve", () => {
  const m = model(rcExample()),
    exact = sampleRC(m, 1).voltage;
  const coarse = eulerRC(m, 1, 0, 20).at(-1)!.voltage,
    fine = eulerRC(m, 1, 0, 2000).at(-1)!.voltage;
  assert.ok(Math.abs(fine - exact) < Math.abs(coarse - exact) / 50);
  near(fine, exact, 0.001);
});
test("RC unsupported topologies and DC separation are explicit", () => {
  const c = rcExample();
  assert.match(solve(c).error!, /RC/);
  assert.ok(analyzeRC({ parts: [], wires: [] }).error);
  const multi = {
    ...c,
    parts: [
      ...c.parts,
      { ...c.parts.find((p) => p.kind === "capacitor")!, id: "C2" },
    ],
  };
  const snapshot = JSON.stringify(multi);
  assert.match(analyzeRC(multi).error!, /واحد/);
  assert.equal(analyzeRC(multi).model, undefined);
  const triple = { ...multi, parts: [...multi.parts, { ...multi.parts.at(-1)!, id: "C3" }] };
  assert.equal(analyzeRC(triple).model, undefined);
  assert.match(analyzeRC(triple).error!, /غير متاحة/);
  assert.equal(JSON.stringify(multi), snapshot);
  const recovered = { ...multi, parts: multi.parts.filter(p => p.id !== "C2") };
  near(model(recovered).tau, model(c).tau);
  const shorted = {
    ...c,
    wires: [...c.wires, { id: "short", a: "C1:0", b: "C1:1" }],
  };
  assert.ok(analyzeRC(shorted).error);
  const invalid = {
    ...c,
    parts: c.parts.map((p) =>
      p.kind === "capacitor" ? { ...p, value: -1 } : p,
    ),
  };
  assert.ok(analyzeRC(invalid).error);
});
test("RC capacitance units and exercise grading", () => {
  near(1000 * capUnits["µF"], 0.001);
  near(1 * capUnits["mF"], 0.001);
  near(1e6 * capUnits["nF"], 0.001);
  assert.ok(gradeRC(1, 1.01));
  assert.ok(!gradeRC(1, 1000));
  assert.ok(!gradeRC(0.012, -0.012));
  assert.ok(!gradeRC(1, NaN));
});

import { plainTex } from "./symbols.ts";
test("RC equation copying removes internal linking metadata from capacitor symbols", () => {
  assert.equal(
    plainTex("\\htmlData{symbol=C3}{C}\\frac{d\\htmlData{symbol=V3}{V_C}}{dt}"),
    "C\\frac{dV_C}{dt}",
  );
  assert.equal(plainTex("\\htmlData{symbol=I3}{I_C}"), "I_C");
});
test("RC loaded network: independent divider voltage and parallel port resistance", () => {
  const c = rcExample();
  c.parts.push({ ...c.parts.find((p) => p.id === "R1")!, id: "RL" });
  c.wires.push(
    { id: "load0", a: "RL:0", b: "C1:0" },
    { id: "load1", a: "RL:1", b: "C1:1" },
  );
  const m = model(c);
  near(m.finalVoltage, 6);
  near(m.resistance, 500);
  near(m.tau, 0.5);
  near(sampleRC(m, 1).voltage, 6 * (1 - Math.exp(-2)));
  near(checks(c, sampleRC(m, 0.4).result).power, 0);
});

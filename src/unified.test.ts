import { test } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import { classifyCircuit } from "./unified.ts";
import { example, solve, type Circuit } from "./solver.ts";
import { rcExample, sampleRC, analyzeRC } from "./rc.ts";
import { buildAcademicLesson } from "./academic.ts";
import { arithmetic, assessExam, validLaw } from "./exam.ts";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("unified single battery and resistor give actual DC current and power", () => {
  const c = example();
  c.parts = c.parts.slice(0, 2);
  c.wires = [
    { id: "a", a: "B1:0", b: "R1:0" },
    { id: "b", a: "B1:1", b: "R1:1" },
  ];
  assert.equal(classifyCircuit(c).mode, "dc");
  near(solve(c).values.R1.current, 0.12);
  near(solve(c).values.R1.power, 1.44);
});
test("automatic analysis chooses from elements and connections without mutating the circuit", () => {
  for (const c of [example(), example(1), rcExample(), rcExample(1)]) {
    const before = JSON.stringify(c);
    assert.equal(
      classifyCircuit(c).mode,
      c.parts.some((p) => p.kind === "capacitor") ? "rc" : "dc",
    );
    assert.equal(JSON.stringify(c), before);
  }
  const c = rcExample();
  c.parts.push({ ...c.parts.find((p) => p.kind === "capacitor")!, id: "C2" });
  assert.equal(classifyCircuit(c).mode, "unsupported");
});
test("adding an isolated capacitor keeps the existing DC network and energy state", () => {
  const c = example();
  const r = solve(c);
  c.parts.push({
    id: "C",
    kind: "capacitor",
    value: 0.001,
    initialVoltage: 5,
    x: 50,
    y: 50,
    rotation: 0,
    closed: true,
  });
  const m = analyzeRC(c).model!;
  assert.ok(m.isolated);
  const f = sampleRC(m, 100);
  near(f.result.values.R1.current, r.values.R1.current);
  near(f.energy, 0.0125);
  near(f.voltage, 5);
  c.parts.pop();
  assert.equal(classifyCircuit(c).mode, "dc");
  near(solve(c).values.R1.current, 0.04);
});
test("unified DC academic lessons keep all computations with ten ordered stages", () => {
  for (const method of ["Ohm", "KCL", "KVL", "Req"] as const) {
    const c = example();
    const l = buildAcademicLesson(c, solve(c), {
      method,
      quantity: method === "Req" ? "Req" : "I",
      selected: "R1",
    });
    assert.equal(l.steps.length, 10);
    assert.match(l.steps[0].title, /المعطيات/);
    assert.match(l.steps[8].title, /النتيجة/);
    near(l.value!, method === "Req" ? 300 : 0.04);
    for (const step of l.steps)
      for (const line of step.lines)
        katex.renderToString(line.tex, {
          throwOnError: true,
          strict: "ignore",
          trust: (ctx) => ctx.command === "\\htmlData",
        });
  }
});
test("bounded arithmetic grammar accepts calculations and rejects code and invalid operations", () => {
  near(arithmetic("12/(100+200)"), 0.04);
  near(arithmetic("1000*(1000*1e-6)"), 1);
  near(arithmetic("-2^2"), -4);
  near(arithmetic("2^3^2"), 512);
  for (const input of [
    "alert(1)",
    "globalThis",
    "1/0",
    "2**3",
    "1e999",
    "1+",
    "Math.exp(1)",
  ])
    assert.throws(() => arithmetic(input));
  assert.throws(() => arithmetic("1".repeat(201)));
});
test("exam corrects DC construction, selected references, laws, work and numeric answers", () => {
  const c = example(),
    a = {
      kind: "dc" as const,
      selected: "R1",
      references: true,
      law: "I=V/R",
      work: "12/(100+200)",
      values: [".04", "4"],
    };
  assert.ok(assessExam(c, a).checks?.every((x) => x.ok));
  c.parts[1].currentRef = -1;
  assert.ok(assessExam(c, a).checks?.some((x) => !x.ok));
  assert.ok(
    assessExam(c, {
      ...a,
      law: "I=-V/R",
      work: "-12/300",
      values: ["-.04", "4"],
    }).checks?.every((x) => x.ok),
  );
  assert.ok(assessExam(rcExample(), a).error);
});
test("exam corrects RC laws and time-dependent answers without preset result tables", () => {
  const c = rcExample(),
    a = {
      kind: "rc" as const,
      selected: "C1",
      references: true,
      law: "τ=R*C;I=C*dV/dt",
      work: "1000*(1000*1e-6)",
      values: ["1", String(12 * (1 - 1 / Math.E)), String(0.012 / Math.E)],
    };
  assert.ok(assessExam(c, a).checks?.every((x) => x.ok));
  c.parts.find((p) => p.kind === "resistor")!.value = 2000;
  assert.ok(assessExam(c, a).checks?.some((x) => !x.ok));
  assert.ok(validLaw("tau=RC\nI=-C*dV/dt", "rc", -1));
  assert.ok(!validLaw("I=V/R", "dc", -1));
});

import { freePlacement } from "./unified.ts";
test("new components occupy available space instead of covering terminals", () => {
  const c: Circuit = { parts: [], wires: [] };
  for (let i = 0; i < 6; i++) {
    const pos = freePlacement(c);
    assert.ok(
      c.parts.every(
        (p) => Math.abs(p.x - pos.x) >= 150 || Math.abs(p.y - pos.y) >= 150,
      ),
    );
    c.parts.push({
      id: String(i),
      kind: "resistor",
      value: 100,
      closed: true,
      rotation: 0,
      ...pos,
    });
  }
});

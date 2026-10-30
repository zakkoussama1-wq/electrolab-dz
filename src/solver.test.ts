import { test } from "node:test";
import assert from "node:assert/strict";
import { solve, example } from "./solver.ts";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("series: Ohm and Kirchhoff, power balance", () => {
  const r = solve(example());
  assert.equal(r.error, undefined);
  near(r.values.R1.current, 0.04);
  near(r.values.R1.voltage, 4);
  near(r.values.R2.voltage, 8);
  near(
    Object.values(r.values).reduce((s, v) => s + v.power, 0),
    0,
  );
});
test("parallel: branch voltages and source current", () => {
  const r = solve(example(1));
  near(r.values.R1.voltage, 12);
  near(r.values.R2.current, 0.06);
  near(r.values.B1.current, -0.18);
});
test("short circuit detected", () => {
  const c = example();
  c.wires.push({ id: "short", a: "B1:0", b: "B1:1" });
  assert.match(solve(c).error!, /قصر/);
});
test("open circuit has zero current", () => {
  const c = example();
  c.wires.pop();
  const r = solve(c);
  assert.ok(r.warning);
  near(r.values.R1.current, 0);
});
test("invalid wire rejected", () => {
  const c = example();
  c.wires[0].a = "missing:0";
  assert.ok(solve(c).error);
});
test("open and closed switch", () => {
  const c = example();
  c.parts.push({
    id: "S",
    kind: "switch",
    x: 0,
    y: 0,
    rotation: 0,
    value: 1,
    closed: false,
  });
  c.wires[2] = { id: "s1", a: "R2:1", b: "S:0" };
  c.wires.push({ id: "s2", a: "S:1", b: "B1:1" });
  near(solve(c).values.R1.current, 0);
  c.parts[3].closed = true;
  near(solve(c).values.R1.current, 0.04);
});
test("ideal voltmeter does not load circuit", () => {
  const c = example();
  c.parts.push({
    id: "V",
    kind: "voltmeter",
    x: 0,
    y: 0,
    rotation: 0,
    value: 1,
    closed: true,
  });
  c.wires.push(
    { id: "v1", a: "V:0", b: "R1:0" },
    { id: "v2", a: "V:1", b: "R1:1" },
  );
  const r = solve(c);
  near(r.values.V.voltage, 4);
  near(r.values.R1.current, 0.04);
});

// Independent analytical fixtures. These are synthetic engineering examples,
// not attributed to the university PDFs (not yet supplied).
import { topology, reading, equivalent, checks, ref } from "./analysis.ts";
import type { Circuit, Part } from "./solver.ts";
const component = (id: string, kind: Part["kind"], value: number): Part => ({
  id,
  kind,
  value,
  x: 100,
  y: 100,
  rotation: 0,
  closed: true,
});
function network(parts: Part[], nodes: string[][]): Circuit {
  return {
    parts,
    wires: nodes.flatMap((ts, n) =>
      ts.slice(1).map((t, i) => ({ id: `${n}-${i}`, a: ts[0], b: t })),
    ),
  };
}
const bridge = () =>
  network(
    [
      component("B", "battery", 12),
      ...["R1", "R2", "R3", "R4", "R5"].map((id) =>
        component(id, "resistor", id === "R4" ? 200 : 100),
      ),
    ],
    [
      ["B:0", "R1:0", "R3:0"],
      ["B:1", "R2:1", "R4:1"],
      ["R1:1", "R2:0", "R5:0"],
      ["R3:1", "R4:0", "R5:1"],
    ],
  );
test("unbalanced Wheatstone bridge against independent two-equation solution", () => {
  const c = bridge(),
    r = solve(c);
  assert.equal(r.error, undefined);
  // 3 Vx - Vy = 12; -Vx + 2.5 Vy = 12 => Vx=84/13, Vy=96/13.
  near(r.values.R2.voltage, 84 / 13);
  near(r.values.R4.voltage, 96 / 13);
  near(r.values.R5.current, -3 / 325);
  near(r.values.B.current, -33 / 325);
  const v = checks(c, r);
  v.kcl.forEach((n) => near(n.residual, 0));
  v.kvl.forEach((l) => near(l.residual, 0));
  near(v.power, 0);
  near(equivalent(c).value!, 1300 / 11);
});
test("two independent sources with resistor between them", () => {
  const c = network(
    [
      component("B1", "battery", 10),
      component("B2", "battery", 5),
      component("R", "resistor", 100),
    ],
    [
      ["B1:0", "R:0"],
      ["B2:0", "R:1"],
      ["B1:1", "B2:1"],
    ],
  );
  const r = solve(c);
  assert.equal(r.error, undefined);
  near(r.values.R.current, 0.05);
  near(r.values.B1.current, -0.05);
  near(r.values.B2.current, 0.05);
  near(checks(c, r).power, 0);
  assert.equal(equivalent(c).value, undefined);
});
test("all reference combinations preserve physics, Ohm signs, KCL and KVL", () => {
  for (const voltageRef of [1, -1] as const)
    for (const currentRef of [1, -1] as const) {
      const c = example(1);
      c.parts = c.parts.map((p) => ({ ...p, voltageRef, currentRef }));
      const r = solve(c),
        v = reading(c.parts[1], r)!;
      near(v.current, 0.12 * currentRef);
      near(v.voltage, 12 * voltageRef);
      near(v.voltage, ref(voltageRef) * ref(currentRef) * 100 * v.current);
      near(v.power, 1.44);
      const check = checks(c, r);
      check.kcl.forEach((n) => near(n.residual, 0));
      check.kvl.forEach((l) => near(l.residual, 0));
      near(check.power, 0);
    }
});
test("fundamental cycles include parallel edges, bridge rank is E-N+1", () => {
  const p = topology(example(1));
  assert.equal(p.nodes.length, 2);
  assert.equal(p.branches.length, 3);
  assert.equal(p.loops.length, 2);
  assert.equal(p.open.length, 0);
  const b = topology(bridge());
  assert.equal(b.nodes.length, 4);
  assert.equal(b.loops.length, 3);
  const c = example();
  c.wires.pop();
  assert.equal(topology(c).loops.length, 0);
  assert.equal(topology(c).open.length, 3);
});
test("equivalent resistance reduction and source-test verification", () => {
  const s = equivalent(example());
  near(s.value!, 300);
  assert.ok(s.steps.some((s) => s.kind === "series"));
  const p = equivalent(example(1));
  near(p.value!, 200 / 3);
  assert.ok(p.steps.some((s) => s.kind === "parallel"));
  const c = example();
  c.wires.pop();
  assert.equal(equivalent(c).value, undefined);
});
test("closed ideal switch current is solved and checked by KCL", () => {
  const c = example();
  c.parts.push(component("S", "switch", 1));
  c.wires[2] = { id: "s1", a: "R2:1", b: "S:0" };
  c.wires.push({ id: "s2", a: "S:1", b: "B1:1" });
  const r = solve(c);
  near(r.values.S.current, 0.04);
  near(r.values.S.voltage, 0);
  checks(c, r).kcl.forEach((n) => near(n.residual, 0));
});
test("wire direction and part order do not change physical solution", () => {
  const c = bridge(),
    r = solve(c);
  const changed = solve({
    ...c,
    parts: [...c.parts].reverse(),
    wires: c.wires.map((w) => ({ ...w, a: w.b, b: w.a })).reverse(),
  });
  for (const p of c.parts) {
    near(r.values[p.id].current, changed.values[p.id].current);
    near(r.values[p.id].voltage, changed.values[p.id].voltage);
  }
});
test("short paths through closed switches are detected", () => {
  const c = example();
  c.parts.push(component("S", "switch", 1));
  c.wires.push(
    { id: "s1", a: "B1:0", b: "S:0" },
    { id: "s2", a: "S:1", b: "B1:1" },
  );
  assert.match(solve(c).error!, /قصر/);
});
test("floating voltmeter reports undefined voltage with zero power", () => {
  const c = example();
  c.parts.push(component("V", "voltmeter", 1));
  const r = solve(c);
  assert.ok(Number.isNaN(r.values.V.voltage));
  near(r.values.V.current, 0);
  near(r.values.V.power, 0);
  assert.ok(r.warning);
});

import katex from "katex";
import { buildLesson, type Method } from "./lessons.ts";
import { symbols, linked, plainTex, nodeName } from "./symbols.ts";
function assertAcademic(
  c: Circuit,
  method: Method,
  quantity: "I" | "V" | "Req" = "I",
  selected = c.parts[1].id,
) {
  const r = solve(c);
  const lesson = buildLesson(c, r, { method, quantity, selected });
  assert.equal(lesson.reason, undefined, lesson.reason);
  assert.equal(lesson.steps.length, 7);
  assert.ok(lesson.steps[5].lines.some((l) => l.tex.includes("\\boxed")));
  for (const step of lesson.steps) {
    assert.ok(step.title);
    for (const l of step.lines) {
      katex.renderToString(l.tex, {
        throwOnError: true,
        strict: "ignore",
        trust: (ctx) => ctx.command === "\\htmlData",
      });
      assert.doesNotMatch(l.tex, /Iphys|Vref|Iref|MNA|φN|R1:0/);
      assert.doesNotMatch(plainTex(l.tex), /htmlData/);
    }
  }
  near(lesson.residual!, 0);
  return lesson;
}
test("academic Ohm lessons: seven steps, actual values and all reference signs", () => {
  for (const voltageRef of [1, -1] as const)
    for (const currentRef of [1, -1] as const) {
      const c = example();
      c.parts[1] = { ...c.parts[1], voltageRef, currentRef };
      near(assertAcademic(c, "Ohm").value!, 0.04 * currentRef);
      near(assertAcademic(c, "Ohm", "V").value!, 4 * voltageRef);
    }
  const c = example();
  c.parts[0].value = 24;
  c.parts[1].value = 200;
  near(assertAcademic(c, "Ohm").value!, 0.06);
});
test("academic Kirchhoff equations respect reference signs on series and parallel networks", () => {
  for (const c of [example(), example(1), bridge()])
    for (const currentRef of [1, -1] as const) {
      c.parts = c.parts.map((p, i) => ({
        ...p,
        currentRef,
        voltageRef: i % 2 ? -1 : 1,
      }));
      for (const m of ["KCL", "KVL"] as const) {
        near(
          assertAcademic(c, m).value!,
          solve(c).values[c.parts[1].id].current * currentRef,
        );
        near(
          assertAcademic(c, m, "V").value!,
          reading(c.parts[1], solve(c))!.voltage,
        );
      }
    }
});
test("academic equivalents: series, parallel fractions, general bridge and unsupported sources", () => {
  near(assertAcademic(example(), "Req", "Req").value!, 300);
  near(assertAcademic(example(1), "Req", "Req").value!, 200 / 3);
  near(assertAcademic(bridge(), "Req", "Req").value!, 1300 / 11);
  const c = example();
  c.parts.push(component("EXTRA", "battery", 1));
  assert.ok(
    buildLesson(c, solve(c), { method: "Req", quantity: "Req", selected: "R1" })
      .reason,
  );
});
test("presentation does not reveal UUIDs; symbols map back to actual circuit targets", () => {
  const c = example();
  const id = "a23dc123-4567-89ab-0123-ffffffffffff";
  c.parts[1].id = id;
  c.wires = c.wires.map((w) => ({
    ...w,
    a: w.a.replace("R1:", id + ":"),
    b: w.b.replace("R1:", id + ":"),
  }));
  const l = assertAcademic(c, "Req", "Req", id);
  assert.ok(
    !JSON.stringify(l).includes(id) ||
      l.steps.some((st) => st.focus.parts.includes(id)),
  );
  for (const st of l.steps) {
    assert.ok(!st.text.includes(id));
    for (const f of st.lines) assert.ok(!f.tex.includes(id));
  }
  const reg = symbols(c);
  assert.deepEqual(reg.part(id).focus.parts, [id]);
  assert.equal(reg.part(id).tex, "I_{2}");
  assert.equal(plainTex(linked(reg.part(id))), "I_{2}");
  assert.equal(nodeName(26), "AA");
});
test("academic unsupported operations explain limitations instead of fabricating a result", () => {
  const c = example();
  c.wires.pop();
  assert.ok(
    buildLesson(c, solve(c), { method: "KVL", quantity: "I", selected: "R1" })
      .reason,
  );
  assert.ok(
    buildLesson(example(), solve(example()), {
      method: "Ohm",
      quantity: "I",
      selected: "B1",
    }).reason,
  );
});

// RC shares the same test runner so CI validates both laboratories.
import "./rc.test.ts";

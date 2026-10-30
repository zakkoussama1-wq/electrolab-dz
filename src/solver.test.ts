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

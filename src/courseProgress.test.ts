import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseProgress, progressStatuses } from "./courseProgress.ts";
const markdown = readFileSync(
  new URL("../COURSE_PROGRESS.md", import.meta.url),
  "utf8",
);
const data = parseProgress(markdown);
test("course inventory includes every Series exercise and both multiple-diagram questions", () => {
  assert.deepEqual(data.errors, []);
  for (let n = 1; n <= 13; n++)
    assert.ok(
      data.items.some((r) => r.id === `S-${String(n).padStart(2, "0")}`),
    );
  for (let n = 1; n <= 6; n++)
    assert.ok(
      data.items.some((r) => r.id === `A-${String(n).padStart(2, "0")}`),
    );
  for (const id of [
    "S-04a",
    "S-04b",
    "A-01a",
    "A-01b",
    "S-13-KCL",
    "S-13-SUP",
    "S-13-MIL",
    "S-13-TH",
  ])
    assert.ok(data.items.some((r) => r.id === id));
  assert.equal(
    data.items.filter((r) => r.source === "Series 1.pdf").length,
    27,
  );
});
test("course inventory includes every named example and practice actually present", () => {
  for (const chapter of [2, 4])
    for (const kind of ["EX", "PR"])
      for (let n = chapter === 2 ? 1 : 2; n <= (chapter === 2 ? 15 : 12); n++)
        assert.ok(
          data.items.some(
            (r) => r.id === `C${chapter}-${kind}-${String(n).padStart(2, "0")}`,
          ),
        );
  assert.equal(data.items.filter((r) => /^C[24]-/.test(r.id)).length, 52);
  assert.equal(data.items.length, 94);
  assert.equal(data.topics.length, 13);
  assert.ok(!data.items.some((r) => r.id === "C4-EX-01"));
});
test("course progress never treats generic tests as exercise completion", () => {
  assert.equal(
    data.items.filter((r) => r.status === "اجتاز الاختبارات").length,
    4,
  );
  assert.deepEqual(data.items.filter(r=>r.status === "اجتاز الاختبارات").map(r=>r.id).sort(), ["C2-EX-02","C2-EX-05","C2-EX-08","S-01"]);
  for (const row of data.items) {
    assert.ok(progressStatuses.includes(row.status));
    if (row.id === "S-01") assert.match(row.tests, /exercise1.test.ts.*Chromium PASS/);
    else if (["C2-EX-02","C2-EX-05","C2-EX-08"].includes(row.id)) assert.match(row.tests,/studentCourse.test.ts.*Chromium PASS/);
    else assert.match(row.tests, /لم يُنفذ/);
    assert.ok(row.gap.length > 10);
    assert.ok(row.source === "Chapter 1.pdf" || row.source === "Series 1.pdf");
    for (const page of row.pages.split(/[–;]/).map(Number)) {
      assert.ok(
        Number.isInteger(page) &&
          page >= 1 &&
          page <= (row.source === "Chapter 1.pdf" ? 49 : 4),
      );
    }
  }
  assert.ok(
    data.items.some(
      (r) => r.id === "A-01b" && r.gap.includes("8Ω") && r.gap.includes("16Ω"),
    ),
  );
});
test("course page detects malformed status or duplicate identifiers instead of inventing progress", () => {
  assert.ok(
    parseProgress(markdown.replace("يحتاج اختبار | لم", "مكتمل وهميًا | لم"))
      .errors.length > 0,
  );
  const first = markdown.split("\n").find((l) => l.startsWith("| S-01 |"))!;
  const duplicate = markdown.replace(
    "<!-- EXERCISE_TABLE_END -->",
    first + "\n<!-- EXERCISE_TABLE_END -->",
  );
  assert.ok(parseProgress(duplicate).errors.some((x) => x.includes("مكرر")));
  assert.ok(parseProgress("").errors.length > 0);
});
test("course figure catalog covers all supplied PDF pages and visible figure identifiers", () => {
  const figures = readFileSync(
    new URL("../docs/COURSE_FIGURES.md", import.meta.url),
    "utf8",
  );
  for (let n = 1; n <= 49; n++)
    assert.ok(figures.includes(`| ${n} | ${n <= 30 ? n + 28 : n + 99} |`));
  assert.equal(
    figures.split("\n").filter((l) => /^\| [24]\.\d+ \|/.test(l)).length,
    96,
  );
});

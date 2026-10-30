export const progressStatuses = [
  "غير منفذ",
  "قيد التطوير",
  "يحتاج اختبار",
  "اجتاز الاختبارات",
  "غير مدعوم",
] as const;
export type ProgressStatus = (typeof progressStatuses)[number];
export type CourseItem = {
  id: string;
  name: string;
  source: string;
  pages: string;
  printed: string;
  figure: string;
  laws: string;
  status: ProgressStatus;
  tests: string;
  gap: string;
};
export type CourseTopic = {
  id: string;
  name: string;
  source: string;
  pages: string;
  coverage: string;
  status: ProgressStatus;
};
export function parseProgress(markdown: string) {
  const errors: string[] = [];
  const extract = (tag: string, size: number) => {
    const start = `<!-- ${tag}_START -->`,
      end = `<!-- ${tag}_END -->`;
    const first = markdown.indexOf(start),
      last = markdown.indexOf(end);
    if (first < 0 || last < first) {
      errors.push(`سجل ${tag} غير متاح`);
      return [] as string[][];
    }
    return markdown
      .slice(first + start.length, last)
      .split("\n")
      .filter((l) => /^\|\s*(?:S-|A-|C2-|C4-|F-|T-)/.test(l))
      .flatMap((line) => {
        const cells = line
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        if (cells.length !== size) {
          errors.push("صف متابعة غير صالح");
          return [];
        }
        return [cells];
      });
  };
  const items = extract("EXERCISE_TABLE", 10).map(
    ([id, name, source, pages, printed, figure, laws, status, tests, gap]) => ({
      id,
      name,
      source,
      pages,
      printed,
      figure,
      laws,
      status: status as ProgressStatus,
      tests,
      gap,
    }),
  );
  const topics = extract("TOPIC_TABLE", 6).map(
    ([id, name, source, pages, coverage, status]) => ({
      id,
      name,
      source,
      pages,
      coverage,
      status: status as ProgressStatus,
    }),
  );
  const ids = new Set<string>();
  for (const row of [...items, ...topics]) {
    if (ids.has(row.id)) errors.push(`معرف مكرر ${row.id}`);
    ids.add(row.id);
    if (!progressStatuses.includes(row.status))
      errors.push(`حالة غير معتمدة ${row.id}`);
  }
  return { items, topics, errors };
}

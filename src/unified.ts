import { type Circuit } from "./solver";
import { analyzeRC } from "./rc";
export function classifyCircuit(c: Circuit) {
  const count = c.parts.filter((p) => p.kind === "capacitor").length;
  if (!count)
    return {
      mode: "dc" as const,
      reason:
        "لا توجد مكثفات؛ نستخدم تحليل DC لحساب جهود العقد والتيارات والقدرات.",
    };
  const analysis = analyzeRC(c);
  if (analysis.error)
    return { mode: "unsupported" as const, reason: analysis.error };
  return {
    mode: "rc" as const,
    reason: analysis.model!.isolated
      ? "يوجد مكثف واحد دون مسار مقاوم مغلق؛ نحل بقية شبكة DC ويحافظ المكثف على جهده."
      : "يوجد مكثف واحد ومسار مقاوم محدد؛ نستخرج مكافئ ثيفينن عند منفذه ونستخدم الاستجابة الزمنية من الرتبة الأولى.",
  };
}
export function freePlacement(c: Circuit) {
  for (const y of [130, 310])
    for (const x of [230, 420, 610, 800])
      if (
        c.parts.every(
          (p) => Math.abs(p.x - x) >= 150 || Math.abs(p.y - y) >= 150,
        )
      )
        return { x, y };
  return { x: 480, y: 240 };
}

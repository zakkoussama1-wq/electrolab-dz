import { type Circuit, type Result } from "./solver";
import {
  buildLesson,
  type Method,
  type Quantity,
  type LessonStep,
} from "./lessons";
import { topology, checks, ref } from "./analysis";
import { symbols, linked, numberTex as num } from "./symbols";
export const academicTitles = [
  "1 · المعطيات",
  "2 · المطلوب",
  "3 · تحليل بنية الدارة",
  "4 · اختيار القانون وسبب استخدامه",
  "5 · القانون العام",
  "6 · تطبيق قانون كيرشوف",
  "7 · التعويض العددي",
  "8 · الحساب خطوة بخطوة",
  "9 · النتيجة النهائية",
  "10 · التفسير الفيزيائي والتحقق",
];
export function givenEquations(c: Circuit) {
  const s = symbols(c);
  return c.parts
    .filter((p) =>
      ["resistor", "lamp", "ammeter", "battery", "capacitor"].includes(p.kind),
    )
    .map((p) => ({
      tex: `${linked(s.part(p.id, p.kind === "battery" ? "V" : p.kind === "capacitor" ? "C" : "R"))}=${num(p.kind === "battery" ? p.value * ref(p.voltageRef) : p.kind === "ammeter" ? 0.001 : p.value)}\\,${p.kind === "battery" ? "\\mathrm{V}" : p.kind === "capacitor" ? "\\mathrm{F}" : "\\Omega"}`,
    }));
}
export function buildAcademicLesson(
  c: Circuit,
  r: Result,
  o: {
    method: Method;
    quantity: Quantity;
    selected: string;
    node?: string;
    loop?: string;
  },
) {
  const l = buildLesson(c, r, o);
  if (!l.steps.length) return l;
  const t = topology(c),
    v = checks(c, r, t),
    s = symbols(c),
    focus = { parts: c.parts.map((p) => p.id), terminals: [] };
  const terms = (items: { id: string; sign: number }[], letter: string) =>
    items
      .map(
        (x, i) =>
          `${x.sign < 0 ? "-" : i ? "+" : ""}${linked(s.part(x.id, letter))}`,
      )
      .join(" ");
  const n =
    v.kcl.find((n) => n.id === o.node) ||
    v.kcl.find((n) => n.terms.some((x) => x.id === o.selected));
  const loop =
    v.kvl.find((l) => l.id === o.loop) ||
    v.kvl.find((l) => l.terms.some((x) => x.id === o.selected));
  const kirchhoff: LessonStep = {
    title: "",
    text: "نراعي اتجاه السهم عند جمع التيارات، واتجاه اجتياز المسار عند جمع الجهود. النقر على رمز يبرز فرعه في الرسم.",
    focus,
    lines: [],
  };
  if (n)
    kirchhoff.lines.push({
      tex: `${terms(n.terms, "I") || "0"}=0`,
      caption: "معادلة التيار عند عقدة متصلة بالعنصر.",
    });
  if (loop)
    kirchhoff.lines.push({
      tex: `${terms(loop.terms, "V")}=0`,
      caption: "معادلة الجهد على حلقة تمر بالعنصر.",
    });
  if (!loop)
    kirchhoff.text +=
      " لا توجد حلقة ناقلة تمر بهذا العنصر؛ لا نكتب معادلة جهد لمسار مفتوح.";
  const extra: LessonStep = {
    title: "",
    text: "نستخرج العقد والفروع وأساس الحلقات المستقلة من الأسلاك، لا من شكل الرسم. تقاطع الأسلاك لا ينشئ عقدة تلقائيًا.",
    focus,
    lines: [
      {
        tex: `N=${t.nodes.length},\\quad B=${t.branches.length},\\quad L=${t.loops.length}`,
      },
    ],
  };
  const givens: LessonStep = {
    title: "",
    text: "هذه قيم العناصر الفعلية في الدارة، مع الجهد المرجعي للمصادر. المقاومة بالأوم والسعة بالفاراد.",
    focus,
    lines: givenEquations(c),
  };
  const old = l.steps;
  const steps = [
    givens,
    old[0],
    extra,
    old[1],
    old[2],
    kirchhoff,
    old[3],
    old[4],
    old[5],
    { ...old[6], text: old[5].text + " " + old[6].text },
  ].map((step, i) => ({ ...step, title: academicTitles[i] }));
  return { ...l, steps };
}

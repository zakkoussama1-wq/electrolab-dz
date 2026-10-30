import { type Circuit, solve } from "./solver";
import { analyzeRC, sampleRC, gradeRC } from "./rc";
import { reading, ref } from "./analysis";
// Bounded arithmetic grammar. No eval, code execution, names or function calls.
export function arithmetic(text: string): number {
  if (text.length > 200) throw Error("الحساب طويل جدًا");
  const tokens =
    text
      .replace(/[×]/g, "*")
      .replace(/[÷]/g, "/")
      .match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+\-*/^]|\S/g) || [];
  let at = 0,
    depth = 0;
  function atom(): number {
    if (++depth > 32) throw Error("تعشيق زائد");
    let n: number;
    if (tokens[at] === "(") {
      at++;
      n = add();
      if (tokens[at++] !== ")") throw Error("قوس مفقود");
    } else {
      const t = tokens[at++];
      if (!t || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(t))
        throw Error("استخدم أعدادًا وعمليات حسابية فقط");
      n = Number(t);
    }
    depth--;
    return n;
  }
  function power(): number {
    const n = atom();
    return tokens[at] === "^" ? (at++, n ** unary()) : n;
  }
  function unary(): number {
    if (tokens[at] === "+") {
      at++;
      return unary();
    }
    if (tokens[at] === "-") {
      at++;
      return -unary();
    }
    return power();
  }
  function mul(): number {
    let n = unary();
    while (tokens[at] === "*" || tokens[at] === "/") {
      const op = tokens[at++],
        v = unary();
      if (op === "/" && v === 0) throw Error("قسمة على صفر");
      n = op === "*" ? n * v : n / v;
    }
    return n;
  }
  function add(): number {
    let n = mul();
    while (tokens[at] === "+" || tokens[at] === "-") {
      const op = tokens[at++],
        v = mul();
      n = op === "+" ? n + v : n - v;
    }
    return n;
  }
  const value = add();
  if (at !== tokens.length || !Number.isFinite(value))
    throw Error("تعبير حسابي غير صالح");
  return value;
}
function normalize(text: string) {
  return text
    .toUpperCase()
    .replace(/Τ|TAU|τ/g, "T")
    .replace(/\s|[₀-₉]|_\{?\d+\}?/g, "")
    .replace(/I_?C/g, "I")
    .replace(/V_?C/g, "V")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/\bRI\b/g, "R*I")
    .replace(/\bIR\b/g, "I*R")
    .replace(/\bRC\b/g, "R*C");
}
export function validLaw(text: string, mode: "dc" | "rc", sign: number) {
  if (text.length > 500) return false;
  const parts = text
    .split(/[;؛\n]+/)
    .map(normalize)
    .filter(Boolean);
  const prefix = sign === 1 ? "" : "-";
  if (mode === "dc")
    return parts.some((x) =>
      [
        `I=${prefix}V/R`,
        `V=${prefix}R*I`,
        `V=${prefix}I*R`,
        `R=${prefix}V/I`,
      ].includes(x),
    );
  return (
    parts.includes("T=R*C") &&
    parts.some((x) =>
      [
        `I=${prefix}C*DV/DT`,
        `I=${prefix}C*(DV/DT)`,
        `I=${prefix}C*D(V)/DT`,
      ].includes(x),
    )
  );
}
export type ExamAnswer = {
  kind: "dc" | "rc";
  selected: string;
  references: boolean;
  law: string;
  work: string;
  values: string[];
};
export function assessExam(c: Circuit, a: ExamAnswer) {
  const caps = c.parts.filter((p) => p.kind === "capacitor");
  let expected: number[], labels: string[], calculation: number, sign: number;
  if (a.kind === "dc") {
    if (caps.length)
      return {
        error: "السؤال DC: أنشئ دارة مقاومة دون مكثف، أو اختر تمرين RC.",
      };
    const p = c.parts.find((p) => p.id === a.selected);
    if (!p || !["resistor", "lamp", "ammeter"].includes(p.kind))
      return { error: "حدّد عنصرًا مقاومًا من الرسم بعد تركيب الدارة." };
    const r = solve(c);
    if (r.error) return { error: r.error };
    const v = reading(p, r)!;
    expected = [v.current, v.voltage];
    labels = ["التيار (A)", "الجهد (V)"];
    calculation = v.current;
    sign = ref(p.currentRef) * ref(p.voltageRef);
  } else {
    const m = analyzeRC(c);
    if (!m.model) return { error: m.error };
    if (m.model.isolated)
      return {
        error:
          "أنشئ مسار شحن أو تفريغ مقاومًا؛ لا يوجد ثابت زمني محدود في الدارة المعزولة.",
      };
    const f = sampleRC(m.model, 1);
    expected = [
      m.model.tau,
      f.voltage * ref(m.model.cap.voltageRef),
      f.current * ref(m.model.cap.currentRef),
    ];
    labels = [
      "الثابت الزمني (s)",
      "جهد المكثف عند 1s (V)",
      "تيار المكثف عند 1s (A)",
    ];
    calculation = m.model.tau;
    sign = ref(m.model.cap.currentRef) * ref(m.model.cap.voltageRef);
  }
  let calculated: number | undefined;
  try {
    calculated = arithmetic(a.work);
  } catch {}
  return {
    checks: [
      {
        ok: a.references,
        text: "اعتماد السهم وقطبية الجهد بعد تحديدهما على الرسم.",
      },
      {
        ok: validLaw(a.law, a.kind, sign),
        text:
          a.kind === "dc"
            ? "صيغة قانون أوم يجب أن تطابق إشارات المرجعين."
            : "اكتب علاقة الثابت الزمني وعلاقة تيار المكثف بالمشتقة، مع إشارة المرجعين.",
      },
      {
        ok: calculated !== undefined && gradeRC(calculation, calculated),
        text:
          a.kind === "dc"
            ? "التعويض الحسابي للتيار بوحدة الأمبير."
            : "التعويض الحسابي للثابت الزمني بوحدة الثانية، مع تحويل السعة للفاراد.",
      },
      ...expected.map((v, i) => ({
        ok: !!a.values[i]?.trim() && gradeRC(v, Number(a.values[i])),
        text: `${labels[i]}: القيمة الصحيحة ${Number(v.toPrecision(7))}`,
      })),
    ],
  };
}

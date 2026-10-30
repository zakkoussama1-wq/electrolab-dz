import { type Circuit, type Result } from "./solver";
import {
  checks,
  equivalent,
  reading,
  ref,
  resistance,
  topology,
  type ResistanceExpression,
} from "./analysis";
import { symbols, linked, numberTex as num, type Focus } from "./symbols";
export type Method = "Ohm" | "KCL" | "KVL" | "Req";
export type Quantity = "I" | "V" | "Req";
export type MathLine = { tex: string; caption?: string };
export type LessonStep = {
  title: string;
  text: string;
  lines: MathLine[];
  focus: Focus;
};
export type Lesson = {
  steps: LessonStep[];
  reason?: string;
  value?: number;
  unit?: string;
  residual?: number;
};
export const titles = [
  "الخطوة الأولى: تحديد المطلوب",
  "الخطوة الثانية: اختيار القانون",
  "الخطوة الثالثة: كتابة القانون العام",
  "الخطوة الرابعة: التعويض",
  "الخطوة الخامسة: الحساب",
  "الخطوة السادسة: النتيجة النهائية",
  "الخطوة السابعة: التحقق",
];
const empty: Focus = { parts: [], terminals: [] };
const sum = (
  terms: { id: string; sign: number }[],
  term: (id: string) => string,
) =>
  terms
    .map((s, i) => `${s.sign < 0 ? "-" : i ? "+" : ""}${term(s.id)}`)
    .join(" ") || "0";
const unit = (s: string) => (s === "Ω" ? "\\,\\Omega" : `\\,\\mathrm{${s}}`);
const wrap = (v: number) => `\\left(${num(v)}\\right)`;
export function buildLesson(
  c: Circuit,
  r: Result,
  options: {
    method: Method;
    quantity: Quantity;
    selected: string;
    node?: string;
    loop?: string;
  },
): Lesson {
  if (r.error)
    return { steps: [], reason: "أصلح خطأ الدارة ثم شغّل المحاكاة لبدء الحل." };
  const { method, quantity } = options,
    t = topology(c),
    s = symbols(c),
    p = c.parts.find((p) => p.id === options.selected),
    verification = checks(c, r, t);
  const sym = (id: string, letter = "I") => linked(s.part(id, letter));
  const steps: LessonStep[] = titles.map((title) => ({
    title,
    text: "",
    lines: [],
    focus: p ? { parts: [p.id], terminals: [] } : empty,
  }));
  const line = (index: number, tex: string, caption?: string) =>
    steps[index].lines.push({ tex, caption });
  const pv = p ? reading(p, r) : undefined;
  const relevant = t.branches.find((b) => b.id === p?.id);
  let value: number, answer: string, u: string, residual: number;
  const powerCheck = () => {
    line(
      6,
      `\\sum_{k=1}^{${c.parts.length}} P_k = ${num(verification.power)}${unit("W")} \\approx 0`,
      "مجموع القدرة الممتصة والمزوّدة يقارب الصفر؛ السالب يعني أن العنصر يزوّد الدارة بالطاقة.",
    );
  };
  if (method === "Req") {
    const eq = equivalent(c);
    if (eq.value === undefined)
      return { steps: [], reason: eq.reason?.replace(/MNA/g, "تحليل العقد") };
    value = eq.value;
    answer = "R_{\\mathrm{eq}}";
    u = "Ω";
    steps.forEach(
      (st) =>
        (st.focus = {
          parts: c.parts
            .filter((p) => ["resistor", "lamp", "ammeter"].includes(p.kind))
            .map((p) => p.id),
          terminals: [],
        }),
    );
    steps[0].text =
      "المطلوب مقاومة الحمل المكافئة بين قطبي البطارية الوحيدة، لا المقاومة الداخلية للمصدر.";
    line(0, answer + " = \\;?");
    steps[1].text = eq.steps.length
      ? "نختزل فقط المقاومات التي يثبت اتصالها على التوالي أو التوازي، ثم نتحقق بمصدر اختبار جهده فولت واحد."
      : "الشبكة لا تختزل بالكامل بالتوالي والتوازي؛ نضع مصدر اختبار بفولت واحد ونحسب تياره من معادلات العقد. لا نفترض توصيلًا غير موجود.";
    line(2, "R_{\\mathrm{series}}=\\sum_k R_k");
    line(2, "R_{\\mathrm{parallel}}=\\left(\\sum_k\\frac{1}{R_k}\\right)^{-1}");
    line(2, "R_{\\mathrm{eq}}=\\frac{V_{\\mathrm{test}}}{I_{\\mathrm{test}}}");
    steps[2].text =
      "في التوالي يمر التيار نفسه؛ في التوازي يتساوى الجهد لأن العناصر بين العقدتين نفسيهما.";
    const treeTex = (tree: ResistanceExpression): string =>
      tree.kind === "element"
        ? sym(tree.id, "R")
        : tree.kind === "series"
          ? `\\left(${treeTex(tree.left)}+${treeTex(tree.right)}\\right)`
          : `\\left(\\frac{1}{${treeTex(tree.left)}}+\\frac{1}{${treeTex(tree.right)}}\\right)^{-1}`;
    eq.steps.forEach((red, i) => {
      line(
        2,
        `R_{(${i + 1})}=${treeTex(red.tree)}`,
        red.kind === "series" ? "مجموعة على التوالي" : "مجموعة على التوازي",
      );
      const [a, b] = red.operands;
      line(
        3,
        red.kind === "series"
          ? `R_{(${i + 1})}=${num(a)}+${num(b)}`
          : `R_{(${i + 1})}=\\frac{1}{\\frac{1}{${num(a)}}+\\frac{1}{${num(b)}}}`,
      );
      line(
        4,
        red.kind === "series"
          ? `\\begin{aligned}R_{(${i + 1})}&=${num(a)}+${num(b)}\\\\&=${num(red.value)}${unit("Ω")}\\end{aligned}`
          : `\\begin{aligned}R_{(${i + 1})}&=\\frac{1}{\\frac{1}{${num(a)}}+\\frac{1}{${num(b)}}}\\\\&=${num(a * b)}\\div ${num(a + b)}\\\\&=${num(red.value)}${unit("Ω")}\\end{aligned}`,
      );
    });
    if (!eq.steps.length) {
      line(3, "V_{\\mathrm{test}}=1" + unit("V"));
      line(3, `I_{\\mathrm{test}}=${num(1 / value)}${unit("A")}`);
    }
    line(
      4,
      `R_{\\mathrm{eq}}=\\frac{1}{${num(1 / value)}}=${num(value)}${unit("Ω")}`,
    );
    const source = c.parts.find((p) => p.kind === "battery")!;
    const actualI = -r.values[source.id].current;
    residual = source.value - actualI * value;
    line(
      6,
      `\\begin{aligned}V_{\\mathrm{source}}-I_{\\mathrm{load}}R_{\\mathrm{eq}}&=${num(source.value)}-${wrap(actualI)}\\times${num(value)}\\\\&=${num(residual)}${unit("V")}\\approx0\\end{aligned}`,
    );
    steps[6].text =
      "نتحقق باستخدام الجهد والتيار في الدارة الأصلية، لا مصدر الاختبار فقط. التيار هنا هو التيار الداخل للحمل من القطب الموجب للبطارية، مستقل عن سهم العرض.";
  } else {
    if (!p || !pv || !relevant)
      return {
        steps: [],
        reason: "اختر عنصرًا من الرسم أو الجدول لتحديد الكمية المطلوبة.",
      };
    if (quantity === "Req")
      return {
        steps: [],
        reason: "اختر طريقة المقاومة المكافئة لحساب مقاومة الحمل.",
      };
    answer = sym(p.id, quantity);
    value = quantity === "I" ? pv.current : pv.voltage;
    u = quantity === "I" ? "A" : "V";
    if (!Number.isFinite(value))
      return {
        steps: [],
        reason:
          "الجهد بين جزيرتين منفصلتين غير معرّف. صِل الطرفين ضمن الدارة نفسها قبل الحل.",
      };
    steps[0].text = `المطلوب ${quantity === "I" ? "حساب تيار" : "حساب الجهد على"} العنصر ${c.parts.indexOf(p) + 1}، وفق السهم والقطبية الظاهرين في الرسم.`;
    line(0, answer + "=\\;?");
    const sign = ref(p.voltageRef) * ref(p.currentRef),
      factor = sign < 0 ? "-" : "";
    if (method === "Ohm") {
      if (!["resistor", "lamp", "ammeter"].includes(p.kind))
        return {
          steps: [],
          reason:
            "قانون أوم بهذه الصيغة يخص العناصر المقاومة. اختر مقاومة أو حلًا بقانون كيرشوف.",
        };
      steps[1].text =
        "نختار قانون أوم (Loi d’Ohm / Ohm’s law)، لأن هذا الفرع مقاومة خطية. نستخدم جهد الفرع أو تياره المحسوب من الدارة الكاملة، ثم نحسب الكمية المطلوبة.";
      steps[2].text =
        sign === 1
          ? "يدخل السهم المرجعي من الطرف الموجب، لذلك العلاقة موجبة."
          : "السهم يدخل من الطرف السالب للجهد المرجعي؛ لهذا تظهر إشارة ناقص. هذا تغيير مرجع، لا تغيير في الدارة.";
      line(2, `${sym(p.id, "V")}=${factor}${sym(p.id, "R")}\\,${sym(p.id)}`);
      line(
        2,
        quantity === "I"
          ? `${answer}=${factor}\\frac{${sym(p.id, "V")}}{${sym(p.id, "R")}}`
          : `${answer}=${factor}${sym(p.id, "R")}\\,${sym(p.id)}`,
      );
      line(3, `${sym(p.id, "R")}=${num(resistance(p))}${unit("Ω")}`);
      line(
        3,
        quantity === "I"
          ? `${answer}=${factor}\\frac{${wrap(pv.voltage)}}{${num(resistance(p))}}`
          : `${answer}=${factor}${num(resistance(p))}\\times${wrap(pv.current)}`,
      );
      value =
        quantity === "I"
          ? (sign * pv.voltage) / resistance(p)
          : sign * resistance(p) * pv.current;
      line(
        4,
        quantity === "I"
          ? `\\begin{aligned}${answer}&=\\frac{${num(sign * pv.voltage)}}{${num(resistance(p))}}\\\\&=${num(value)}${unit(u)}\\end{aligned}`
          : `\\begin{aligned}${answer}&=${num(sign * resistance(p))}\\times${wrap(pv.current)}\\\\&=${num(value)}${unit(u)}\\end{aligned}`,
      );
      const k = verification.kcl.find((n) =>
        n.terms.some((x) => x.id === p.id),
      );
      residual = k?.residual ?? NaN;
      if (k) {
        steps[6].focus = {
          parts: k.terms.map((x) => x.id),
          terminals: t.nodes.find((n) => n.id === k.id)!.terminals,
        };
        line(
          6,
          `${sum(k.terms, (id) => sym(id))}=0`,
          "معادلة التيارات عند العقدة المحددة في الرسم.",
        );
        line(
          6,
          `${sum(k.terms, (id) =>
            wrap(
              reading(
                c.parts.find((p) => p.id === id)!,
                r,
              )!.current,
            ),
          )}=${num(k.residual)}${unit("A")}\\approx0`,
        );
      }
      steps[6].text =
        "نراجع حفظ التيار في عقدة العنصر: مجموع التيارات الجبرية يقارب الصفر. هذا فحص مستقل للاتصال مع بقية الدارة، إضافة إلى موازنة القدرة.";
    } else if (method === "KCL") {
      const k =
        verification.kcl.find((n) => n.id === options.node) ||
        verification.kcl.find((n) => n.terms.some((x) => x.id === p.id));
      if (!k || !k.terms.length)
        return {
          steps: [],
          reason:
            "لا توجد تيارات فروع ناقلة في العقدة المختارة. اختر عقدة متصلة بالحمل.",
        };
      const n = t.nodes.find((n) => n.id === k.id)!;
      steps.forEach(
        (st) =>
          (st.focus = {
            parts: k.terms.map((x) => x.id),
            terminals: n.terminals,
          }),
      );
      steps[1].text =
        "نختار قانون كيرشوف للتيار (Loi des nœuds / Kirchhoff’s current law): التيار لا يتراكم في العقدة. نأخذ التيار الخارج موجبًا والداخل سالبًا، مع تصحيح الإشارة وفق الأسهم التي اخترتها.";
      line(2, "\\sum I_{\\mathrm{out}}-\\sum I_{\\mathrm{in}}=0");
      // Preserve the full nodal system, with textbook symbols and actual stamps.
      const refs = new Set<string>(),
        seen = new Set<string>();
      for (const node of t.nodes) {
        if (seen.has(node.id)) continue;
        refs.add(node.id);
        const stack = [node.id];
        seen.add(node.id);
        while (stack.length) {
          const current = stack.pop()!;
          for (const b of t.branches.filter(
            (b) => b.active && (b.a === current || b.b === current),
          )) {
            const next = b.a === current ? b.b : b.a;
            if (!seen.has(next)) {
              seen.add(next);
              stack.push(next);
            }
          }
        }
      }
      const system = (numeric: boolean) => {
        const equations = t.nodes
          .filter((n) => !refs.has(n.id))
          .map((n) => {
            const terms = t.branches
              .filter(
                (b) =>
                  b.active && b.a !== b.b && (b.a === n.id || b.b === n.id),
              )
              .map((b) => {
                const bp = c.parts.find((p) => p.id === b.id)!;
                const passive = ["resistor", "lamp", "ammeter"].includes(
                  bp.kind,
                );
                return {
                  id: b.id,
                  sign:
                    (b.a === n.id ? 1 : -1) *
                    (passive ? 1 : ref(bp.currentRef)),
                };
              });
            return (
              sum(terms, (id) => {
                const bp = c.parts.find((p) => p.id === id)!,
                  b = t.branches.find((b) => b.id === id)!;
                return ["resistor", "lamp", "ammeter"].includes(bp.kind)
                  ? `\\frac{${linked(s.node(b.a))}-${linked(s.node(b.b))}}{${numeric ? num(resistance(bp)) : sym(id, "R")}}`
                  : sym(id);
              }) + "=0"
            );
          });
        for (const id of refs) equations.push(`${linked(s.node(id))}=0`);
        for (const bp of c.parts.filter(
          (p) => p.kind === "battery" || (p.kind === "switch" && p.closed),
        )) {
          const b = t.branches.find((b) => b.id === bp.id)!;
          equations.push(
            `${linked(s.node(b.a))}-${linked(s.node(b.b))}=${bp.kind === "switch" ? "0" : numeric ? num(bp.value) : `${ref(bp.voltageRef) < 0 ? "-" : ""}${sym(bp.id, "V")}`}`,
          );
        }
        return equations;
      };
      line(
        2,
        "\\begin{gathered}" + system(false).join("\\\\") + "\\end{gathered}",
        "نظام معادلات العقد: تيار كل مقاومة يساوي فرق جهدي طرفيها مقسومًا على مقاومتها، ونضيف علاقات المصادر.",
      );
      line(
        3,
        "\\begin{gathered}" + system(true).join("\\\\") + "\\end{gathered}",
        "التعويض بالمقاومات وجهود المصادر الفعلية. نختار جهدًا مرجعيًا صفريًا لكل جزء متصل من الدارة.",
      );

      line(
        2,
        `${sum(k.terms, (id) => sym(id))}=0`,
        "المعادلة الخاصة بالعقدة المحددة في الرسم.",
      );
      line(
        3,
        `${sum(k.terms, (id) =>
          quantity === "I" && id === p.id
            ? sym(id)
            : wrap(
                reading(
                  c.parts.find((p) => p.id === id)!,
                  r,
                )!.current,
              ),
        )}=0`,
      );
      if (quantity === "I") {
        const term = k.terms.find((x) => x.id === p.id);
        if (!term)
          return {
            steps: [],
            reason:
              "العنصر المطلوب ليس فرعًا ناقلًا متصلًا بالعقدة المختارة. اختر عقدة من طرفيه أو قانونًا آخر.",
          };
        const others = k.terms.filter((x) => x.id !== p.id);
        const otherSum = others.reduce(
          (v, x) =>
            v +
            x.sign *
              reading(
                c.parts.find((p) => p.id === x.id)!,
                r,
              )!.current,
          0,
        );
        value = -otherSum / term.sign;
        line(
          2,
          `${answer}=\\frac{-\\left(${sum(others, (id) => sym(id))}\\right)}{${term.sign}}`,
        );
        line(
          4,
          `\\begin{aligned}${answer}&=\\frac{-\\left(${sum(others, (id) =>
            wrap(
              reading(
                c.parts.find((p) => p.id === id)!,
                r,
              )!.current,
            ),
          )}\\right)}{${term.sign}}\\\\&=\\frac{${num(-otherSum)}}{${term.sign}}\\\\&=${num(-otherSum / term.sign)}${unit("A")}\\end{aligned}`,
        );
      } else {
        const va =
            r.terminalVoltages?.[
              t.nodes.find((n) => n.id === relevant.a)!.terminals[0]
            ] ?? NaN,
          vb =
            r.terminalVoltages?.[
              t.nodes.find((n) => n.id === relevant.b)!.terminals[0]
            ] ?? NaN;
        value = ref(p.voltageRef) * (va - vb);
        line(
          2,
          `${answer}=${ref(p.voltageRef) < 0 ? "-" : ""}\\left(${linked(s.node(relevant.a))}-${linked(s.node(relevant.b))}\\right)`,
        );
        steps[3].text =
          "تُحل جهود العقد من نظام قوانين التيار وعلاقات المقاومات والمصادر، ثم نأخذ فرق جهدي طرفي العنصر حسب قطبيته المرجعية.";
        line(
          3,
          `${linked(s.node(relevant.a))}=${num(va)}${unit("V")},\\quad ${linked(s.node(relevant.b))}=${num(vb)}${unit("V")}`,
        );
        line(
          4,
          `\\begin{aligned}${answer}&=${ref(p.voltageRef) < 0 ? "-" : ""}\\left(${wrap(va)}-${wrap(vb)}\\right)\\\\&=${num(value)}${unit("V")}\\end{aligned}`,
        );
      }
      residual = k.residual;
      steps[6].text =
        "نعوّض التيارات في جميع عقد الدارة. القيم القريبة من الصفر هي بواقي عددية، وليست تيارات إضافية.";
      verification.kcl
        .filter((n) => n.terms.length)
        .forEach((n) =>
          line(
            6,
            `${sum(n.terms, (id) => sym(id))}=${num(n.residual)}${unit("A")}\\approx0`,
            "التحقق عند العقدة المرتبطة بالفروع في المعادلة.",
          ),
        );
    } else {
      const l =
        verification.kvl.find((l) => l.id === options.loop) ||
        verification.kvl.find((l) => l.terms.some((x) => x.id === p.id));
      if (!l)
        return {
          steps: [],
          reason:
            "لا توجد حلقة مغلقة تمر بالعنصر المختار. أكمل مسار الرجوع أو اختر عنصرًا في حلقة.",
        };
      const term = l.terms.find((x) => x.id === p.id);
      if (!term)
        return {
          steps: [],
          reason: "العنصر المطلوب خارج الحلقة المختارة. اختر حلقة تمر به.",
        };
      if (quantity === "I" && !["resistor", "lamp", "ammeter"].includes(p.kind))
        return {
          steps: [],
          reason:
            "قانون الجهد وحده لا يحدد تيار مصدر مثالي أو مفتاح. اختر قانون التيار، أو اختر جهد العنصر.",
        };
      steps.forEach(
        (st) => (st.focus = { parts: l.terms.map((x) => x.id), terminals: [] }),
      );
      steps[1].text =
        "نختار قانون كيرشوف للجهد (Loi des mailles / Kirchhoff’s voltage law): مجموع تغيرات الجهد على المسار المغلق يساوي صفرًا. تتبع إشارات + و− في الرسم؛ الاجتياز من + إلى − موجب والعكس سالب.";
      line(2, "\\sum_{\\mathrm{loop}} V_k=0");
      line(2, `${sum(l.terms, (id) => sym(id, "V"))}=0`);
      line(
        3,
        `${sum(l.terms, (id) =>
          id === p.id
            ? sym(id, "V")
            : wrap(
                reading(
                  c.parts.find((p) => p.id === id)!,
                  r,
                )!.voltage,
              ),
        )}=0`,
      );
      const others = l.terms.filter((x) => x.id !== p.id),
        otherSum = others.reduce(
          (v, x) =>
            v +
            x.sign *
              reading(
                c.parts.find((p) => p.id === x.id)!,
                r,
              )!.voltage,
          0,
        );
      value =
        quantity === "V"
          ? -otherSum / term.sign
          : (sign * (-otherSum / term.sign)) / resistance(p);
      line(
        2,
        `${sym(p.id, "V")}=\\frac{-\\left(${sum(others, (id) => sym(id, "V"))}\\right)}{${term.sign}}`,
      );
      line(
        4,
        `\\begin{aligned}${sym(p.id, "V")}&=\\frac{-\\left(${sum(others, (id) =>
          wrap(
            reading(
              c.parts.find((p) => p.id === id)!,
              r,
            )!.voltage,
          ),
        )}\\right)}{${term.sign}}\\\\&=\\frac{${num(-otherSum)}}{${term.sign}}\\\\&=${num(-otherSum / term.sign)}${unit("V")}\\end{aligned}`,
      );
      if (quantity === "I") {
        line(
          2,
          `${answer}=${factor}\\frac{${sym(p.id, "V")}}{${sym(p.id, "R")}}`,
        );
        line(
          4,
          `${answer}=${factor}\\frac{${wrap(pv.voltage)}}{${num(resistance(p))}}=${num(value)}${unit("A")}`,
        );
      }
      residual = l.residual;
      steps[6].text =
        "نعيد جمع الجهود على كل حلقة مستقلة. تقارب المجموع من الصفر يؤكد اتساق الجهود مع المسارات والقطبية المرجعية.";
      verification.kvl.forEach((l, i) =>
        line(
          6,
          `\\sum_{\\mathrm{loop}\,${i + 1}}V_k=${num(l.residual)}${unit("V")}\\approx0`,
        ),
      );
    }
    steps[5].text =
      value < 0
        ? "الإشارة السالبة تعني أن الاتجاه الحقيقي للكمية معاكس للمرجع المختار، ولا تعني وجود خطأ في الحساب."
        : "النتيجة وفق المرجع المرسوم. إذا كانت صفرًا فلا يوجد فرق جهد أو تيار لهذه الكمية.";
  }
  if (method !== "Req" && pv) {
    const expected = quantity === "I" ? pv.current : pv.voltage;
    if (
      !Number.isFinite(value) ||
      Math.abs(value - expected) > 1e-7 * Math.max(1, Math.abs(expected))
    )
      return {
        steps: [],
        reason:
          "لم يتوافق الاشتقاق العددي مع حل الدارة. راجع استقرار القيم والتوصيلات.",
      };
  }
  line(5, `\\boxed{${answer}=${num(value)}${unit(u)}}`);
  if (!steps[4].text)
    steps[4].text =
      "نحسب بالقيم الدقيقة داخليًا، ونقرّب الأرقام للعرض فقط. علامات المساواة مرتبة لتتبّع العملية.";
  powerCheck();
  const tolerance =
    1e-7 *
    Math.max(
      1,
      ...Object.values(r.values)
        .flatMap((v) => [Math.abs(v.current), Math.abs(v.voltage)])
        .filter(Number.isFinite),
    );
  steps[6].text +=
    Number.isFinite(residual) &&
    Math.abs(residual) <= tolerance &&
    Math.abs(verification.power) <= tolerance
      ? " تحقق الفحص ضمن الدقة العددية."
      : " لم يثبت التحقق عدديًا؛ لا تعتمد النتيجة قبل مراجعة القيم والتوصيلات.";
  return { steps, value, unit: u, residual };
}

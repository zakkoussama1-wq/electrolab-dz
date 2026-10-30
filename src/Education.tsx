import { useState } from "react";
import { type Circuit, type Result, labels } from "./solver";
import {
  topology,
  reading,
  ref,
  fmt,
  resistance,
  equivalent,
  checks,
} from "./analysis";
export type Highlight = { parts: string[]; terminals: string[] };
type Props = {
  c: Circuit;
  result: Result | null;
  selected: string;
  select: (id: string) => void;
  highlight: (h: Highlight) => void;
};
export function Education({ c, result, selected, select, highlight }: Props) {
  const [method, setMethod] = useState("auto"),
    [quantity, setQuantity] = useState("I"),
    [step, setStep] = useState(0);
  const t = topology(c),
    p = c.parts.find((p) => p.id === selected);
  const valid = result && !result.error ? result : null;
  const verification = valid ? checks(c, valid, t) : null;
  const chosen =
    method === "auto"
      ? quantity === "Req"
        ? "Req"
        : p && ["resistor", "lamp", "ammeter"].includes(p.kind)
          ? "Ohm"
          : "KCL"
      : method;
  const name = (id: string) =>
    `${labels[c.parts.find((p) => p.id === id)!.kind]} ${c.parts.findIndex((p) => p.id === id) + 1} (${id.slice(0, 8)})`;
  const equation = (terms: { id: string; sign: number }[], symbol: string) =>
    terms
      .map((s) => `${s.sign < 0 ? "−" : "+"}${symbol}[${s.id.slice(0, 8)}]`)
      .join(" ") + " = 0";
  const substitution = (
    terms: { id: string; sign: number }[],
    kind: "current" | "voltage",
  ) =>
    terms
      .map(
        (s) =>
          `${s.sign < 0 ? "−" : "+"}(${fmt(
            reading(
              c.parts.find((p) => p.id === s.id)!,
              valid!,
            )![kind],
          )})`,
      )
      .join(" ") + " ≈ 0";
  let steps: { title: string; text: string; formula?: string }[] = [];
  if (valid && p && chosen === "Ohm") {
    if (!["resistor", "lamp", "ammeter"].includes(p.kind))
      steps = [
        {
          title: "هذه الطريقة لا تنطبق على العنصر",
          text: "قانون أوم بهذه الصيغة يطبق على الفروع المقاومة. اختر مقاومة أو استخدم KCL وKVL للمصدر والمفتاح.",
        },
      ];
    else {
      const v = reading(p, valid)!,
        s = ref(p.currentRef) * ref(p.voltageRef);
      steps = [
        {
          title: "1 · لماذا قانون أوم؟",
          text: `الفرع ${name(p.id)} مقاومي خطي. الجهد والتيار في الدارة الكاملة حُسبا أولًا بـ MNA، ونستخدم قانون أوم لاشتقاق الكمية المختارة والتحقق منها.`,
        },
        {
          title: "2 · تحديد المراجع",
          text: `مرجع الجهد ${ref(p.voltageRef) === 1 ? "من الطرف 0 إلى 1" : "من الطرف 1 إلى 0"}، ومرجع التيار ${ref(p.currentRef) === 1 ? "0 → 1" : "1 → 0"}. عند تعاكس المرجعين يجب إدخال إشارة سالبة.`,
          formula: `Vref = (${s}) × R × Iref`,
        },
        {
          title: "3 · المعادلة الرمزية",
          text:
            quantity === "V"
              ? "نحسب الجهد من المقاومة والتيار."
              : "نقسم الجهد على المقاومة مع مراعاة إشارة المراجع.",
          formula:
            quantity === "V"
              ? `Vref = (${s}) × R × Iref`
              : `Iref = (${s}) × Vref / R`,
        },
        {
          title: "4 · التعويض والحساب",
          text: `R = ${fmt(resistance(p))} Ω.`,
          formula:
            quantity === "V"
              ? `Vref = (${s}) × ${fmt(resistance(p))} × (${fmt(v.current)}) = ${fmt(v.voltage)} V`
              : `Iref = (${s}) × (${fmt(v.voltage)}) / ${fmt(resistance(p))} = ${fmt(v.current)} A`,
        },
        {
          title: "5 · تفسير الإشارة والقدرة",
          text:
            v.current < 0
              ? "التيار المحسوب سالب: اتجاهه الحقيقي معاكس للسهم المرجعي. عكس السهم لا يغيّر الدارة أو الطاقة."
              : "التيار الموجب يتجه مع السهم المرجعي، والصفر يعني عدم مرور تيار.",
          formula: `Pabsorbed = (${s}) × Vref × Iref = ${fmt(v.power)} W`,
        },
      ];
    }
  } else if (valid && chosen === "KCL")
    steps = [
      {
        title: "1 · لماذا KCL؟",
        text: "الشحنة لا تتراكم في عقدة DC. نعتبر التيارات الخارجة موجبة، والداخلة سالبة. نجمع تيارات الفروع المحسوبة بـ MNA، وليس تيارات الأسلاك المثالية غير الفريدة.",
      },
      ...verification!.kcl
        .filter((n) => n.terms.length)
        .flatMap((n) => [
          {
            title: `${n.id} · المعادلة الرمزية`,
            text: "معامل كل تيار يعتمد على طرفه المتصل بالعقدة وسهمه المرجعي. اختر العقدة من تحليل البنية لإبرازها.",
            formula: equation(n.terms, "I"),
          },
          {
            title: `${n.id} · التعويض والتحقق`,
            text: `المتبقي العددي: ${fmt(n.residual)} A. ${Math.abs(n.residual) < 1e-7 ? "يتحقق قانون كيرشوف للتيار." : "لم ينجح التحقق؛ راجع استقرار الحل."}`,
            formula: substitution(n.terms, "current"),
          },
        ]),
    ];
  else if (valid && chosen === "KVL")
    steps = [
      {
        title: "1 · لماذا KVL؟",
        text: "مجموع هبوطات الجهد الجبرية على أي مسار مغلق يساوي صفرًا. نولد أساس حلقات مستقل من التوصيلات، ثم نربط إشارة كل جهد باتجاه اجتياز الحلقة والقطبية المختارة.",
      },
      ...verification!.kvl.flatMap((l) => [
        {
          title: `${l.id} · المعادلة الرمزية`,
          text: "إشارة موجبة عند الاجتياز من + المرجعي إلى −، وسالبة عند العكس.",
          formula: equation(l.terms, "V"),
        },
        {
          title: `${l.id} · التعويض والتحقق`,
          text: `المتبقي: ${fmt(l.residual)} V. ${Math.abs(l.residual) < 1e-7 ? "يتحقق قانون الجهد." : "التحقق لم ينجح."}`,
          formula: substitution(l.terms, "voltage"),
        },
      ]),
      ...(!t.loops.length
        ? [
            {
              title: "لا توجد حلقة مغلقة",
              text: "لا يمكن تطبيق KVL على مسار مفتوح. أضف مسار الرجوع أولًا.",
            },
          ]
        : []),
    ];
  else if (valid && chosen === "Req") {
    const eq = equivalent(c);
    steps = [
      {
        title: "1 · تحديد منفذ المكافئة",
        text: "نحسب مقاومة الحمل التي تراها البطارية الوحيدة. الأسلاك والمفاتيح المغلقة مثالية، والفولتمتر لا يحمّل الدارة. لا نستعمل معادلة توالٍ أو توازٍ إلا بعد فحص العقد.",
      },
      ...eq.steps.map((s, i) => ({
        title: `${i + 2} · ${s.kind === "series" ? "اختزال توالٍ" : "اختزال توازٍ"}`,
        text:
          s.kind === "series"
            ? "العقدة المشتركة لا تتفرع إلى حمل آخر، لذلك التيار نفسه يمر في العنصرين."
            : "العنصران بين العقدتين نفسيهما، لذلك الجهد متساوٍ.",
        formula: `R = ${s.expression}\nR = ${s.numeric} = ${fmt(s.value)} Ω`,
      })),
      {
        title: "التحقق العام بمصدر اختبار",
        text: eq.reason || "",
        formula:
          eq.value !== undefined
            ? `Vtest = 1 V; Iin = ${fmt(1 / eq.value)} A; Req = Vtest / Iin = ${fmt(eq.value)} Ω`
            : undefined,
      },
    ];
  }
  if (valid && verification && steps.length)
    steps.push({
      title: "التحقق من موازنة القدرة",
      text: "نحسب القدرة الممتصة بالمراجع الفيزيائية، دون تغييرها عند قلب أسهم العرض. السالب قدرة يزوّدها المصدر. هذا التحقق ليس حساب طاقة زمنية.",
      formula: `Σ P = ${fmt(verification.power)} W ≈ 0`,
    });
  if (valid && chosen === "KCL") {
    const equations = t.nodes
      .map((n) => {
        const terms = t.branches
          .filter(
            (b) => b.active && b.a !== b.b && (b.a === n.id || b.b === n.id),
          )
          .map((b) => {
            const p = c.parts.find((p) => p.id === b.id)!,
              sign = b.a === n.id ? "+" : "−";
            return ["resistor", "lamp", "ammeter"].includes(p.kind)
              ? `${sign}(φ${b.a} − φ${b.b}) / ${fmt(resistance(p))}`
              : `${sign}Iphys[${p.id.slice(0, 8)}]`;
          });
        return terms.length ? `${n.id}: ${terms.join(" ")} = 0` : "";
      })
      .filter(Boolean);
    const constraints = c.parts
      .filter((p) => p.kind === "battery" || (p.kind === "switch" && p.closed))
      .map((p) => {
        const b = t.branches.find((b) => b.id === p.id)!;
        return `φ${b.a} − φ${b.b} = ${p.kind === "battery" ? fmt(p.value) : 0} V`;
      });
    steps.splice(
      1,
      0,
      {
        title: "2 · بناء نظام تحليل العقد",
        text: "لكل فرع مقاوم نكتب Iphys = (φa − φb) / R، ونضيف تيارًا مجهولًا لكل مصدر أو مفتاح مثالي. نختار مرجع جهد واحدًا لكل جزيرة، ونحذف معادلة KCL التابعة له، ثم نحل النظام خطيًا (MNA). Iphys دائمًا من الطرف 0 إلى 1؛ Iref = sI × Iphys.",
        formula: [...equations, ...constraints].join("\n"),
      },
      {
        title: "3 · حل جهود العقد",
        text: "جهود العقد نسبية لمرجع اختاره المحلل في كل جزيرة. فرق جهد العنصر مستقل عن هذا الاختيار. هذه نتائج حل النظام، وليست قيمًا محفوظة للتجربة.",
        formula: t.nodes
          .map(
            (n) =>
              `φ${n.id} = ${fmt(valid.terminalVoltages?.[n.terminals[0]] ?? NaN)} V`,
          )
          .join("\n"),
      },
    );
  }
  if (valid && p && chosen !== "Req" && steps.length > 1) {
    const value = reading(p, valid)!;
    steps.push({
      title: "الكمية المطلوبة على العنصر المختار",
      text: name(p.id),
      formula:
        quantity === "V"
          ? `Vref = ${fmt(value.voltage)} V`
          : `Iref = ${fmt(value.current)} A`,
    });
  }
  const index = Math.min(step, Math.max(0, steps.length - 1));
  return (
    <section className="education">
      <div className="section-heading">
        <div>
          <h2>تحليل الدارة والتعلّم الهندسي</h2>
          <p>
            تحليل التوصيلات الفعلية · تقاطع خطين في الرسم لا ينشئ عقدة تلقائيًا
          </p>
        </div>
        <button
          className="outline"
          onClick={() => highlight({ parts: [], terminals: [] })}
        >
          مسح الإبراز
        </button>
      </div>
      <div className="analysis-grid">
        <div className="analysis-card">
          <h3>العقد Nodes · {t.nodes.length}</h3>
          <p>
            الأطراف المتصلة بسلك مثالي لها الجهد نفسه. φ جهد نسبي لمرجع كل
            جزيرة.
          </p>
          <div className="chips">
            {t.nodes.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  highlight({ parts: [], terminals: n.terminals });
                  setMethod("KCL");
                  setStep(0);
                }}
              >
                {n.id} · {n.terminals.length} أطراف{" "}
                {valid &&
                  `· φ=${fmt(valid.terminalVoltages?.[n.terminals[0]] ?? NaN)} V`}
              </button>
            ))}
          </div>
        </div>
        <div className="analysis-card">
          <h3>الفروع Branches · {t.branches.length}</h3>
          <p>
            كل عنصر ثنائي الطرف فرع. القياس المثالي والمفتاح المفتوح لا ينقلان
            تيارًا.
          </p>
          <div className="chips">
            {t.branches.map((b, i) => (
              <button
                key={b.id}
                onClick={() => {
                  select(b.id);
                  highlight({ parts: [b.id], terminals: [] });
                }}
              >
                B{i + 1} · {labels[c.parts[i].kind]}{" "}
                {!b.active ? "(مفتوح)" : ""}
              </button>
            ))}
          </div>
        </div>
        <div className="analysis-card">
          <h3>الحلقات المستقلة Loops · {t.loops.length}</h3>
          <p>أساس حلقات من شجرة امتداد، وليس استخراج Meshes مستوية.</p>
          <div className="chips">
            {t.loops.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  highlight({ parts: l.steps.map((s) => s.id), terminals: [] });
                  setMethod("KVL");
                  setStep(0);
                }}
              >
                {l.id} · {l.steps.length} فروع
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="topology-note">
        {t.open.length
          ? `${t.open.length} فروع قياس/مفتوحة أو خارج أي حلقة مغلقة. `
          : "كل الفروع الناقلة تنتمي لمسارات مغلقة. "}
        {t.shorted.length
          ? `فروع مقصورة بأسلاك: ${t.shorted.map(name).join("، ")}. `
          : ""}
        المسار المغلق شرط لمرور التيار، لكنه لا يضمن تيارًا غير صفري.
      </p>
      <div className="all-readings">
        <h3>نتائج جميع العناصر</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>العنصر</th>
                <th>Vref (V)</th>
                <th>Iref (A)</th>
                <th>القدرة الممتصة (W)</th>
                <th>تفسير التيار</th>
              </tr>
            </thead>
            <tbody>
              {c.parts.map((p, i) => {
                const v = valid ? reading(p, valid) : undefined;
                return (
                  <tr
                    key={p.id}
                    className={selected === p.id ? "active-reading" : ""}
                    onClick={() => select(p.id)}
                  >
                    <td>
                      <button onClick={() => select(p.id)}>
                        {labels[p.kind]} {i + 1}
                      </button>
                    </td>
                    <td>{v ? fmt(v.voltage) : "—"}</td>
                    <td>{v ? fmt(v.current) : "—"}</td>
                    <td>{v ? fmt(v.power) : "—"}</td>
                    <td>
                      {v
                        ? v.current < -1e-10
                          ? "عكس السهم المرجعي"
                          : v.current > 1e-10
                            ? "مع السهم المرجعي"
                            : "لا يمر تيار"
                        : "شغّل المحاكاة"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="teaching">
        <h2>حل الدارة خطوة بخطوة</h2>
        <p>
          اختر عنصرًا من الرسم أو الجدول. المعادلات تشتق من التوصيلات والقيم
          الحالية؛ الحساب العام بـ MNA ثم شرح القانون والتحقق منه.
        </p>
        <div className="teaching-controls">
          <label>
            الكمية المطلوبة
            <select
              aria-label="الكمية المطلوبة"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setMethod("auto");
                setStep(0);
              }}
            >
              <option value="I">التيار I</option>
              <option value="V">الجهد V</option>
              <option value="Req">المقاومة المكافئة Req</option>
            </select>
          </label>
          <label>
            طريقة الحل
            <select
              aria-label="طريقة الحل"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setStep(0);
              }}
            >
              <option value="auto">اقتراح الطريقة المناسبة</option>
              <option value="Ohm">قانون أوم</option>
              <option value="KCL">كيرشوف للتيار KCL</option>
              <option value="KVL">كيرشوف للجهد KVL</option>
              <option value="Req">المقاومة المكافئة</option>
            </select>
          </label>
          <span>
            الطريقة: {chosen} · {p ? name(p.id) : "اختر عنصرًا لقانون أوم"}
          </span>
        </div>
        {!valid ? (
          <p className="message">
            شغّل محاكاة صالحة لبدء الشرح. عند وجود خطأ تُعرض أسبابه بدل نتيجة
            تعليمية غير صحيحة.
          </p>
        ) : steps.length ? (
          <div className="step" aria-live="polite">
            <h3>{steps[index].title}</h3>
            <p>{steps[index].text}</p>
            {steps[index].formula && (
              <pre dir="ltr">{steps[index].formula}</pre>
            )}
            <div className="step-navigation">
              <button disabled={index === 0} onClick={() => setStep(index - 1)}>
                السابق
              </button>
              <span>
                {index + 1} / {steps.length}
              </span>
              <button
                disabled={index === steps.length - 1}
                onClick={() => setStep(index + 1)}
              >
                الخطوة التالية
              </button>
            </div>
          </div>
        ) : (
          <p>اختر عنصرًا مقاومًا لشرح قانون أوم.</p>
        )}
      </div>
      <p className="scope-note">
        هذه المرحلة: أوم، KCL، KVL، اختزال توالٍ/توازٍ ومكافئة مصدر اختبار. لا
        دعم تعليمي بعد للتراكب وميلمان وكينيلي وثيفنن ونورتن أو وضع الامتحان.
        ملفات PDF الجامعية لم تُرفق بعد.
      </p>
    </section>
  );
}

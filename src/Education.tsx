import { useState, useMemo, useEffect } from "react";
import { type Circuit, type Result, labels } from "./solver";
import { topology, reading, fmt } from "./analysis";
import { symbols, nodeName, type SymbolLink } from "./symbols";
import { MathFormula } from "./MathFormula";
import { type Method, type Quantity } from "./lessons";
import { buildAcademicLesson as buildLesson } from "./academic";
export type Highlight = { parts: string[]; terminals: string[] };
type Props = {
  c: Circuit;
  result: Result | null;
  selected: string;
  select: (id: string) => void;
  highlight: (h: Highlight) => void;
  currentHighlight: Highlight;
};
export function Education({
  c,
  result,
  selected,
  select,
  highlight,
  currentHighlight,
}: Props) {
  const [method, setMethod] = useState<Method | "auto">("auto");
  const [quantity, setQuantity] = useState<Quantity>("I");
  const [step, setStep] = useState(0);
  const [node, setNode] = useState("");
  const [loop, setLoop] = useState("");
  const t = useMemo(() => topology(c), [c]);
  const registry = useMemo(() => symbols(c), [c]);
  const p = c.parts.find((p) => p.id === selected);
  const valid = result && !result.error ? result : null;
  const chosen: Method =
    method === "auto"
      ? quantity === "Req"
        ? "Req"
        : p && ["resistor", "lamp", "ammeter"].includes(p.kind)
          ? "Ohm"
          : "KCL"
      : method;
  const methodNames: Record<Method, string> = {
    Ohm: "قانون أوم",
    KCL: "قانون كيرشوف للتيار",
    KVL: "قانون كيرشوف للجهد",
    Req: "المقاومة المكافئة",
  };
  const lesson = useMemo(
    () =>
      valid
        ? buildLesson(c, valid, {
            method: chosen,
            quantity,
            selected,
            node,
            loop,
          })
        : { steps: [] },
    [c, valid, chosen, quantity, selected, node, loop],
  );
  const index = Math.min(step, Math.max(0, lesson.steps.length - 1));
  useEffect(() => setStep(0), [selected, method, quantity, node, loop]);
  useEffect(() => {
    const focus = lesson.steps[index]?.focus;
    if (focus) highlight(focus);
  }, [lesson, index, highlight]);
  const active = registry.links
    .filter(
      (s) =>
        s.focus.parts.some((id) => currentHighlight.parts.includes(id)) ||
        s.focus.terminals.some((t) => currentHighlight.terminals.includes(t)),
    )
    .map((s) => s.key);
  const onSymbol = (link: SymbolLink) => highlight(link.focus);
  const name = (id: string) =>
    `${labels[c.parts.find((p) => p.id === id)!.kind]} ${c.parts.findIndex((p) => p.id === id) + 1}`;
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
            الأطراف المتصلة بسلك مثالي لها الجهد نفسه. جهود العقد نسبية لمرجع كل
            جزيرة.
          </p>
          <div className="chips">
            {t.nodes.map((n, ni) => (
              <button
                key={n.id}
                onClick={() => {
                  highlight({ parts: [], terminals: n.terminals });
                  setNode(n.id);
                  setMethod("KCL");
                  setStep(0);
                }}
              >
                العقدة {nodeName(ni)} · {n.terminals.length} أطراف{" "}
                {valid &&
                  `· الجهد ${fmt(valid.terminalVoltages?.[n.terminals[0]] ?? NaN)} فولت`}
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
            {t.loops.map((l, li) => (
              <button
                key={l.id}
                onClick={() => {
                  highlight({ parts: l.steps.map((s) => s.id), terminals: [] });
                  setLoop(l.id);
                  setMethod("KVL");
                  setStep(0);
                }}
              >
                الحلقة {li + 1} · {l.steps.length} فروع
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
                <th>
                  الجهد <i>V</i> (V)
                </th>
                <th>
                  التيار <i>I</i> (A)
                </th>
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
          الحالية، وتُراجع بقوانين حفظ التيار والجهد والقدرة.
        </p>
        <div className="teaching-controls">
          <label>
            الكمية المطلوبة
            <select
              aria-label="الكمية المطلوبة"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value as Quantity);
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
                setMethod(e.target.value as Method | "auto");
                setStep(0);
              }}
            >
              <option value="auto">اقتراح الطريقة المناسبة</option>
              <option value="Ohm">قانون أوم — Ohm</option>
              <option value="KCL">كيرشوف للتيار — Loi des nœuds</option>
              <option value="KVL">كيرشوف للجهد — Loi des mailles</option>
              <option value="Req">المقاومة المكافئة</option>
            </select>
          </label>
          <span>
            الطريقة: {methodNames[chosen]} ·{" "}
            {p ? name(p.id) : "اختر عنصرًا لقانون أوم"}
          </span>
          {chosen === "KCL" && (
            <label>
              العقدة
              <select
                aria-label="العقدة"
                value={node}
                onChange={(e) => setNode(e.target.value)}
              >
                <option value="">عقدة العنصر تلقائيًا</option>
                {t.nodes.map((n, i) => (
                  <option key={n.id} value={n.id}>
                    العقدة {nodeName(i)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {chosen === "KVL" && (
            <label>
              الحلقة
              <select
                aria-label="الحلقة"
                value={loop}
                onChange={(e) => setLoop(e.target.value)}
              >
                <option value="">حلقة العنصر تلقائيًا</option>
                {t.loops.map((l, i) => (
                  <option key={l.id} value={l.id}>
                    الحلقة {i + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="report-actions">
          <button className="outline" onClick={() => window.print()}>
            طباعة الحل / حفظ PDF
          </button>
          <span>
            اضغط رمزًا رياضيًا لإبراز ما يمثله في الدارة، أو حدّده في الرسم
            لإضاءته في المعادلة.
          </span>
        </div>
        {!valid ? (
          <p className="message">
            شغّل محاكاة صالحة لبدء الشرح. عند وجود خطأ تُعرض أسبابه بدل نتيجة
            تعليمية غير صحيحة.
          </p>
        ) : lesson.steps.length ? (
          <div className="step" aria-live="polite">
            <div className="step-progress" aria-label="مراحل الحل">
              {lesson.steps.map((st, i) => (
                <button
                  key={st.title}
                  className={i === index ? "current-step" : ""}
                  aria-current={i === index ? "step" : undefined}
                  onClick={() => setStep(i)}
                  aria-label={st.title}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <h3>{lesson.steps[index].title}</h3>
            <p>{lesson.steps[index].text}</p>
            {lesson.steps[index].lines.map((line, i) => (
              <div key={i}>
                {line.caption && (
                  <p className="equation-caption">{line.caption}</p>
                )}
                <MathFormula
                  tex={line.tex}
                  links={registry.links}
                  active={active}
                  onSymbol={onSymbol}
                />
              </div>
            ))}
            <div className="print-solution">
              {lesson.steps.map((st, i) => (
                <article key={i}>
                  <h3>{st.title}</h3>
                  <p>{st.text}</p>
                  {st.lines.map((line, j) => (
                    <MathFormula key={j} tex={line.tex} />
                  ))}
                </article>
              ))}
            </div>
            <div className="step-navigation">
              <button disabled={index === 0} onClick={() => setStep(index - 1)}>
                السابق
              </button>
              <span>
                {index + 1} / {lesson.steps.length}
              </span>
              <button
                disabled={index === lesson.steps.length - 1}
                onClick={() => setStep(index + 1)}
              >
                الخطوة التالية
              </button>
            </div>
          </div>
        ) : (
          <p className="message">{lesson.reason || "اختر عنصرًا لبدء الحل."}</p>
        )}
      </div>
      <p className="scope-note">
        هذه المرحلة: أوم، قانونا كيرشوف، اختزال توالٍ/توازٍ ومكافئة مصدر اختبار.
        لا دعم تعليمي بعد للتراكب وميلمان وكينيلي وثيفنن ونورتن أو التصحيح
        الرمزي الحر للمعادلات. ملفات PDF الجامعية لم تُرفق بعد.
      </p>
    </section>
  );
}

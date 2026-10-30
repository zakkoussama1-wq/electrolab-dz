import { useState, useRef, useEffect, useMemo } from "react";
import { type Circuit, type Result } from "./solver";
import {
  analyzeRC,
  sampleRC,
  eulerRC,
  rcSignature,
  gradeRC,
  type RCModel,
  type RCFrame,
  rcExample,
} from "./rc";
import { ref, fmt } from "./analysis";
import { symbols, linked, numberTex as num, type Focus } from "./symbols";
import { MathFormula } from "./MathFormula";
type Props = {
  c: Circuit;
  command: number;
  onResult: (r: Result | null) => void;
  onRunning: (running: boolean) => void;
  highlight: (f: Focus) => void;
  load: (c: Circuit) => void;
  resetToken: number;
};
const units = { voltage: "V", resistorVoltage: "V", current: "A", charge: "C" };
const chartLabels = {
  voltage: "جهد المكثف",
  resistorVoltage: "جهد المقاومة المكافئة",
  current: "تيار المكثف",
  charge: "شحنة المكثف",
};
function Chart({
  field,
  model,
  origin,
  horizon,
  cursor,
  onCursor,
  compare,
  sign,
}: {
  field: keyof typeof units;
  model: RCModel;
  origin: number;
  horizon: number;
  cursor: number;
  onCursor: (t: number) => void;
  compare: boolean;
  sign: number;
}) {
  const points = useMemo(
    () =>
      Array.from({ length: 241 }, (_, i) =>
        sampleRC(model, (horizon * i) / 240, origin),
      ),
    [model, horizon, origin],
  );
  const numerical = useMemo(
    () =>
      compare &&
      field === "voltage" &&
      (model.isolated || horizon <= 100 * model.tau)
        ? eulerRC(model, horizon, origin)
        : [],
    [compare, field, model, horizon, origin],
  );
  const all = points.map((p) => p[field] * sign);
  const min = Math.min(0, ...all),
    max = Math.max(0, ...all);
  const pad = (max - min || 1) * 0.12;
  const lo = min - pad,
    hi = max + pad;
  const x = (t: number) => 42 + (t / horizon) * 408,
    y = (v: number) => 155 - ((v - lo) / (hi - lo)) * 125;
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${x(p.time)} ${y(p[field] * sign)}`)
    .join(" ");
  const current = sampleRC(model, cursor, origin)[field] * sign;
  return (
    <div className="rc-chart">
      <div className="panel-title">
        <h3>{chartLabels[field]}</h3>
        <strong dir="ltr">
          {fmt(current)} {units[field]}
        </strong>
      </div>
      <svg
        viewBox="0 0 480 190"
        role="img"
        aria-label={`${chartLabels[field]} بدلالة الزمن؛ استخدم مؤشر الزمن أسفل الرسوم للتحكم بلوحة المفاتيح`}
        onPointerDown={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          onCursor(
            Math.max(
              0,
              Math.min(
                horizon,
                ((((e.clientX - box.left) / box.width) * 480 - 42) / 408) *
                  horizon,
              ),
            ),
          );
        }}
      >
        <path className="chart-axis" d="M42 20 V155 H452" />
        {[lo, 0, hi].map((v, i) => (
          <g key={i}>
            <path className="chart-grid" d={`M42 ${y(v)} H450`} />
            <text x="38" y={y(v) + 4} textAnchor="end">
              {Number(v.toPrecision(3))}
            </text>
          </g>
        ))}
        {!model.isolated &&
          [1, 5].map(
            (k) =>
              k * model.tau <= horizon && (
                <g key={k}>
                  <path
                    className="tau-line"
                    d={`M${x(k * model.tau)} 24 V155`}
                  />
                  <text x={x(k * model.tau)} y="17" textAnchor="middle">
                    {k === 1 ? "τ" : "5τ"}
                  </text>
                </g>
              ),
          )}
        <path className={`chart-curve curve-${field}`} d={path} />
        {numerical.length > 0 && (
          <path
            className="numerical-curve"
            d={numerical
              .map(
                (p, i) => `${i ? "L" : "M"}${x(p.time)} ${y(p.voltage * sign)}`,
              )
              .join(" ")}
          />
        )}
        <path className="cursor-line" d={`M${x(cursor)} 23 V155`} />
        <circle className="chart-point" cx={x(cursor)} cy={y(current)} r="4" />
        <text x="42" y="178">
          0
        </text>
        <text x="450" y="178" textAnchor="end">
          {fmt(horizon)} s
        </text>
      </svg>
    </div>
  );
}
function RCLesson({
  c,
  model,
  origin,
  frame,
  highlight,
}: {
  c: Circuit;
  model: RCModel;
  origin: number;
  frame: RCFrame;
  highlight: (f: Focus) => void;
}) {
  const [step, setStep] = useState(0);
  const registry = useMemo(() => symbols(c), [c]);
  const cap = c.parts.find((p) => p.id === model.cap.id)!;
  const sign = ref(cap.voltageRef) * ref(cap.currentRef);
  const V = linked({ ...registry.part(cap.id, "V"), tex: "V_C" }),
    I = linked({ ...registry.part(cap.id, "I"), tex: "I_C" }),
    C = linked({ ...registry.part(cap.id, "C"), tex: "C" }),
    Q = linked({ ...registry.part(cap.id, "Q"), tex: "Q" });
  const readV = frame.voltage * ref(cap.voltageRef),
    readI = frame.current * ref(cap.currentRef),
    final = model.finalVoltage * ref(cap.voltageRef),
    initial = origin * ref(cap.voltageRef);
  const R = "R_{\\mathrm{eq}}",
    sigma = sign === -1 ? "-" : "";
  const definitions =
    "الجهد والتيار في هذه المعادلات يتبعان المرجعين المرسومين. جهد المصدر النهائي يعبر عن الجهد الذي تراه سعة المكثف عبر الشبكة المقاومة؛ جهد المقاومة في الرسم البياني هو الهبوط المكافئ باتجاه شحن الطرف الأول.";
  const stages = model.isolated
    ? [
        {
          title: "المكثف المعزول يحتفظ بشحنته",
          text: "لا يوجد مسار مقاوم مغلق بين طرفيه. فتح المفتاح لا يخلق مسار تفريغ. في النموذج المثالي لا تسريب للشحنة.",
          tex: [
            `${I}=0`,
            `${V}(t)=${num(initial)}\\,\\mathrm{V}`,
            `${Q}=${C}${V}`,
            `W_C=\\frac12 ${C}${V}^2`,
          ],
        },
      ]
    : [
        {
          title: "1 · القانون العام: كيرشوف وعلاقة المكثف",
          text:
            "نطبق قانون الجهد على الشبكة المكافئة للمقاومات والمصدر. التيار موجب إذا دخل الطرف الموجب المرجعي، وسالب إذا عاكسه. " +
            definitions,
          tex: [
            `V_{\\infty}${sign === 1 ? "-" : "+"}${R}${I}-${V}=0`,
            `${I}=${sigma}${C}\\frac{d${V}}{dt}`,
          ],
        },
        {
          title: "2 · اشتقاق المعادلة التفاضلية",
          text: "نعوّض علاقة التيار في قانون الجهد؛ تتلاشى إشارتا المرجعين معًا، فتظل المعادلة الفيزيائية نفسها. الشحنة لا تتغير فجأة مع وجود مقاومة محدودة.",
          tex: [
            `${R}${C}\\frac{d${V}}{dt}+${V}=V_{\\infty}`,
            `\\frac{d(${V}-V_{\\infty})}{${V}-V_{\\infty}}=-\\frac{dt}{${R}${C}}`,
          ],
        },
        {
          title: "3 · التكامل والشرط الابتدائي",
          text: "بالتكامل وتطبيق الجهد الابتدائي نحصل على منحنى أسي يقترب من القيمة النهائية. إذا كان الجهد الابتدائي مساويًا للنهائي فالحل ثابت والتيار صفر، دون الحاجة للقسمة على فرق جهد صفري.",
          tex: [
            `\\tau=${R}${C}`,
            `${V}(t)=V_{\\infty}+\\left(V_0-V_{\\infty}\\right)e^{-t/\\tau}`,
            `${V}(0)=V_0`,
          ],
        },
        {
          title: "4 · التعويض بالقيم الفعلية",
          text: "القيم التالية مستخرجة من توصيلات الطالب الحالية ومن شرط بداية هذا المقطع الزمني. بعد تبديل المفتاح يبقى جهد المكثف متصلًا، ويبدأ عداد المقطع من الصفر.",
          tex: [
            `${R}=${num(model.resistance)}\\,\\Omega,\\quad ${C}=${num(cap.value)}\\,\\mathrm{F}`,
            `V_{\\infty}=${num(final)}\\,\\mathrm{V},\\quad V_0=${num(initial)}\\,\\mathrm{V}`,
            `\\tau=${num(model.resistance)}\\times${num(cap.value)}=${num(model.tau)}\\,\\mathrm{s}`,
          ],
        },
        {
          title: "5 · الحساب عند مؤشر الزمن",
          text: "نستعمل الزمن المحدد بالمؤشر، وليس رقمًا افتراضيًا. مع تغيير المرجع تتغير إشارات الجهد والتيار وفقًا له.",
          tex: [
            `\\begin{aligned}${V}(${num(frame.time)})&=${num(final)}+\\left(${num(initial)}-\\left(${num(final)}\\right)\\right)e^{-\\frac{${num(frame.time)}}{${num(model.tau)}}}\\\\&=${num(readV)}\\,\\mathrm{V}\\end{aligned}`,
            `${I}=${sigma}\\frac{V_{\\infty}-${V}}{${R}}=${num(readI)}\\,\\mathrm{A}`,
            `${Q}=${C}${V}=${num(frame.charge * ref(cap.voltageRef))}\\,\\mathrm{C}`,
            `W_C=\\frac12${C}${V}^2=${num(frame.energy)}\\,\\mathrm{J}`,
          ],
        },
        {
          title: "6 · النتيجة والتفسير الفيزيائي",
          text: "عند ثابت زمني واحد يتبقى نحو 36.8% من الفرق نحو القيمة النهائية؛ وعند خمسة ثوابت زمنية يتبقى نحو 0.674%. الوصول للنهائي ليس تامًا عند 5τ. التيار السالب يعني أنه يسري عكس السهم المرجعي.",
          tex: [
            `\\boxed{${V}=${num(readV)}\\,\\mathrm{V},\\quad ${I}=${num(readI)}\\,\\mathrm{A}}`,
            `\\frac{V_C(t)-V_{\\infty}}{V_0-V_{\\infty}}=e^{-t/\\tau}\\quad(V_0\\ne V_{\\infty})`,
          ],
        },
        {
          title: "7 · التحقق من قوانين الدارة",
          text: "نتحقق من معادلة الجهد، ومن أن تيار المكثف يساوي مشتقة شحنته. مجموع قدرات جميع العناصر، بما فيها القدرة الداخلة للمكثف، يساوي الصفر ضمن الدقة العددية.",
          tex: [
            `V_{\\infty}${sign === 1 ? "-" : "+"}${R}${I}-${V}=${num(final - sign * model.resistance * readI - readV)}\\,\\mathrm{V}\\approx0`,
            `${I}${sign === 1 ? "-" : "+"}${C}\\frac{d${V}}{dt}=${num(readI - sign * cap.value * frame.derivative * ref(cap.voltageRef))}\\,\\mathrm{A}\\approx0`,
            `\\sum_k P_k=${num(Object.values(frame.result.values).reduce((s, v) => s + v.power, 0))}\\,\\mathrm{W}\\approx0`,
          ],
        },
      ];
  const active = Math.min(step, stages.length - 1);
  const focus = (index: number) => ({
    parts: index === 0 || index === 6 ? c.parts.map((p) => p.id) : [cap.id],
    terminals: [],
  });
  return (
    <section className="teaching rc-teaching">
      <h2>حل دارة RC خطوة بخطوة</h2>
      <div className="step-progress">
        {stages.map((s, i) => (
          <button
            key={s.title}
            aria-label={s.title}
            className={active === i ? "current-step" : ""}
            onClick={() => {
              setStep(i);
              highlight(focus(i));
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <h3>{stages[active].title}</h3>
      <p>{stages[active].text}</p>
      {stages[active].tex.map((tex, i) => (
        <MathFormula
          key={i}
          tex={tex}
          links={registry.links}
          onSymbol={(s) => highlight(s.focus)}
        />
      ))}
      <div className="step-navigation">
        <button disabled={!active} onClick={() => setStep(active - 1)}>
          السابق
        </button>
        <span>
          {active + 1} / {stages.length}
        </span>
        <button
          disabled={active === stages.length - 1}
          onClick={() => setStep(active + 1)}
        >
          الخطوة التالية
        </button>
      </div>
    </section>
  );
}
export function RCLab({
  c,
  command,
  onResult,
  onRunning,
  highlight,
  load,
  resetToken,
}: Props) {
  const signature = rcSignature(c),
    base = rcSignature(c, false);
  const [analysis, setAnalysis] = useState(() => analyzeRC(c)),
    [origin, setOrigin] = useState(
      () => c.parts.find((p) => p.kind === "capacitor")?.initialVoltage ?? 0,
    ),
    [time, setTime] = useState(0),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [cursor, setCursor] = useState<number | null>(null),
    [exam, setExam] = useState(false),
    [reveal, setReveal] = useState(false),
    [compare, setCompare] = useState(false),
    [answers, setAnswers] = useState(["", "", ""]),
    [graded, setGraded] = useState(false);
  const previous = useRef({
    signature,
    base,
    resetToken,
    model: analysis.model,
    origin,
    time,
  });
  useEffect(() => {
    const old = previous.current;
    if (old.signature === signature && old.resetToken === resetToken) return;
    const next = analyzeRC(c);
    const preserve =
      old.base === base && old.resetToken === resetToken && old.model;
    const v = preserve
      ? sampleRC(old.model!, old.time, old.origin).voltage
      : (c.parts.find((p) => p.kind === "capacitor")?.initialVoltage ?? 0);
    previous.current = {
      signature,
      base,
      resetToken,
      model: next.model,
      origin: v,
      time: 0,
    };
    setAnalysis(next);
    setOrigin(v);
    setTime(0);
    setCursor(null);
    setGraded(false);
    setAnswers(["", "", ""]);
    if (!next.model) setRunning(false);
  }, [signature, base, c, resetToken]);
  previous.current.model = analysis.model;
  previous.current.origin = origin;
  previous.current.time = time;
  useEffect(() => {
    onRunning(running);
    return () => onRunning(false);
  }, [running, onRunning]);
  const model = analysis.model;
  const capView = c.parts.find((p) => p.id === model?.cap.id);
  useEffect(() => {
    if (command > 0 && model) setRunning(true);
  }, [command]);
  useEffect(() => {
    if (!running || !model) return;
    let prev = performance.now();
    const id = setInterval(() => {
      const now = performance.now(),
        dt = (now - prev) / 1000;
      prev = now;
      setTime(
        (t) => t + Math.min(dt, 0.5) * speed * (model.isolated ? 1 : model.tau),
      );
    }, 50);
    return () => clearInterval(id);
  }, [running, speed, model]);
  const horizon =
    model && !model.isolated
      ? Math.max(6 * model.tau, time)
      : Math.max(5, time);
  const viewTime = cursor ?? time;
  const frame = useMemo(
    () => (model ? sampleRC(model, viewTime, origin) : null),
    [model, viewTime, origin],
  );
  useEffect(() => {
    onResult(frame && (!exam || reveal) ? frame.result : null);
  }, [frame, exam, reveal, onResult, c]);
  function reset() {
    setRunning(false);
    setTime(0);
    setCursor(null);
    setOrigin(c.parts.find((p) => p.kind === "capacitor")?.initialVoltage ?? 0);
    setGraded(false);
  }
  const target = model ? sampleRC(model, 1, origin) : null;
  return (
    <section className="rc-lab">
      <div className="section-heading">
        <div>
          <h2>مختبر RC · الشحن والتفريغ</h2>
          <p>
            مكثف واحد · شبكة مقاومات ومصادر DC مستقلة · حل تحليلي من التوصيلات
            الفعلية
          </p>
        </div>
        <div className="rc-tabs">
          <button
            className={!exam ? "active" : ""}
            onClick={() => {
              setExam(false);
              setReveal(false);
            }}
          >
            وضع التعلم
          </button>
          <button
            className={exam ? "active" : ""}
            onClick={() => {
              reset();
              setExam(true);
              setReveal(false);
            }}
          >
            وضع الامتحان
          </button>
        </div>
      </div>
      {analysis.error && (
        <p role="alert" className="message error">
          {analysis.error}
        </p>
      )}
      {model && frame && (
        <>
          <div className="rc-controls">
            <button
              className="run"
              onClick={() => {
                setCursor(null);
                setRunning(!running);
              }}
            >
              {running ? "إيقاف مؤقت" : "تشغيل / استئناف"}
            </button>
            <button className="outline" onClick={reset}>
              إعادة البداية
            </button>
            <label>
              {model.isolated
                ? "سرعة الزمن (ثانية افتراضية/حقيقية)"
                : "سرعة الزمن (τ/ثانية حقيقية)"}
              <select
                aria-label="سرعة الزمن"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                {[0.1, 0.25, 1, 2, 5, 10].map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
            </label>
            <strong dir="ltr">t = {fmt(time)} s</strong>
            <span>
              الزمن منذ آخر تبديل للمفتاح. تغيير R أو C أو E أو الأسلاك يبدأ
              تجربة جديدة.
            </span>
          </div>
          {exam && (
            <div className="rc-exam">
              <h3>تمرين: احسب بنفسك</h3>
              <p>
                للدارة المرسومة والجهد الابتدائي{" "}
                {fmt(origin * ref(capView?.voltageRef))} V، احسب الثابت الزمني
                وجهد المكثف وتياره عند t = 1 s. احترم القطبية والسهم على المكثف.
                الإجابات بوحدات الثانية والفولت والأمبير.
              </p>
              {model.isolated ? (
                <p>
                  لا يوجد ثابت زمني محدود: أضف مسارًا مقاومًا قبل بدء التمرين.
                </p>
              ) : (
                <>
                  <div className="exam-inputs">
                    {[
                      "الثابت الزمني τ (s)",
                      "جهد المكثف عند 1s (V)",
                      "تيار المكثف عند 1s (A)",
                    ].map((label, i) => (
                      <label key={label}>
                        {label}
                        <input
                          type="number"
                          step="any"
                          aria-label={label}
                          value={answers[i]}
                          onChange={(e) => {
                            setAnswers((a) =>
                              a.map((x, k) => (i === k ? e.target.value : x)),
                            );
                            setGraded(false);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <button className="outline" onClick={() => setGraded(true)}>
                    تصحيح إجاباتي
                  </button>
                  {graded && (
                    <div role="status">
                      {[
                        model.tau,
                        target!.voltage * ref(capView?.voltageRef),
                        target!.current * ref(capView?.currentRef),
                      ].map((expected, i) => (
                        <p
                          key={i}
                          className={
                            answers[i].trim() &&
                            gradeRC(expected, Number(answers[i]))
                              ? "correct-answer"
                              : "wrong-answer"
                          }
                        >
                          {answers[i].trim() &&
                          gradeRC(expected, Number(answers[i]))
                            ? "إجابة صحيحة ضمن هامش 2%."
                            : [
                                "راجع تحويل السعة إلى فاراد، ثم اضرب المقاومة في السعة لحساب الثابت الزمني.",
                                "طبّق الحل الأسي مع الجهد الابتدائي والقيمة النهائية؛ لا يستقر المكثف فورًا.",
                                "احسب فرق الجهد المتبقي على المقاومة ثم اقسمه على المقاومة، وصحح الإشارة إذا كان السهم معكوسًا.",
                              ][i]}{" "}
                          القيمة الصحيحة:{" "}
                          <span dir="ltr">
                            {fmt(expected)} {["s", "V", "A"][i]}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}
              <button className="outline" onClick={() => setReveal(!reveal)}>
                {reveal ? "إخفاء الحل" : "أطلب إظهار الحل والمنحنيات"}
              </button>
            </div>
          )}
          {(!exam || reveal) && (
            <>
              <div className="rc-readings">
                {[
                  [
                    "الجهد المرجعي",
                    frame.voltage * ref(capView?.voltageRef),
                    "V",
                  ],
                  [
                    "التيار المرجعي",
                    frame.current * ref(capView?.currentRef),
                    "A",
                  ],
                  [
                    "الشحنة عند القطب + المرجعي",
                    frame.charge * ref(capView?.voltageRef),
                    "C",
                  ],
                  ["الطاقة المخزنة", frame.energy, "J"],
                  ["الثابت الزمني", model.tau, "s"],
                ].map(([name, value, u]) => (
                  <div key={String(name)}>
                    <small>{name}</small>
                    <strong dir="ltr">
                      {Number.isFinite(value) ? fmt(Number(value)) : "∞"}{" "}
                      <small>{u}</small>
                    </strong>
                  </div>
                ))}
              </div>
              <p className="message">
                {model.isolated
                  ? "لا يوجد مسار تفريغ: يبقى جهد المكثف ثابتًا حتى تعيد توصيله بمسار مقاوم."
                  : "عند τ اكتمل 63.2% من التغير نحو الجهد النهائي؛ عند 5τ اكتمل نحو 99.326%، وليس 100%."}
              </p>
              <div className="rc-graphs">
                {(
                  ["voltage", "resistorVoltage", "current", "charge"] as const
                ).map((field) => (
                  <Chart
                    key={field}
                    field={field}
                    model={model}
                    origin={origin}
                    horizon={horizon}
                    cursor={Math.min(viewTime, horizon)}
                    onCursor={(t) => setCursor(t)}
                    compare={compare}
                    sign={
                      field === "current"
                        ? ref(capView?.currentRef)
                        : ref(capView?.voltageRef)
                    }
                  />
                ))}
              </div>
              <div className="rc-cursor">
                <label>
                  مؤشر الزمن للقراءة <span dir="ltr">{fmt(viewTime)} s</span>
                  <input
                    aria-label="مؤشر الزمن RC"
                    type="range"
                    min="0"
                    max={horizon}
                    step={horizon / 2000}
                    value={Math.min(viewTime, horizon)}
                    onChange={(e) => setCursor(Number(e.target.value))}
                  />
                </label>
                <button className="outline" onClick={() => setCursor(null)}>
                  متابعة الزمن الحي
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={compare}
                    onChange={(e) => setCompare(e.target.checked)}
                  />{" "}
                  مقارنة عددية بطريقة Euler
                </label>
              </div>
              {compare && (
                <p className="muted">
                  الخط المتصل: الحل التحليلي المستخدم في المحاكاة. المتقطع:
                  تكامل Euler مستقل بخطوة {fmt(horizon / 1200)} s. تطابقهما
                  تقريبي، ودقة Euler تعتمد على الخطوة. تتوقف المقارنة العددية
                  إذا تجاوز العرض 100τ؛ أعد البداية لمقارنتها مجددًا.
                </p>
              )}
              <p className="muted">
                منحنى جهد المقاومة هو جهد مجموع الشبكة المكافئة، وليس بالضرورة
                جهد كل مقاومة منفردة. الجهود والشحنة تتبع قطبية المكثف المرجعية،
                والتيار يتبع سهمه المختار في الرسم.
              </p>
              <RCLesson
                c={c}
                model={model}
                origin={origin}
                frame={frame}
                highlight={highlight}
              />
            </>
          )}
        </>
      )}
      <section id="lessons" className="rc-experiments">
        <h3>خمس تجارب تعليمية</h3>
        <div className="lesson-grid">
          {[
            "شحن مكثف غير مشحون",
            "تفريغ عبر مقاومة",
            "تأثير زيادة المقاومة",
            "تأثير زيادة السعة",
            "مقارنة التحليل والتكامل العددي",
          ].map((label, i) => (
            <button
              className="lesson"
              key={label}
              onClick={() => {
                setRunning(false);
                setTime(0);
                setCursor(null);
                setCompare(i === 4);
                setExam(false);
                setReveal(false);
                load(rcExample(i));
              }}
            >
              <span className="lesson-number">0{i + 1}</span>
              <div>
                <h3>{label}</h3>
                <p>
                  {i === 0
                    ? "R=1kΩ، C=1000µF، E=12V"
                    : i === 1
                      ? "مكثف عند 12V ومقاومة، دون بطارية"
                      : i === 2
                        ? "المقاومة 2kΩ: قارن τ بالتجربة الأولى"
                        : i === 3
                          ? "السعة 2000µF: لاحظ تضاعف τ"
                          : "الحل الأسي مقابل طريقة Euler وخطئها العددي"}
                </p>
              </div>
            </button>
          ))}
        </div>
        <p className="muted">
          تحميل تجربة يستبدل دارة RC الحالية؛ احفظها أولًا. الجهد الابتدائي محدد
          بين طرف المكثف الأول والثاني، ولا يتغير عند عكس مرجع العرض. تغيير
          التبويب يعيد الزمن إلى بداية التجربة، مع الاحتفاظ بعناصر كل مختبر.
        </p>
      </section>
    </section>
  );
}

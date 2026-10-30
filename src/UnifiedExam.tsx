import { useState, useEffect } from "react";
import { type Circuit } from "./solver";
import { assessExam } from "./exam";
export function UnifiedExam({
  c,
  selected,
  reveal,
  onReveal,
}: {
  c: Circuit;
  selected: string;
  reveal: boolean;
  onReveal: () => void;
}) {
  const [kind, setKind] = useState<"dc" | "rc">(
      c.parts.some((p) => p.kind === "capacitor") ? "rc" : "dc",
    ),
    [references, setReferences] = useState(false),
    [law, setLaw] = useState(""),
    [work, setWork] = useState(""),
    [values, setValues] = useState(["", "", ""]),
    [report, setReport] = useState<ReturnType<typeof assessExam> | null>(null);
  useEffect(() => setReport(null), [c, selected]);
  const labels =
    kind === "dc"
      ? ["التيار (A)", "الجهد (V)"]
      : [
          "الثابت الزمني (s)",
          "جهد المكثف عند 1s (V)",
          "تيار المكثف عند 1s (A)",
        ];
  return (
    <section className="rc-exam unified-exam">
      <h2>وضع الامتحان · ارسم ثم حل</h2>
      <label>
        نوع السؤال
        <select
          aria-label="نوع سؤال الامتحان"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as "dc" | "rc");
            setReport(null);
          }}
        >
          <option value="dc">دارة مقاومة ومصدر DC</option>
          <option value="rc">شحن أو تفريغ مكثف واحد</option>
        </select>
      </label>
      <p>
        {kind === "dc"
          ? "ركّب دارة مصدر ومقاومة أو شبكة مقاومات، ثم حدد مقاومة على الرسم. عيّن المراجع واحسب تيارها وجهدها."
          : "ركّب دارة ذات مكثف واحد ومسار مقاوم، واختر جهدًا ابتدائيًا. احسب الثابت الزمني وجهد المكثف وتياره عند ثانية واحدة من هذا الشرط الابتدائي."}{" "}
        يمكنك تعديل الرسم والقيم قبل التصحيح. لا تظهر القراءات أو المنحنيات أو
        الحل إلا بطلبك.
      </p>
      <label>
        <input
          type="checkbox"
          checked={references}
          onChange={(e) => setReferences(e.target.checked)}
        />{" "}
        حددت السهم وقطبية الجهد على الرسم وأعتمد هذين المرجعين
      </label>
      <label className="exam-writing">
        القانون بالرموز
        <input
          maxLength={500}
          aria-label="قانون الطالب"
          dir="ltr"
          value={law}
          onChange={(e) => {
            setLaw(e.target.value);
            setReport(null);
          }}
          placeholder={
            kind === "dc"
              ? "اكتب علاقة I وV وR"
              : "اكتب علاقتي τ و I، وافصل بينهما بفاصلة منقوطة"
          }
        />
      </label>
      <p className="muted">
        استخدم I وV وR وC (أو I_C وV_C للمكثف)، وR هي مقاومة ثيفينن في مسألة RC،
        والرمز τ أو tau، واكتب المشتقة dV/dt. التصحيح الآلي يتعرف على صيغ أوم
        وصيغ RC المحددة؛ لا يدّعي تصحيح اشتقاق جبري حر.
      </p>
      <label className="exam-writing">
        التعويض والحساب{" "}
        {kind === "dc" ? "للتيار بالأمبير" : "للثابت الزمني بالثانية"}
        <input
          maxLength={200}
          aria-label="حساب الطالب"
          dir="ltr"
          value={work}
          onChange={(e) => {
            setWork(e.target.value);
            setReport(null);
          }}
          placeholder="أعداد وعمليات + - * / ^ وأقواس؛ يمكن كتابة 1e-3"
        />
      </label>
      <div className="exam-inputs">
        {labels.map((label, i) => (
          <label key={label}>
            {label}
            <input
              type="number"
              step="any"
              aria-label={label}
              value={values[i]}
              onChange={(e) => {
                setValues((a) =>
                  a.map((v, j) => (i === j ? e.target.value : v)),
                );
                setReport(null);
              }}
            />
          </label>
        ))}
      </div>
      <button
        className="outline"
        onClick={() =>
          setReport(
            assessExam(c, { kind, selected, references, law, work, values }),
          )
        }
      >
        تصحيح الخطوات والإجابات
      </button>
      {report && (
        <div role="status">
          {report.error ? (
            <p className="wrong-answer">{report.error}</p>
          ) : (
            report.checks?.map((check, i) => (
              <p
                className={check.ok ? "correct-answer" : "wrong-answer"}
                key={i}
              >
                {check.ok ? "✓" : "✗"} {check.text}
              </p>
            ))
          )}
        </div>
      )}
      <button className="outline" onClick={onReveal}>
        {reveal ? "الحل ظاهر بطلبك" : "إظهار الحل والمنحنيات"}
      </button>
    </section>
  );
}

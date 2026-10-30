import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Zap,
  Sun,
  Moon,
  Play,
  RotateCw,
  Trash2,
  Save,
  FolderOpen,
  MousePointer2,
  Cable,
  Plus,
  Minus,
  BookOpen,
  ChevronLeft,
  CheckCircle2,
  Activity,
  Undo2,
} from "lucide-react";
import {
  solve,
  example,
  labels,
  terminal,
  type Circuit,
  type Kind,
  type Part,
  type Result,
} from "./solver";
import "./style.css";
const icons: Record<Kind, string> = {
  battery: "⊣",
  resistor: "▱",
  lamp: "⊗",
  switch: "⏚",
  ammeter: "Ⓐ",
  voltmeter: "Ⓥ",
};
function App() {
  const [c, setC] = useState<Circuit>(example),
    [selected, select] = useState<string>("R1"),
    [dark, setDark] = useState(true),
    [pending, setPending] = useState<string | null>(null),
    [mode, setMode] = useState(false),
    [result, setResult] = useState<Result | null>(null),
    [notice, setNotice] = useState(""),
    [lesson, setLesson] = useState(0),
    [zoom, setZoom] = useState(1);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const part = c.parts.find((p) => p.id === selected);
  const mutate = (v: Circuit) => {
    setC(v);
    setResult(null);
  };
  const edit = (p: Partial<Part>) =>
    mutate({
      ...c,
      parts: c.parts.map((x) => (x.id === selected ? { ...x, ...p } : x)),
    });
  const point = (e: React.PointerEvent) => {
    const matrix = svg.current!.getScreenCTM()!;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
  };
  const pos = (t: string) => {
    const [id, n] = t.split(":");
    const p = c.parts.find((p) => p.id === id)!;
    const angle = (p.rotation * Math.PI) / 180;
    const d = n === "0" ? -58 : 58;
    return { x: p.x + Math.cos(angle) * d, y: p.y + Math.sin(angle) * d };
  };
  const connect = (t: string) => {
    if (!pending) {
      setPending(t);
      return;
    }
    if (
      pending !== t &&
      !c.wires.some(
        (w) => (w.a === pending && w.b === t) || (w.b === pending && w.a === t),
      )
    )
      mutate({
        ...c,
        wires: [...c.wires, { id: crypto.randomUUID(), a: pending, b: t }],
      });
    setPending(null);
  };
  const load = (n: number) => {
    mutate(example(n));
    setLesson(n);
    select("R1");
    setPending(null);
  };
  const add = (kind: Kind) => {
    const id = crypto.randomUUID();
    mutate({
      ...c,
      parts: [
        ...c.parts,
        {
          id,
          kind,
          x: 250 + Math.random() * 400,
          y: 160 + Math.random() * 180,
          rotation: 0,
          value: kind === "battery" ? 12 : kind === "lamp" ? 60 : 100,
          closed: true,
        },
      ],
    });
    select(id);
  };
  const restore = (raw: string) => {
    try {
      const v = JSON.parse(raw);
      if (
        !Array.isArray(v.parts) ||
        !Array.isArray(v.wires) ||
        v.parts.length > 100 ||
        v.wires.length > 500
      )
        throw Error();
      const ids = new Set<string>();
      for (const p of v.parts) {
        if (
          typeof p.id !== "string" ||
          ids.has(p.id) ||
          !Object.hasOwn(labels, p.kind) ||
          !["x", "y", "rotation", "value"].every(
            (k) => typeof p[k] === "number" && Number.isFinite(p[k]),
          ) ||
          p.value <= 0 ||
          typeof p.closed !== "boolean"
        )
          throw Error();
        ids.add(p.id);
      }
      for (const w of v.wires)
        if (
          typeof w.id !== "string" ||
          ![w.a, w.b].every(
            (t) =>
              typeof t === "string" &&
              v.parts.some(
                (p: Part) => t === terminal(p.id, 0) || t === terminal(p.id, 1),
              ),
          )
        )
          throw Error();
      mutate(v);
      select("");
      setPending(null);
      setNotice("تم استرجاع الدارة بنجاح");
    } catch {
      setNotice("الملف غير صالح. اختر ملف دارة ElectroLab محفوظًا.");
    }
  };
  const save = () => {
    localStorage.setItem("electrolab", JSON.stringify(c));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(c)], { type: "application/json" }),
    );
    a.download = "electrolab-circuit.json";
    a.click();
    URL.revokeObjectURL(a.href);
    setNotice("تم حفظ الدارة محليًا وتنزيل نسخة JSON");
  };
  return (
    <div className={dark ? "app" : "app light"}>
      <header>
        <a className="brand" href="#">
          <span className="brand-icon">
            <Zap fill="currentColor" />
          </span>
          <span>
            ElectroLab <b>DZ</b>
            <small>مختبرك الكهربائي الافتراضي</small>
          </span>
        </a>
        <nav>
          <span className="active">المختبر</span>
          <button
            onClick={() =>
              document
                .getElementById("lessons")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            التجارب التعليمية
          </button>
        </nav>
        <div className="header-end">
          <span className="badge">النسخة التجريبية 01</span>
          <button title="تبديل المظهر" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <span className="avatar">ط</span>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">
              تعلّم بالتجربة <span> / </span> مختبر التيار المستمر
            </div>
            <h1>
              أفكارك، في دارة حيّة<span>.</span>
            </h1>
            <p>ركّب. وصّل. اكتشف. مساحة آمنة لتحويل النظرية إلى تجربة.</p>
          </div>
          <div className="intro-tag">
            <span className="dot" /> بيئة محاكاة DC{" "}
            <small>قانون أوم · قوانين كيرشوف</small>
          </div>
        </div>
        <div className="lab">
          <aside className="library">
            <div className="panel-title">
              <h3>مكتبة العناصر</h3>
              <span>06</span>
            </div>
            <p className="muted">اضغط لإضافة عنصر إلى المساحة</p>
            <div className="category">العناصر الأساسية</div>
            <div className="parts">
              {(Object.keys(labels) as Kind[]).map((k) => (
                <button className="part-card" key={k} onClick={() => add(k)}>
                  <span className={"part-icon " + k}>{icons[k]}</span>
                  <strong>{labels[k]}</strong>
                  <small>
                    {k === "battery"
                      ? "مصدر جهد DC"
                      : k === "resistor"
                        ? "تحكّم في التيار"
                        : k === "lamp"
                          ? "حمل مقاوم ثابت"
                          : k === "switch"
                            ? "فتح وإغلاق الدارة"
                            : k === "ammeter"
                              ? "قياس التيار"
                              : "قياس الجهد"}
                  </small>
                  <Plus size={12} />
                </button>
              ))}
            </div>
            <div className="tip">
              <Zap size={17} />
              <strong>كل توصيلة، فرصة للتعلّم</strong>
              <p>ابدأ ببطارية ومقاومة، وأكمل مسار التيار للعودة إلى المصدر.</p>
            </div>
          </aside>
          <section className="workspace">
            <div className="toolbar">
              <div>
                <span className="project-dot" />
                <strong>دارة التجربة {lesson + 1}</strong>
                <span className="muted project-label"> / مساحة العمل</span>
              </div>
              <div className="actions">
                <button title="حفظ وتنزيل" onClick={save}>
                  <Save size={17} />
                </button>
                <button
                  title="استرجاع ملف"
                  onClick={() => file.current?.click()}
                >
                  <FolderOpen size={17} />
                </button>
                <button
                  title="استرجاع آخر حفظ محلي"
                  onClick={() => {
                    const s = localStorage.getItem("electrolab");
                    s ? restore(s) : setNotice("لا توجد دارة محفوظة محليًا");
                  }}
                >
                  <Undo2 size={17} />
                </button>
                <i />
                <button
                  className="run"
                  onClick={() => {
                    setResult(solve(c));
                    setPending(null);
                  }}
                >
                  <Play size={15} fill="currentColor" /> تشغيل المحاكاة
                </button>
              </div>
            </div>
            <div className="canvas">
              <div className="canvas-top">
                <span>
                  <span className="dot" />{" "}
                  {result ? "نتائج المحاكاة" : "جاهز للتوصيل"}
                </span>
                <span>DC LAB / 01</span>
              </div>
              <div className="tools">
                <button
                  className={!mode ? "chosen" : ""}
                  title="تحريك وتحديد"
                  onClick={() => {
                    setMode(false);
                    setPending(null);
                  }}
                >
                  <MousePointer2 size={19} />
                </button>
                <button
                  className={mode ? "chosen" : ""}
                  title="توصيل الأسلاك"
                  onClick={() => setMode(!mode)}
                >
                  <Cable size={19} />
                </button>
              </div>
              <svg
                ref={svg}
                viewBox={`0 0 ${960 / zoom} ${490 / zoom}`}
                onPointerMove={(e) => {
                  if (drag.current) {
                    const p = point(e);
                    const d = drag.current;
                    mutate({
                      ...c,
                      parts: c.parts.map((x) =>
                        x.id === d.id
                          ? {
                              ...x,
                              x: Math.max(65, Math.min(890, p.x - d.dx)),
                              y: Math.max(65, Math.min(420, p.y - d.dy)),
                            }
                          : x,
                      ),
                    });
                  }
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setPending(null);
                    drag.current = null;
                  }
                }}
                tabIndex={0}
              >
                {c.wires.map((w) => {
                  const a = pos(w.a),
                    b = pos(w.b);
                  return (
                    <g key={w.id} className="wire" onClick={() => select(w.id)}>
                      <path
                        className="wire-hit"
                        d={
                          Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) > 150
                            ? `M ${a.x} ${a.y} V ${Math.min(445, a.y + 115)} H ${b.x} V ${b.y}`
                            : `M ${a.x} ${a.y} H ${(a.x + b.x) / 2} V ${b.y} H ${b.x}`
                        }
                      />
                      <path
                        className={selected === w.id ? "selected-wire" : ""}
                        d={
                          Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) > 150
                            ? `M ${a.x} ${a.y} V ${Math.min(445, a.y + 115)} H ${b.x} V ${b.y}`
                            : `M ${a.x} ${a.y} H ${(a.x + b.x) / 2} V ${b.y} H ${b.x}`
                        }
                      />
                    </g>
                  );
                })}
                {c.parts.map((p, i) => (
                  <g key={p.id} transform={`translate(${p.x},${p.y})`}>
                    <g transform={`rotate(${p.rotation})`}>
                      <rect
                        className={
                          selected === p.id ? "component selected" : "component"
                        }
                        x="-43"
                        y="-29"
                        width="86"
                        height="58"
                        rx="10"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          select(p.id);
                          if (mode) return;
                          const v = point(e);
                          drag.current = {
                            id: p.id,
                            dx: v.x - p.x,
                            dy: v.y - p.y,
                          };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                      />
                      <text
                        className={
                          "symbol " +
                          (p.kind === "lamp" &&
                          (result?.values[p.id]?.power ?? 0) > 0
                            ? "lit"
                            : "")
                        }
                        textAnchor="middle"
                        y="9"
                        pointerEvents="none"
                      >
                        {p.kind === "switch"
                          ? p.closed
                            ? "⏤"
                            : "⤴"
                          : icons[p.kind]}
                      </text>
                      {[0, 1].map((n) => (
                        <g
                          key={n}
                          className="terminal"
                          onClick={(e) => {
                            e.stopPropagation();
                            connect(terminal(p.id, n));
                          }}
                        >
                          <line
                            x1={n === 0 ? -43 : 43}
                            y1="0"
                            x2={n === 0 ? -58 : 58}
                            y2="0"
                          />
                          <circle
                            className={
                              pending === terminal(p.id, n) ? "pending" : ""
                            }
                            cx={n === 0 ? -58 : 58}
                            cy="0"
                            r="7"
                          />
                          <circle
                            className="terminal-hit"
                            cx={n === 0 ? -58 : 58}
                            cy="0"
                            r="14"
                          />
                        </g>
                      ))}
                    </g>
                    <text className="component-name" textAnchor="middle" y="54">
                      {labels[p.kind]} {i + 1}
                    </text>
                    <text
                      className="component-value"
                      textAnchor="middle"
                      y="73"
                    >
                      {p.kind === "battery"
                        ? `${p.value} V`
                        : p.kind === "resistor" || p.kind === "lamp"
                          ? `${p.value} Ω`
                          : p.kind === "switch"
                            ? p.closed
                              ? "مغلق"
                              : "مفتوح"
                            : p.kind === "ammeter"
                              ? "0.001 Ω"
                              : "مثالي"}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="canvas-bottom">
                <span>
                  {pending
                    ? "اختر الطرف الثاني لإكمال السلك"
                    : "اسحب العناصر لتحريكها · اضغط طرفين لتوصيل سلك"}
                </span>
                <div>
                  <button
                    title="تصغير"
                    onClick={() => setZoom(Math.max(0.7, zoom - 0.1))}
                  >
                    <Minus size={14} />
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    title="تكبير"
                    onClick={() => setZoom(Math.min(1.3, zoom + 0.1))}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="results">
              <div className="panel-title">
                <h3>
                  <Activity size={17} /> قراءات الدارة
                </h3>
                <span className="muted">
                  {result ? "محسوبة فعليًا" : "شغّل المحاكاة لعرض النتائج"}
                </span>
              </div>
              <div className="metrics">
                {[
                  ["الجهد", "V", part && result?.values[part.id]?.voltage],
                  ["التيار", "A", part && result?.values[part.id]?.current],
                  ["القدرة", "W", part && result?.values[part.id]?.power],
                ].map(([name, unit, v]) => (
                  <div key={String(name)}>
                    <span>{name}</span>
                    <strong dir="ltr">
                      {typeof v === "number" && Number.isFinite(v)
                        ? Number(v.toPrecision(5))
                        : "—"}{" "}
                      <small>{unit}</small>
                    </strong>
                  </div>
                ))}
              </div>
              <p className={result?.error ? "message error" : "message"}>
                {result?.error ||
                  result?.warning ||
                  (result
                    ? "تم حل الدارة بنجاح. القراءات للعنصر المحدد؛ إشارة القدرة السالبة تعني تزويد الطاقة."
                    : "اختر عنصرًا لعرض الجهد بين طرفيه، والتيار والقدرة فيه.")}
              </p>
            </div>
          </section>
          <aside className="inspector">
            <div className="panel-title">
              <h3>خصائص العنصر</h3>
              <span>⚙</span>
            </div>
            {part ? (
              <>
                <div className="selected-info">
                  <span className="big-symbol">{icons[part.kind]}</span>
                  <h3>{labels[part.kind]}</h3>
                  <small>عنصر محدد في مساحة العمل</small>
                </div>
                {["battery", "resistor", "lamp"].includes(part.kind) && (
                  <label>
                    {" "}
                    {part.kind === "battery"
                      ? "الجهد الكهربائي"
                      : "المقاومة الكهربائية"}{" "}
                    <span>{part.kind === "battery" ? "V" : "Ω"}</span>
                    <input
                      type="number"
                      min="0.001"
                      max="1000000000"
                      value={part.value}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && v <= 1e9) edit({ value: v });
                      }}
                    />
                  </label>
                )}
                {part.kind === "switch" && (
                  <button
                    className="outline"
                    onClick={() => edit({ closed: !part.closed })}
                  >
                    {part.closed ? "فتح المفتاح" : "إغلاق المفتاح"}
                  </button>
                )}
                <div className="edit-actions">
                  <button
                    onClick={() =>
                      edit({ rotation: (part.rotation + 90) % 360 })
                    }
                  >
                    <RotateCw size={16} /> تدوير
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      mutate({
                        parts: c.parts.filter((p) => p.id !== selected),
                        wires: c.wires.filter(
                          (w) =>
                            !w.a.startsWith(selected + ":") &&
                            !w.b.startsWith(selected + ":"),
                        ),
                      });
                      select("");
                      setPending(null);
                    }}
                  >
                    <Trash2 size={16} /> حذف
                  </button>
                </div>
                <div className="info-box">
                  <strong>معلومة سريعة</strong>
                  <p>
                    {part.kind === "resistor"
                      ? "وفق قانون أوم، عند ثبات الجهد، تقل شدة التيار كلما زادت المقاومة."
                      : part.kind === "ammeter"
                        ? "يوصل على التوالي. نحاكي مقاومة داخلية صغيرة مقدارها 0.001 أوم."
                        : part.kind === "voltmeter"
                          ? "يوصل على التوازي. الجهاز مثالي ولا يسحب تيارًا."
                          : part.kind === "lamp"
                            ? "المصباح نموذج مقاومة ثابتة؛ لا يحاكي تغيّر المقاومة مع الحرارة."
                            : "الطرف الأيسر هو المرجع الموجب للجهد والتيار. جرّب تغيير التوصيلات ولاحظ النتائج."}
                  </p>
                  <code>V = I × R</code>
                </div>
              </>
            ) : (
              <p className="muted">
                اختر عنصرًا لتعديل خصائصه، أو اختر سلكًا لحذفه.
              </p>
            )}
            {c.wires.some((w) => w.id === selected) && (
              <button
                className="outline danger"
                onClick={() => {
                  mutate({
                    ...c,
                    wires: c.wires.filter((w) => w.id !== selected),
                  });
                  select("");
                }}
              >
                حذف السلك المحدد
              </button>
            )}
            <div className="check">
              <CheckCircle2 size={16} />
              <span>
                محاكاة محلية بالكامل<small>دون حساب أو اتصال بخادم</small>
              </span>
            </div>
          </aside>
        </div>
        <section id="lessons" className="lessons">
          <div className="section-heading">
            <div>
              <h2>
                <BookOpen size={20} /> جرّب، ثم افهم
              </h2>
              <p>تجارب قصيرة تبني فهمًا أعمق للدوائر الكهربائية.</p>
            </div>
            <span>03 تجارب تفاعلية</span>
          </div>
          <div className="lesson-grid">
            {["دارة التوالي", "دارة التوازي", "إضاءة مصباح"].map((name, n) => (
              <button
                className={lesson === n ? "lesson current" : "lesson"}
                key={name}
                onClick={() => load(n)}
              >
                <span className="lesson-number">0{n + 1}</span>
                <div>
                  <small>تجربة {n === 0 ? "أساسية" : "تطبيقية"} · DC</small>
                  <h3>{name}</h3>
                  <p>
                    {n === 0
                      ? "احسب التيار عند 12V ومقاومتين 100Ω و200Ω."
                      : n === 1
                        ? "قارن تياري الفرعين. لماذا يبقى الجهد نفسه؟"
                        : "غيّر مقاومة المصباح ولاحظ أثرها على القدرة."}
                  </p>
                </div>
                <ChevronLeft size={18} />
              </button>
            ))}
          </div>
          <p className="exercise">
            هدف التجربة:{" "}
            {lesson === 0
              ? "تحقق من تيار 0.04A وجهدين 4V و8V."
              : lesson === 1
                ? "تحقق من 0.12A و0.06A، وتيار كلي 0.18A."
                : "عند 60Ω، هل تحصل على قدرة مصباح 0.3375W؟"}{" "}
            تحميل تجربة يستبدل الدارة الحالية؛ احفظ عملك أولًا.
          </p>
        </section>
        <footer>
          <span>
            ElectroLab DZ <span> / </span> صُمّم لفضولك الهندسي.
          </span>
          <span>مختبر تعليمي • التيار المستمر فقط</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status" onClick={() => setNotice("")}>
          {notice} <button aria-label="إغلاق">×</button>
        </div>
      )}
      <input
        hidden
        type="file"
        accept=".json,application/json"
        ref={file}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) restore(await f.text());
          e.target.value = "";
        }}
      />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

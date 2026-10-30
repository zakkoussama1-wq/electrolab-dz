import { terminalPosition, wirePath } from "./connectivity";
import { ExerciseOne, ConnectionDiagnostics } from "./ExerciseOne";
import React, { useState, useRef, useEffect, useMemo } from "react";
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
import { Education, type Highlight } from "./Education";
import { reading, ref, topology } from "./analysis";
import { Glyph } from "./Glyph";
import { nodeName } from "./symbols";
import { MathFormula } from "./MathFormula";
import { RCLab } from "./RCLab";
import { rcExample, capUnits, rcSignature } from "./rc";
import { classifyCircuit, freePlacement } from "./unified";
import { CircuitInspection, type Inspection } from "./CircuitInspection";
import { UnifiedExam } from "./UnifiedExam";
import { CourseProgressPage, AboutPage, CreatorFooter } from "./CoursePages";
const icons: Record<Kind, string> = {
  capacitor: "⊣⊢",
  battery: "⊣",
  resistor: "▱",
  lamp: "⊗",
  switch: "⏚",
  ammeter: "Ⓐ",
  voltmeter: "Ⓥ",
};
function App() {
  const readPage = () =>
    window.location.hash === "#progress"
      ? "progress"
      : window.location.hash === "#about"
        ? "about"
        : "lab";
  const [page, setPage] = useState(readPage);
  useEffect(() => {
    const change = () => setPage(readPage());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const goPage = (next: "lab" | "progress" | "about") => {
    window.location.hash = next;
    setPage(next);
  };
  const [examMode, setExamMode] = useState(false);
  const [reveal, setReveal] = useState(false);
  const concealed = examMode && !reveal;
  const [rcFocus, setRCFocus] = useState<Inspection | null>(null);
  const [rcPlaying, setRCPlaying] = useState(false);
  const [rcCompare, setRCCompare] = useState(false);
  const [rcCommand, setRCCommand] = useState(0);
  const [rcReset, setRCReset] = useState(0);

  const [c, setC] = useState<Circuit>(example),
    [selected, select] = useState<string>("R1"),
    [dark, setDark] = useState(true),
    [pending, setPending] = useState<string | null>(null),
    [mode, setMode] = useState(false),
    [result, setResult] = useState<Result | null>(null),
    [notice, setNotice] = useState(""),
    [lesson, setLesson] = useState(0),
    [zoom, setZoom] = useState(1);
  const [highlight, setHighlight] = useState<Highlight>({
    parts: [],
    terminals: [],
  });
  const signature = rcSignature(c);
  const classification = useMemo(() => classifyCircuit(c), [signature]);
  const lab = c.parts.some((p) => p.kind === "capacitor") ? "rc" : "dc";
  const structure = topology(c);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (lab === "rc" && !rcPlaying) svg.current?.pauseAnimations();
    else svg.current?.unpauseAnimations();
  }, [lab, rcPlaying]);
  const part = c.parts.find((p) => p.id === selected);
  const mutate = (v: Circuit) => {
    setC(v);
    setResult(null);
    setHighlight({ parts: [], terminals: [] });
    setRCFocus(null);
  };
  const loadRC = (v: Circuit, compare = false) => {
    setRCCompare(compare);
    mutate(v);
    setRCReset((n) => n + 1);
    select(v.parts.find((p) => p.kind === "capacitor")?.id ?? "");
    setPending(null);
  };
  const edit = (p: Partial<Part>) =>
    mutate({
      ...c,
      parts: c.parts.map((x) => (x.id === selected ? { ...x, ...p } : x)),
    });
  const reverse = (key: "voltageRef" | "currentRef", id = selected) =>
    setC({
      ...c,
      parts: c.parts.map((p) =>
        p.id === id ? { ...p, [key]: -ref(p[key]) } : p,
      ),
    });
  const point = (e: React.PointerEvent) => {
    const matrix = svg.current!.getScreenCTM()!;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
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
    setRCCompare(false);
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
          ...freePlacement(c),
          rotation: 0,
          value:
            kind === "capacitor"
              ? 0.001
              : kind === "battery"
                ? 12
                : kind === "lamp"
                  ? 60
                  : 100,
          ...(kind === "capacitor"
            ? { initialVoltage: 0, capUnit: "µF" as const }
            : {}),
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
          (p.initialVoltage !== undefined &&
            !Number.isFinite(p.initialVoltage)) ||
          (p.capUnit !== undefined && !Object.hasOwn(capUnits, p.capUnit)) ||
          (p.voltageRef !== undefined &&
            p.voltageRef !== 1 &&
            p.voltageRef !== -1) ||
          (p.currentRef !== undefined &&
            p.currentRef !== 1 &&
            p.currentRef !== -1) ||
          (p.label !== undefined && (typeof p.label !== "string" || !/^[A-Za-z][0-9]+$/.test(p.label))) ||
          (p.terminalLabels !== undefined && (!Array.isArray(p.terminalLabels) || p.terminalLabels.length !== 2 || !p.terminalLabels.every((x: unknown) => typeof x === "string" && /^[A-Za-z0-9]{0,8}$/.test(x)))) ||
          typeof p.closed !== "boolean"
        )
          throw Error();
        ids.add(p.id);
      }
      if (v.nodeNames !== undefined && (typeof v.nodeNames !== "object" || !v.nodeNames || Array.isArray(v.nodeNames) || Object.entries(v.nodeNames).some(([t,name])=>!v.parts.some((p:Part)=>[terminal(p.id,0),terminal(p.id,1)].includes(t)) || typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,7}$/.test(name)))) throw Error();
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
      setRCReset((n) => n + 1);
      select("");
      setPending(null);
      setNotice("تم استرجاع الدارة بنجاح");
    } catch {
      setNotice("الملف غير صالح. اختر ملف دارة ElectroLab محفوظًا.");
    }
  };
  const save = () => {
    localStorage.setItem("electrolab-unified", JSON.stringify(c));
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
          <span className="active">المختبر الموحد</span>
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
      <nav className="course-nav" aria-label="صفحات الموقع">
        <button
          className={page === "lab" ? "active" : ""}
          onClick={() => goPage("lab")}
        >
          المختبر
        </button>
        <button
          className={page === "progress" ? "active" : ""}
          onClick={() => goPage("progress")}
        >
          تقدم تطوير المختبر
        </button>
        <button
          className={page === "about" ? "active" : ""}
          onClick={() => goPage("about")}
        >
          حول المختبر
        </button>
      </nav>
      <main>
        <div hidden={page !== "lab"}>
          <p className="course-notice">
            تدقيق المقرر قيد المراجعة: التجارب القديمة أدناه أمثلة عامة، وليست
            تمارين PDF معتمدة. راجع صفحة التقدم للحالات الفعلية.
          </p>
          <div className="intro">
            <div>
              <div className="eyebrow">
                تعلّم بالتجربة <span> / </span> مساحة واحدة · تحليل تلقائي DC
                وRC
              </div>
              <h1>
                أفكارك، في دارة حيّة<span>.</span>
              </h1>
              <p>ركّب. وصّل. اكتشف. مساحة آمنة لتحويل النظرية إلى تجربة.</p>
            </div>
            <div className="intro-tag">
              <span className="dot" /> بيئة محاكاة {lab === "rc" ? "RC" : "DC"}{" "}
              <small>
                {lab === "rc"
                  ? "شحن · تفريغ · استجابة زمنية"
                  : "قانون أوم · قوانين كيرشوف"}
              </small>
            </div>
          </div>
          <div className="unified-mode rc-tabs">
            <button
              className={!examMode ? "active" : ""}
              onClick={() => {
                setExamMode(false);
                setReveal(false);
              }}
            >
              وضع التعلم
            </button>
            <button
              className={examMode ? "active" : ""}
              onClick={() => {
                setExamMode(true);
                setReveal(false);
                setResult(null);
                setRCPlaying(false);
                setRCCommand(0);
                setRCReset((n) => n + 1);
              }}
            >
              وضع الامتحان
            </button>
            <span>ارسم بحرية؛ نوع التحليل يُستنتج من الدارة.</span>
            <button
              className="outline"
              onClick={() => loadRC({ parts: [], wires: [] })}
            >
              دارة جديدة فارغة
            </button>
          </div>
          <div className="classification" role="status">
            <strong>
              {classification.mode === "dc"
                ? "تحليل DC"
                : classification.mode === "rc"
                  ? "تحليل زمني RC"
                  : "دارة غير مدعومة"}
            </strong>
            <span>{classification.reason}</span>
          </div>
          <div className="lab">
            <aside className="library">
              <div className="panel-title">
                <h3>مكتبة العناصر</h3>
                <span>07</span>
              </div>
              <p className="muted">اضغط لإضافة عنصر إلى المساحة</p>
              <div className="category">العناصر الأساسية</div>
              <div className="parts">
                {(Object.keys(labels) as Kind[]).map((k) => (
                  <button className="part-card" key={k} onClick={() => add(k)}>
                    <span className={"part-icon " + k}>{icons[k]}</span>
                    <strong>{labels[k]}</strong>
                    <small>
                      {k === "capacitor"
                        ? "تخزين الشحنة"
                        : k === "battery"
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
                <p>
                  ابدأ ببطارية ومقاومة، وأكمل مسار التيار للعودة إلى المصدر.
                </p>
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
                      const s = localStorage.getItem("electrolab-unified");
                      s ? restore(s) : setNotice("لا توجد دارة محفوظة محليًا");
                    }}
                  >
                    <Undo2 size={17} />
                  </button>
                  <i />
                  <button
                    className="run"
                    onClick={() => {
                      if (concealed) {
                        setNotice(
                          "الامتحان: اطلب إظهار الحل أو صحح إجاباتك أولًا.",
                        );
                        return;
                      }
                      if (lab === "rc") setRCCommand((n) => n + 1);
                      else setResult(solve(c));
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
                  <span>{lab === "rc" ? "RC LAB / 02" : "DC LAB / 01"}</span>
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
                    const pin = (t:string) => {const i=t.lastIndexOf(':');return {p:c.parts.find(p=>p.id===t.slice(0,i))!,n:Number(t.slice(i+1))};};
                    const a=pin(w.a), b=pin(w.b);
                    const path = a.p && b.p ? wirePath(a.p,a.n,b.p,b.n) : '';
                    return (
                      <g
                        key={w.id}
                        className="wire"
                        onClick={() => select(w.id)}
                      >
                        <path
                          className="wire-hit"
                          d={path}
                        />
                        <path
                          className={
                            selected === w.id
                              ? "selected-wire"
                              : highlight.terminals.includes(w.a) ||
                                  highlight.terminals.includes(w.b) ||
                                  highlight.parts.some(
                                    (id) =>
                                      w.a.startsWith(id + ":") ||
                                      w.b.startsWith(id + ":"),
                                  )
                                ? "highlight-wire"
                                : ""
                          }
                          d={path}
                        />
                      </g>
                    );
                  })}
                  {c.parts.map((p, i) => (
                    <g key={p.id} transform={`translate(${p.x},${p.y})`}>
                      <g transform={`rotate(${p.rotation})`}>
                        <rect
                          className={
                            highlight.parts.includes(p.id)
                              ? "component highlighted"
                              : selected === p.id
                                ? "component selected"
                                : "component"
                          }
                          x="-43"
                          y="-29"
                          width="86"
                          height="58"
                          rx="10"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            select(p.id);
                            setRCFocus({ kind: "part", id: p.id });
                            setHighlight({ parts: [p.id], terminals: [] });
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
                        <Glyph
                          p={p}
                          lit={
                            p.kind === "lamp" &&
                            (result?.values[p.id]?.power ?? 0) > 0
                          }
                        />
                        <g
                          className="reference-current"
                          role="button"
                          tabIndex={0}
                          aria-label={`عكس تيار العنصر ${i + 1}`}
                          onClick={() => reverse("currentRef", p.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") reverse("currentRef", p.id);
                          }}
                        >
                          <path
                            d={
                              ref(p.currentRef) === 1
                                ? "M-27 -43 H27 L20 -48 M27 -43 L20 -38"
                                : "M27 -43 H-27 L-20 -48 M-27 -43 L-20 -38"
                            }
                          />
                          <text textAnchor="middle" y="-52">
                            I
                            <tspan baselineShift="sub" fontSize="9">
                              {i + 1}
                            </tspan>
                          </text>
                          <rect
                            x="-35"
                            y="-66"
                            width="70"
                            height="32"
                            fill="transparent"
                            stroke="none"
                          />
                        </g>
                        {[0, 1].map((n) => (
                          <text
                            key={`pol${n}`}
                            className="reference-pole"
                            x={n === 0 ? -51 : 51}
                            y="-17"
                            textAnchor="middle"
                            role="button"
                            tabIndex={0}
                            aria-label={`عكس قطبية العنصر ${i + 1}`}
                            onClick={() => reverse("voltageRef", p.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                reverse("voltageRef", p.id);
                            }}
                          >
                            {(n === 0 ? 1 : -1) * ref(p.voltageRef) === 1
                              ? "+"
                              : "−"}
                          </text>
                        ))}
                        {result &&
                          !result.error &&
                          Math.abs(result.values[p.id]?.current ?? 0) >
                            1e-10 && (
                            <circle className="current-particle" r="3">
                              <animateMotion
                                dur="1.3s"
                                repeatCount="indefinite"
                                path={
                                  result.values[p.id].current > 0
                                    ? "M-38 23 H38"
                                    : "M38 23 H-38"
                                }
                              />
                            </circle>
                          )}
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
                                highlight.terminals.includes(terminal(p.id, n))
                                  ? "highlight-terminal"
                                  : pending === terminal(p.id, n)
                                    ? "pending"
                                    : ""
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
                      {p.terminalLabels?.map((label,n)=>{const v=terminalPosition({...p,x:0,y:0},n);return label ? <text key={n} className="node-label" x={v.x-14} y={v.y-8}>{label}</text> : null;})}
                      <text
                        className="component-name"
                        textAnchor={Math.abs(Math.sin(p.rotation*Math.PI/180)) > .7 ? "end" : "middle"}
                        x={Math.abs(Math.sin(p.rotation*Math.PI/180)) > .7 ? -35 : 0}
                        y={Math.abs(Math.sin(p.rotation*Math.PI/180)) > .7 ? 0 : 54}
                      >
                        {p.label ?? `${labels[p.kind]} ${i + 1}`} ·{" "}
                        {[0, 1].map((n, ni) => {
                          const id = structure.nodeOf[terminal(p.id, n)],
                            node = structure.nodes.find((x) => x.id === id)!;
                          return (
                            <tspan
                              key={n}
                              className="node-label"
                              role="button"
                              tabIndex={0}
                              aria-label={`إبراز العقدة ${(node?.name ?? nodeName(structure.nodes.indexOf(node)))}`}
                              onClick={() =>
                                setHighlight({
                                  parts: [],
                                  terminals: node.terminals,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  setHighlight({
                                    parts: [],
                                    terminals: node.terminals,
                                  });
                              }}
                            >
                              {ni ? " – " : ""}
                              {(node?.name ?? nodeName(structure.nodes.indexOf(node)))}
                            </tspan>
                          );
                        })}
                      </text>
                      <text
                        className="component-value"
                        textAnchor={Math.abs(Math.sin(p.rotation*Math.PI/180)) > .7 ? "end" : "middle"}
                        x={Math.abs(Math.sin(p.rotation*Math.PI/180)) > .7 ? -35 : 0}
                        y={Math.abs(Math.sin(p.rotation*Math.PI/180)) > .7 ? 19 : 73}
                      >
                        {p.kind === "capacitor"
                          ? `${Number((p.value / capUnits[p.capUnit ?? "µF"]).toPrecision(8))} ${p.capUnit ?? "µF"}`
                          : p.kind === "battery"
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
                    [
                      "الجهد",
                      "V",
                      part && result && reading(part, result)?.voltage,
                    ],
                    [
                      "التيار",
                      "A",
                      part && result && reading(part, result)?.current,
                    ],
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
                  {part.kind === "capacitor" && (
                    <>
                      <label>
                        السعة
                        <input
                          aria-label="سعة المكثف"
                          type="number"
                          min="0.000001"
                          step="any"
                          value={Number(
                            (
                              part.value / capUnits[part.capUnit ?? "µF"]
                            ).toPrecision(10),
                          )}
                          onChange={(e) => {
                            const v =
                              Number(e.target.value) *
                              capUnits[part.capUnit ?? "µF"];
                            if (v > 0 && v <= 100 && Number.isFinite(v))
                              edit({ value: v });
                          }}
                        />
                        <select
                          aria-label="وحدة السعة"
                          value={part.capUnit ?? "µF"}
                          onChange={(e) =>
                            edit({ capUnit: e.target.value as Part["capUnit"] })
                          }
                        >
                          {Object.keys(capUnits).map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        الجهد الابتدائي (V)
                        <input
                          aria-label="الجهد الابتدائي"
                          type="number"
                          step="any"
                          value={part.initialVoltage ?? 0}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v) && Math.abs(v) <= 1e6)
                              edit({ initialVoltage: v });
                          }}
                        />
                      </label>
                      <p className="muted">
                        الجهد الابتدائي من الطرف الأول (+ في الوضع الأصلي) إلى
                        الثاني؛ عكس مرجع العرض لا يغير الحالة الفيزيائية.
                      </p>
                    </>
                  )}
                  {part.kind === "switch" && (
                    <button
                      className="outline"
                      onClick={() => edit({ closed: !part.closed })}
                    >
                      {part.closed ? "فتح المفتاح" : "إغلاق المفتاح"}
                    </button>
                  )}
                  <div className="reference-controls">
                    <button onClick={() => reverse("currentRef")}>
                      عكس سهم التيار المرجعي
                    </button>
                    <button onClick={() => reverse("voltageRef")}>
                      عكس قطبية الجهد المرجعي
                    </button>
                    <p>
                      السهم اتجاه مفترض؛ التيار السالب يسري عكسه. عكس المرجع لا
                      يغيّر التوصيل.{" "}
                      {part.kind === "battery"
                        ? "أقطاب البطارية الفيزيائية ثابتة (+ عند الطرف 0)، أما العلامتان خارج الرمز فمرجع قياس قابل للعكس."
                        : "علامتا + و− تحددان مرجع الجهد، وليستا شحنتين ثابتتين."}
                    </p>
                  </div>
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
                      {part.kind === "capacitor"
                        ? "المكثف يخزن شحنة وطاقة. فتح المفتاح يعزله ولا يفرغه دون مسار مقاوم."
                        : part.kind === "resistor"
                          ? "وفق قانون أوم، عند ثبات الجهد، تقل شدة التيار كلما زادت المقاومة."
                          : part.kind === "ammeter"
                            ? "يوصل على التوالي. نحاكي مقاومة داخلية صغيرة مقدارها 0.001 أوم."
                            : part.kind === "voltmeter"
                              ? "يوصل على التوازي. الجهاز مثالي ولا يسحب تيارًا."
                              : part.kind === "lamp"
                                ? "المصباح نموذج مقاومة ثابتة؛ لا يحاكي تغيّر المقاومة مع الحرارة."
                                : "الطرف الأيسر هو المرجع الموجب للجهد والتيار. جرّب تغيير التوصيلات ولاحظ النتائج."}
                    </p>
                    <MathFormula
                      tex={
                        ["resistor", "lamp", "ammeter"].includes(part.kind)
                          ? `V_{${c.parts.indexOf(part) + 1}}=${ref(part.currentRef) * ref(part.voltageRef) < 0 ? "-" : ""}R_{${c.parts.indexOf(part) + 1}} I_{${c.parts.indexOf(part) + 1}}`
                          : `P_{${c.parts.indexOf(part) + 1}}=${ref(part.currentRef) * ref(part.voltageRef) < 0 ? "-" : ""}V_{${c.parts.indexOf(part) + 1}} I_{${c.parts.indexOf(part) + 1}}`
                      }
                    />
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
          <ConnectionDiagnostics c={c} result={result} highlight={setHighlight} />
          <ExerciseOne c={c} result={result} load={(v)=>{loadRC(v);select("R1");}} highlight={setHighlight} concealed={concealed} />
          {examMode && (
            <UnifiedExam
              c={c}
              selected={selected}
              reveal={reveal}
              onReveal={() => {
                setReveal(true);
                if (lab === "dc") setResult(solve(c));
              }}
            />
          )}
          {!concealed && lab === "rc" && (
            <CircuitInspection
              c={c}
              result={result}
              selected={selected}
              select={select}
              highlight={setHighlight}
              onInspect={setRCFocus}
            />
          )}
          {!concealed &&
            (lab === "rc" ? (
              <RCLab
                c={c}
                command={rcCommand}
                resetToken={rcReset}
                onResult={setResult}
                onRunning={setRCPlaying}
                highlight={setHighlight}
                load={loadRC}
                embedded
                compareRequested={rcCompare}
                inspection={rcFocus}
                selected={selected}
              />
            ) : (
              <Education
                key={JSON.stringify(c)}
                c={c}
                result={result}
                selected={selected}
                select={select}
                highlight={setHighlight}
                currentHighlight={highlight}
              />
            ))}
          <section id="lessons" className="lessons">
            <div className="section-heading">
              <div>
                <h2>
                  <BookOpen size={20} /> جرّب، ثم افهم
                </h2>
                <p>تجارب قصيرة تبني فهمًا أعمق للدوائر الكهربائية.</p>
              </div>
              <span>08 تجارب تفاعلية</span>
            </div>
            <div className="lesson-grid">
              {["دارة التوالي", "دارة التوازي", "إضاءة مصباح"].map(
                (name, n) => (
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
                ),
              )}
            </div>
            <div className="lesson-grid">
              {[
                "شحن مكثف غير مشحون",
                "تفريغ عبر مقاومة",
                "تأثير زيادة المقاومة",
                "تأثير زيادة السعة",
                "مقارنة التحليل والتكامل العددي",
              ].map((name, i) => (
                <button
                  key={name}
                  className="lesson"
                  onClick={() => loadRC(rcExample(i), i === 4)}
                >
                  <span className="lesson-number">0{i + 4}</span>
                  <div>
                    <small>استجابة زمنية RC</small>
                    <h3>{name}</h3>
                    <p>
                      تحميل الدارة يختار التحليل الزمني تلقائيًا. احفظ عملك
                      أولًا.
                    </p>
                  </div>
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
          <div className="legacy-saves">
            <span>استرجاع حفظ سابق:</span>
            {[
              ["electrolab", "دارة DC السابقة"],
              ["electrolab-rc", "دارة RC السابقة"],
            ].map(([key, label]) => (
              <button
                className="outline"
                key={key}
                onClick={() => {
                  const raw = localStorage.getItem(key);
                  raw ? restore(raw) : setNotice("لا يوجد حفظ سابق لهذا النوع");
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {page === "progress" && <CourseProgressPage />}
        {page === "about" && <AboutPage />}
        <CreatorFooter />
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

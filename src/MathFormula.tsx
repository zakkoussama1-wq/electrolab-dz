import { blackboardTex } from "./blackboard";
import { useMemo, useRef, useEffect, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { plainTex, type SymbolLink } from "./symbols";
export function MathFormula({
  tex,
  links = [],
  active = [],
  onSymbol,
}: {
  tex: string;
  links?: SymbolLink[];
  active?: string[];
  onSymbol?: (link: SymbolLink) => void;
}) {
  const [copyLabel, setCopyLabel] = useState("نسخ المعادلة");
  useEffect(() => setCopyLabel("نسخ المعادلة"), [tex]);
  const root = useRef<HTMLDivElement>(null);
  const [html, error] = useMemo(() => {
    try {
      return [
        katex.renderToString(blackboardTex(tex), {
          displayMode: true,
          throwOnError: true,
          output: "htmlAndMathml",
          strict: "ignore",
          trust: (context) => context.command === "\\htmlData",
        }),
        false,
      ] as const;
    } catch {
      return ["", true] as const;
    }
  }, [tex]);
  useEffect(() => {
    root.current
      ?.querySelectorAll<HTMLElement>("[data-symbol]")
      .forEach((el) => {
        const key = el.dataset.symbol!,
          link = links.find((l) => l.key === key);
        el.classList.toggle("symbol-active", active.includes(key));
        if (link && onSymbol) {
          el.tabIndex = 0;
          el.setAttribute("role", "button");
          el.setAttribute("aria-label", `إبراز ${link.label}`);
        }
      });
  }, [html, links, active, onSymbol]);
  function activate(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const el = target.closest<HTMLElement>("[data-symbol]");
    const link = links.find((l) => l.key === el?.dataset.symbol);
    if (link) onSymbol?.(link);
  }
  return (
    <div className="formula-block">
      <div
        className="math-display"
        ref={root}
        dir="ltr"
        onClick={(e) => activate(e.target)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate(e.target);
          }
        }}
      >
        {error ? (
          <span role="alert">تعذر عرض المعادلة. أعد اختيار القانون.</span>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
      <button
        className="copy-equation"
        onClick={async (e) => {
          try {
            await navigator.clipboard.writeText(plainTex(tex));
            setCopyLabel("نُسخت المعادلة");
          } catch {
            setCopyLabel("تعذر النسخ؛ حدّد المعادلة وانسخها");
          }
        }}
      >
        {copyLabel}
      </button>
    </div>
  );
}

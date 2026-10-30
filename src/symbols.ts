import { type Circuit } from "./solver";
import { topology } from "./analysis";
export type Focus = { parts: string[]; terminals: string[] };
export type SymbolLink = {
  key: string;
  tex: string;
  label: string;
  focus: Focus;
};
export const nodeName = (index: number): string =>
  index < 26
    ? String.fromCharCode(65 + index)
    : nodeName(Math.floor(index / 26) - 1) +
      String.fromCharCode(65 + (index % 26));
export function symbols(c: Circuit) {
  const links: SymbolLink[] = [];
  const t = topology(c);
  c.parts.forEach((p, i) => {
    for (const letter of ["I", "V", "R", "P", "C", "Q"])
      links.push({
        key: `${letter}${i + 1}`,
        tex: `${letter}_{${i + 1}}`,
        label: `${{ I: "تيار", V: "جهد", R: "مقاومة", P: "قدرة", C: "سعة", Q: "شحنة" }[letter]} العنصر ${i + 1}`,
        focus: { parts: [p.id], terminals: [] },
      });
  });
  t.nodes.forEach((n, i) =>
    links.push({
      key: `node${i}`,
      tex: `V_{${n.name ?? nodeName(i)}}`,
      label: `جهد العقدة ${n.name ?? nodeName(i)}`,
      focus: { parts: [], terminals: n.terminals },
    }),
  );
  const find = (key: string) => links.find((l) => l.key === key)!;
  return {
    links,
    part: (id: string, letter = "I") =>
      find(`${letter}${c.parts.findIndex((p) => p.id === id) + 1}`),
    node: (id: string) => find(`node${t.nodes.findIndex((n) => n.id === id)}`),
  };
}
export const linked = (s: SymbolLink) =>
  `\\htmlData{symbol=${s.key}}{${s.tex}}`;
export const numberTex = (v: number): string => {
  if (!Number.isFinite(v)) return "\\text{غير معرّف}";
  if (Math.abs(v) < 1e-14) return "0";
  const s = Number(v.toPrecision(8)).toString();
  if (!s.includes("e")) return s;
  const [m, e] = s.split("e");
  return `${m}\\times10^{${Number(e)}}`;
};
export function plainTex(tex: string): string {
  const pattern = /\\htmlData\{symbol=[A-Za-z0-9]+\}\{/g;
  let output = "",
    cursor = 0,
    match: RegExpExecArray | null;
  while ((match = pattern.exec(tex))) {
    let end = pattern.lastIndex,
      depth = 1;
    for (; end < tex.length && depth; end++) {
      if (tex[end] === "{") depth++;
      else if (tex[end] === "}") depth--;
    }
    if (depth) break;
    output +=
      tex.slice(cursor, match.index) +
      plainTex(tex.slice(pattern.lastIndex, end - 1));
    cursor = end;
    pattern.lastIndex = end;
  }
  return output + tex.slice(cursor);
}

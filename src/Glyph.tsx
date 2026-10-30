import { type Part } from "./solver";
export function Glyph({ p, lit }: { p: Part; lit: boolean }) {
  return (
    <g
      className={lit ? "circuit-glyph lit" : "circuit-glyph"}
      pointerEvents="none"
    >
      {p.kind === "capacitor" ? (
        <path d="M-43 0 H-7 M7 0 H43 M-7 -19 V19 M7 -19 V19" />
      ) : p.kind === "resistor" ? (
        <>
          <path d="M-43 0 H-25 M25 0 H43" />
          <rect x="-25" y="-9" width="50" height="18" />
        </>
      ) : p.kind === "battery" ? (
        <>
          <path d="M-43 0 H-9 M9 0 H43 M-9 -19 V19 M9 -10 V10" />
          <text x="-25" y="19">
            +
          </text>
          <text x="22" y="19">
            −
          </text>
        </>
      ) : p.kind === "lamp" ? (
        <>
          <path d="M-43 0 H-17 M17 0 H43 M-12 -12 L12 12 M-12 12 L12 -12" />
          <circle r="17" />
        </>
      ) : p.kind === "switch" ? (
        <>
          <path d={`M-43 0 H-20 M20 0 H43 M-20 0 L20 ${p.closed ? 0 : -20}`} />
          <circle cx="-20" r="3" />
          <circle cx="20" r="3" />
        </>
      ) : (
        <>
          <path d="M-43 0 H-19 M19 0 H43" />
          <circle r="19" />
          <text textAnchor="middle" y="6">
            {p.kind === "ammeter" ? "A" : "V"}
          </text>
        </>
      )}
    </g>
  );
}

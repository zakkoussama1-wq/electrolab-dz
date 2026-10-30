import { type Circuit, type Result, labels } from "./solver";
import { topology, reading, fmt } from "./analysis";
import { nodeName, type Focus } from "./symbols";
export type Inspection = { kind: "node" | "loop" | "part"; id: string };
export function CircuitInspection({
  c,
  result,
  selected,
  select,
  highlight,
  onInspect,
}: {
  c: Circuit;
  result: Result | null;
  selected: string;
  select: (id: string) => void;
  highlight: (h: Focus) => void;
  onInspect: (v: Inspection) => void;
}) {
  const t = topology(c);
  return (
    <section className="education rc-inspection">
      <h2>العقد والفروع والحلقات · الدارة الحالية</h2>
      <div className="analysis-grid">
        <div className="analysis-card">
          <h3>العقد الكهربائية</h3>
          <div className="chips">
            {t.nodes.map((n, i) => (
              <button
                key={n.id}
                onClick={() => {
                  highlight({ parts: [], terminals: n.terminals });
                  onInspect({ kind: "node", id: n.id });
                }}
              >
                العقدة {(n.name ?? nodeName(i))}
              </button>
            ))}
          </div>
        </div>
        <div className="analysis-card">
          <h3>الفروع</h3>
          <div className="chips">
            {t.branches.map((b, i) => (
              <button
                key={b.id}
                onClick={() => {
                  select(b.id);
                  highlight({ parts: [b.id], terminals: [] });
                  onInspect({ kind: "part", id: b.id });
                }}
              >
                {labels[c.parts[i].kind]} {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="analysis-card">
          <h3>الحلقات المستقلة</h3>
          <div className="chips">
            {t.loops.map((l, i) => (
              <button
                key={l.id}
                onClick={() => {
                  highlight({ parts: l.steps.map((s) => s.id), terminals: [] });
                  onInspect({ kind: "loop", id: l.id });
                }}
              >
                الحلقة {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="all-readings">
        <h3>قراءات جميع العناصر عند مؤشر الزمن</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>العنصر</th>
                <th>الجهد (V)</th>
                <th>التيار (A)</th>
                <th>القدرة الممتصة (W)</th>
                <th>تفسير التيار</th>
              </tr>
            </thead>
            <tbody>
              {c.parts.map((p, i) => {
                const v =
                  result && !result.error ? reading(p, result) : undefined;
                return (
                  <tr
                    className={selected === p.id ? "active-reading" : ""}
                    key={p.id}
                  >
                    <td>
                      <button
                        onClick={() => {
                          select(p.id);
                          onInspect({ kind: "part", id: p.id });
                        }}
                      >
                        {labels[p.kind]} {i + 1}
                      </button>
                    </td>
                    <td>{v ? fmt(v.voltage) : "—"}</td>
                    <td>{v ? fmt(v.current) : "—"}</td>
                    <td>{v ? fmt(v.power) : "—"}</td>
                    <td>
                      {!v
                        ? "شغّل المحاكاة"
                        : v.current < -1e-10
                          ? "عكس السهم المرجعي"
                          : v.current > 1e-10
                            ? "مع السهم المرجعي"
                            : "لا يمر تيار"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

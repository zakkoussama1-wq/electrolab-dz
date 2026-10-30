import { useState } from 'react';
import { studentLessons, lessonCircuit, studentSolution, type CourseLesson } from './studentCourse';
import { MathFormula } from './MathFormula';
import { Glyph } from './Glyph';
import { terminalPosition, wirePath } from './connectivity';
import { topology, ref, reading } from './analysis';
import { symbols, type Focus, numberTex as num, linked } from './symbols';
import type { Circuit } from './solver';
import { extraCalculations } from './studentWorked';
const empty:Focus={parts:[],terminals:[]};
export function CourseDiagram({c,focus,onFocus,sourceStyle='battery'}:{c:Circuit;focus:Focus;onFocus:(f:Focus)=>void;sourceStyle?:'battery'|'voltage'}) {
 const t=topology(c);
 const registry=symbols(c);
 const pin=(v:string)=>{const i=v.lastIndexOf(':');return {p:c.parts.find(p=>p.id===v.slice(0,i))!,n:Number(v.slice(i+1))};};
 return <figure className="course-diagram"><svg viewBox="70 30 800 440" role="img" aria-label="الدارة الفعلية: الأقطاب وأسهم التيار والعقد">
  {c.wires.map(w=>{const a=pin(w.a),b=pin(w.b);return <path key={w.id} className="diagram-wire" d={wirePath(a.p,a.n,b.p,b.n)}/>;})}
  {c.parts.map((p,i)=><g key={p.id} transform={`translate(${p.x},${p.y})`}>
   <g transform={`rotate(${p.rotation})`} className={focus.parts.includes(p.id)?'diagram-focus':''} onClick={()=>onFocus({parts:[p.id],terminals:[]})} role="button" tabIndex={0} aria-label={`إبراز ${p.label}`} onKeyDown={e=>{if(e.key==='Enter')onFocus({parts:[p.id],terminals:[]});}}>
    <rect x="-60" y="-30" width="120" height="60" rx="8" className="diagram-target"/>
    {p.kind==='battery'&&sourceStyle==='voltage'?<g className="circuit-glyph" pointerEvents="none"><path d="M-43 0 H-18 M18 0 H43"/><circle r="18"/></g>:<Glyph p={p} lit={false}/>}<path className="diagram-wire" d="M-58 0 H-43 M43 0 H58"/>
    <text x="-49" y="-16">{ref(p.voltageRef)>0?'+':'−'}</text><text x="44" y="-16">{ref(p.voltageRef)>0?'−':'+'}</text>
    <path className="diagram-current" d={ref(p.currentRef)===1?'M-28 -40 H28 L19 -46 M28 -40 L19 -34':'M28 -40 H-28 L-19 -46 M-28 -40 L-19 -34'}/>
   </g>
   {p.kind==='battery'&&sourceStyle==='voltage'&&[-1,1].map(k=><text key={k} textAnchor="middle" x={Math.cos(p.rotation*Math.PI/180)*k*10} y={Math.sin(p.rotation*Math.PI/180)*k*10+5}>{k===-1?'+':'−'}</text>)}
   <text className="diagram-label" x={p.rotation===90?-35:0} y={p.rotation===90?0:32} textAnchor={p.rotation===90?'end':'middle'}>{p.label} · {Number.isFinite(p.value)?p.value:'—'} {p.kind==='battery'?'V':'Ω'}</text>
   <text className="diagram-voltage-label" x={p.rotation===90?-35:0} y={p.rotation===90?24:57} textAnchor={p.rotation===90?'end':'middle'}>{registry.part(p.id,'V').tex.replace(/_\{(\d+)\}/,'$1')}</text>
   <text className="diagram-current-label" x={p.rotation===90?65:0} y={p.rotation===90?0:-55}>{registry.part(p.id).tex.replace(/_\{(\d+)\}/,'$1')}</text>
  </g>)}
  {t.nodes.map((node,i)=>{const first=pin(node.terminals[0]),pos=terminalPosition(first.p,first.n);return <g key={node.id} onClick={()=>onFocus({parts:[],terminals:node.terminals})} role="button" tabIndex={0} aria-label={`إبراز العقدة ${node.name??String.fromCharCode(65+i)}`} onKeyDown={e=>{if(e.key==='Enter')onFocus({parts:[],terminals:node.terminals});}}><circle cx={pos.x} cy={pos.y} r={focus.terminals.some(t=>node.terminals.includes(t))?9:5} className="diagram-node"/><text x={pos.x-14} y={pos.y-12}>{node.name??String.fromCharCode(65+i)}</text></g>;})}
 </svg><figcaption>انقر عنصرًا أو عقدة لإبراز رموزها. الأزرق للتيار، وعلامتا + و− لمرجع الجهد.</figcaption></figure>;
}
export function StudentLessons({openLab}:{openLab:(c:Circuit)=>void}) {
 const [id,setId]=useState('ohm');
 const l=studentLessons.find(l=>l.id===id)!;
 const [c,setC]=useState(()=>lessonCircuit('ohm'));
 const [focus,setFocus]=useState<Focus>(empty),[show,setShow]=useState(true),[attempt,setAttempt]=useState(''),[feedback,setFeedback]=useState('');
 const {result,lesson}=studentSolution(l,c);
 const registry=symbols(c);
 const extras=extraCalculations(l.id,c,result);
 const choose=(l:CourseLesson)=>{setId(l.id);setC(lessonCircuit(l.fixture!));setFocus(empty);setShow(true);setAttempt('');setFeedback('');};
 const change=(id:string,patch:object)=>{setC({...c,parts:c.parts.map(p=>p.id===id?{...p,...patch}:p)});setFeedback('');};
 const active=registry.links.filter(s=>s.focus.parts.some(p=>focus.parts.includes(p))||s.focus.terminals.some(t=>focus.terminals.includes(t))).map(s=>s.key);
 return <section className="student-course" dir="rtl">
  <div className="eyebrow">افهم الفكرة · تابع الحل · جرّب بنفسك</div><h1>الدروس والتجارب</h1>
  <p className="student-lead">دروس من محاضراتك وتمارينك الجامعية. ابدأ بالقوانين الأساسية، وتتبّع الأقطاب والأسهم في الرسم أثناء قراءة الحل.</p>
  <div className="student-catalog">{studentLessons.map(item=><article key={item.id} className={id===item.id?'chosen-lesson':''}><h2>{item.title}</h2><bdi lang="fr">{item.foreign}</bdi><p>{item.definition}</p><small><bdi>{item.source}</bdi></small>{item.fixture?<button aria-pressed={id===item.id} onClick={()=>choose(item)}>افتح درس {item.title}</button>:<p className="availability">الدرس التفاعلي غير متاح بعد. {item.related}</p>}</article>)}</div>
  <article className="student-notebook" aria-label="دفتر الحل">
   <header className="notebook-heading"><div><span>درس وتجربة محلولة</span><h2>{l.title}</h2><bdi>{l.foreign}</bdi></div><p><bdi>{l.source}</bdi></p></header>
   <div className="lesson-intro"><section><h3>التعريف</h3><p>{l.definition}</p><h3>الفكرة الفيزيائية</h3><p>{l.idea}</p></section><section><h3>ما الذي ستتعلمه؟</h3><p>{l.goal}</p><h3>متى نستخدم القانون؟</h3><p>{l.when}</p></section></div>
   <div className="student-law"><div><h3>القانون العام</h3><MathFormula tex={l.law}/><h3>تفسير الرموز</h3><p>{l.symbols}</p><p className="source-reference"><bdi>{l.related}</bdi></p></div><CourseDiagram c={c} focus={focus} onFocus={setFocus} sourceStyle={l.fixture==='kirchhoff'?'battery':'voltage'}/></div>
   <section className="student-experiment"><h3>غيّر المعطيات ولاحظ أثرها</h3><p>القيم الابتدائية هي قيم المثال الأصلي. كل تعديل يعيد الحساب ويحدّث الرسم والحل. نقل المثال إلى المختبر يستبدل الدارة الموجودة فيه؛ احفظ عملك هناك أولًا. عكس المرجع يغيّر إشارة القراءة ويُبقي الدارة نفسها.</p><div className="student-inputs">{c.parts.map(p=><label key={p.id}><bdi>{p.label} ({p.kind==='battery'?'V':'Ω'})</bdi><input type="number" min="0.000001" step="any" value={p.value} onChange={e=>change(p.id,{value:e.target.valueAsNumber})}/><button onClick={()=>change(p.id,{currentRef:-ref(p.currentRef)})}>عكس سهم {p.label}</button><button onClick={()=>change(p.id,{voltageRef:-ref(p.voltageRef)})}>عكس قطبية {p.label}</button></label>)}</div><button onClick={()=>{choose(l);}}>استرجاع معطيات المثال</button><button onClick={()=>openLab(c)}>ركّب وعدّل هذه الدارة في المختبر</button></section>
   <section className="student-attempt"><h3>حاول بنفسك</h3><p>احسب {l.quantity==='Req'?'المقاومة المكافئة':l.quantity==='V'?'الجهد المرجعي للعنصر المختار':'التيار المرجعي للعنصر المختار'} بالقيم الحالية{l.quantity!=='Req'&&<bdi> ({l.selected}) </bdi>}، ثم قارن إجابتك. يمكنك إخفاء المثال المحلول أثناء المحاولة.</p><button onClick={()=>{setShow(!show);setFeedback('');}}>{show?'إخفاء الحل للمحاولة':'عرض المثال المحلول'}</button><label>إجابتك ({lesson.unit??'—'})<input aria-label="إجابة الدرس" type="number" step="any" value={attempt} onChange={e=>setAttempt(e.target.value)}/></label><button onClick={()=>setFeedback(lesson.value===undefined?'أصلح قيم الدارة أولًا.':attempt.trim()!==''&&Number.isFinite(Number(attempt))&&Math.abs(Number(attempt)-lesson.value)<=1e-6*Math.max(1,Math.abs(lesson.value))?'إجابة صحيحة. راجع خطوات التحقق أيضًا.':'راجع الوحدة والإشارة والتعويض؛ يمكنك عرض الحل للمقارنة.')}>تحقق من إجابتي</button><p role="status">{feedback}</p></section>
   {result.error?<p role="alert">{result.error}</p>:show&&<div className="notebook-work"><aside><CourseDiagram c={c} focus={focus} onFocus={setFocus} sourceStyle={l.fixture==='kirchhoff'?'battery':'voltage'}/></aside><div className="notebook-solution">{lesson.steps.map((step,i)=><section key={i} className="notebook-step"><h3>{step.title}</h3><p>{step.text}</p>{step.lines.map((line,j)=><div key={j}>{line.caption&&<p className="equation-caption">{line.caption}</p>}<MathFormula tex={line.tex} links={registry.links} active={active} onSymbol={s=>setFocus(s.focus)}/></div>)}<button onClick={()=>setFocus(step.focus)}>إبراز ما تتناوله هذه الخطوة</button></section>)}{extras.map((s,i)=><section key={i} className="notebook-step"><h3>{s.title}</h3><p>{s.text}</p>{s.tex.map((t,j)=><MathFormula key={j} tex={t} links={registry.links} active={active} onSymbol={s=>setFocus(s.focus)}/>)}</section>)}{!lesson.steps.length&&<p>{lesson.reason}</p>}<section className="notebook-step final-readings"><h3>النتائج النهائية لكل عنصر</h3><p>الجهد والتيار وفق المراجع المرسومة. القدرة السالبة تعني تزويد الدارة بالطاقة، والموجبة تعني امتصاصها.</p>{c.parts.map(p=>{const v=reading(p,result)!;return <article key={p.id}><h4><bdi>{p.label}</bdi></h4><MathFormula tex={`\\begin{aligned}${linked(registry.part(p.id,'V'))}&=${num(v.voltage)}\\,\\mathrm{V}\\\\${linked(registry.part(p.id,'I'))}&=${num(v.current)}\\,\\mathrm{A}\\\\P&=${num(v.power)}\\,\\mathrm{W}\\end{aligned}`} links={registry.links} active={active} onSymbol={s=>setFocus(s.focus)}/></article>;})}</section><button onClick={()=>window.print()}>طباعة الدرس والحل</button></div></div>}
  </article>
 </section>;
}

import { useState } from 'react';
import type { Circuit, Result } from './solver';
import { exercise1, twoNodeLesson } from './exercise1';
import { MathFormula } from './MathFormula';
import { symbols, type Focus } from './symbols';
import { diagnose, structuralDetails, topology } from './analysis';
export function ExerciseOne({c,result,load,highlight,concealed}: {c:Circuit;result:Result|null;load:(c:Circuit)=>void;highlight:(f:Focus)=>void;concealed:boolean}) {
  const [active,setActive] = useState(false), [show,setShow] = useState(false);
  const [answers,setAnswers] = useState(['','','']), [feedback,setFeedback] = useState('');
  const lesson = active && result && !concealed ? twoNodeLesson(c,result) : null;
  const graph = structuralDetails(c);
  const registry = symbols(c);
  return <section className="education exercise-one" id="exercise-one">
    <h2>Exercise 1 · قوانين كيرشوف</h2>
    <p>Series 1.pdf · الصفحة 1 · Figure 1. حدّد العقد والفروع والحلقات، اكتب معادلات كيرشوف، ثم احسب تيارات المسارات الثلاثة. R₁=2Ω، R₂=5Ω، R₃=10Ω؛ E₁=20V، E₂=70V. I₁ وI₂ نحو A، وI₃ من A نحو F.</p>
    <button className="primary" onClick={()=>{load(exercise1());setActive(true);setShow(false);setFeedback('');setAnswers(['','','']);}}>فتح دائرة Exercise 1</button>
    {active && <>
      <p>الرسم قابل للتعديل. الأرقام والشرح يتبعان الدارة الحالية؛ بعد التغيير أعد تشغيل المحاكاة. ترتيب تيارات المسارات هو ترتيب المقاومات في الرسم، والإشارة تتبع الأسهم المختارة.</p>
      <div className="chips">{graph.paths.map((p,i)=><button key={i} onClick={()=>highlight({parts:p.steps.map(s=>s.id),terminals:[]})}>إبراز المسار {i+1}</button>)}{graph.simple.map((l,i)=><button key={l.id} onClick={()=>highlight({parts:l.steps.map(s=>s.id),terminals:[]})}>حلقة بسيطة {i+1}</button>)}</div>
      <p>{graph.truncated ? 'استخراج الحلقات البسيطة محدود لهذه الشبكة الكبيرة؛ الحلقات المستقلة تبقى معروضة أدناه.' : 'يمكنك إبراز الحلقة الخارجية أيضًا؛ ليست معادلة مستقلة إضافية.'}</p>
      <h3>حاول أولًا قبل التصحيح</h3>
      <div className="teaching-controls">{answers.map((a,i)=><label key={i}>I{i+1} (A)<input aria-label={`إجابة I${i+1}`} type="number" value={a} onChange={e=>setAnswers(old=>old.map((v,j)=>i===j?e.target.value:v))}/></label>)}</div>
      <button onClick={()=>{
        if (!result || result.error) {setFeedback('شغّل محاكاة صحيحة أولًا.');return;}
        const t=topology(c),g=structuralDetails(c,t);
        if (!twoNodeLesson(c,result).steps.length || g.paths.length!==3) {setFeedback('البنية الحالية لا تناسب سؤال المسارات الثلاثة؛ استرجع دارة التمرين.');return;}
        const resistors=c.parts.filter(p=>p.kind==='resistor');
        setFeedback(answers.map((a,i)=>{const p=resistors[i];const expected=p ? result.values[p.id]?.current*(p.currentRef??1) : NaN;return `I${i+1}: ${a.trim()!==''&&Number.isFinite(Number(a))&&Math.abs(Number(a)-expected)<=1e-6*Math.max(1,Math.abs(expected))?'صحيح':'راجع الإشارة وقانون أوم ومعادلة العقدة'}`;}).join(' · '));
      }}>تصحيح المحاولة</button><p role="status">{feedback}</p>
      {!concealed && <button onClick={()=>setShow(!show)}>{show?'إخفاء التصحيح':'إظهار الحل خطوة بخطوة'}</button>}
      {show && !concealed && (!result ? <p>شغّل المحاكاة من شريط مساحة العمل أولًا.</p> : lesson?.steps.length ? lesson.steps.map((s,i)=><article className="step" key={i}><h3>{s.title}</h3><p>{s.text}</p><button onClick={()=>highlight({parts:s.parts,terminals:s.terminals??[]})}>إبراز العناصر المعنية</button>{s.tex.map((tex,j)=><MathFormula key={j} tex={tex} links={registry.links} onSymbol={s=>highlight(s.focus)}/>)}</article>) : <p role="alert">{result.error || lesson?.reason}</p>)}
    </>}
  </section>;
}
export function ConnectionDiagnostics({c,result,highlight}:{c:Circuit;result:Result|null;highlight:(f:Focus)=>void}) {
  const issues=diagnose(c,result);
  return <section className="education" aria-label="تشخيص التوصيلات"><h2>تشخيص التوصيلات</h2><p>نقطة الطرف هي موضع الاتصال. تقاطع مسارين أو تلامس رمزين لا يربطهما كهربائيًا؛ انقر الطرفين في وضع الأسلاك. التحريك والتدوير يحافظان على هوية الطرف والسلك.</p>{issues.map((d,i)=><div className="message" key={i}><p>{d.text}</p><button onClick={()=>highlight({parts:d.parts,terminals:d.terminals})}>إبراز موضع الفحص</button></div>)}{!issues.length&&<p>لا توجد أخطاء توصيل مكتشفة{result?' في التحليل الحالي':'؛ شغّل المحاكاة للتحقق العددي'}.</p>}</section>;
}

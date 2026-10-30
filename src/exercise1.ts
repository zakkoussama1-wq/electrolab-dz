import type { Circuit, Part, Result } from './solver';
import { topology, structuralDetails, reading, checks, ref } from './analysis';
import { numberTex as num, symbols, linked } from './symbols';
/** Series 1, page 1, Figure 1. Terminal 0 is the top of each element. */
export function exercise1(): Circuit {
  const part = (id: string, kind: Part['kind'], x: number, y: number, value: number): Part => ({id, label: id, kind, x, y, value, rotation: 90, closed: true});
  return {
    nodeNames: {'R2:0':'A','E2:1':'B','E1:0':'X','E2:0':'Y'},
    parts: [part('R1','resistor',190,170,2), part('R2','resistor',480,170,5), part('R3','resistor',770,245,10), part('E1','battery',190,320,20), part('E2','battery',480,320,70)].map(p => ({...p, terminalLabels: ({R1:['D',''],R2:['A',''],R3:['F','E'],E1:['','C'],E2:['','B']} as Record<string,[string,string]>)[p.id], currentRef: p.id === 'R1' || p.id === 'R2' ? -1 : 1})),
    wires: [['R1:0','R2:0'],['R2:0','R3:0'],['R1:1','E1:0'],['R2:1','E2:0'],['E1:1','E2:1'],['E2:1','R3:1']].map(([a,b],i) => ({id:`ex1-w${i}`, a,b})),
  };
}
export type WorkedStep = {title: string; text: string; tex: string[]; parts: string[]; terminals?: string[]};
/** General two-essential-node resistive network, arbitrary positive resistances
 * and series voltage sources. Independent KCL/Ohm derivation, checked against MNA.
 * This is a teaching path, never an alternative source of physical results. */
export function twoNodeLesson(c: Circuit, r: Result): {steps: WorkedStep[]; reason?: string} {
  const t = topology(c), g = structuralDetails(c,t);
  const fail = (reason: string) => ({steps: [], reason});
  if (r.error || t.error) return fail(r.error || t.error!);
  if (g.essential.length !== 2 || g.paths.length !== 3 || g.paths.some(p => p.a === p.b)) return fail('تغيّرت البنية: هذا الشرح مخصص لثلاثة مسارات مقاومية بين عقدتين أساسيتين. استخدم لوحة أوم وكيرشوف العامة أدناه للتحليل الحالي.');
  // Display metadata may name the upper node A; connectivity never depends on labels.
  const A = g.essential.find(n => n.name === 'A') ?? g.essential[0];
  const B = g.essential.find(n => n.id !== A.id)!;
  const paths = g.paths.slice().sort((a,b) => c.parts.findIndex(p => p.kind === 'resistor' && a.steps.some(s => s.id === p.id)) - c.parts.findIndex(p => p.kind === 'resistor' && b.steps.some(s => s.id === p.id))).map(p => ({...p, steps: p.a === A.id ? p.steps : [...p.steps].reverse().map(s => ({...s,sign:-s.sign}))}));
  const data = paths.map((path,i) => {
    let R = 0, E = 0;
    for (const s of path.steps) {
      const p = c.parts.find(p => p.id === s.id)!;
      if (p.kind === 'resistor') R += p.value;
      else if (p.kind === 'battery') E += s.sign * p.value;
      else return null;
    }
    const resistorStep = path.steps.find(s => c.parts.find(p => p.id === s.id)!.kind === 'resistor');
    if (!resistorStep || R <= 0) return null;
    const p = c.parts.find(p => p.id === resistorStep.id)!;
    return {path,R,E,p, k: resistorStep.sign * ref(p.currentRef), i:i+1};
  });
  if (data.some(d => !d)) return fail('يتطلب هذا الاشتقاق مقاومة موجبة في كل مسار ومصادر جهد مستقلة فقط.');
  const d = data.map(x => x!);
  const voltage = (r.terminalVoltages?.[A.terminals[0]] ?? NaN) - (r.terminalVoltages?.[B.terminals[0]] ?? NaN);
  const numerator = d.reduce((s,x) => s+x.E/x.R,0), denominator = d.reduce((s,x) => s+1/x.R,0);
  const referenceVoltage = numerator/denominator;
  if (!Number.isFinite(voltage) || Math.abs(voltage-referenceVoltage)>1e-7*Math.max(1,Math.abs(voltage))) return fail('فشل التحقق المستقل من جهود العقد؛ لا نعرض حلًا تعليميًا غير متسق.');
  const registry = symbols(c);
  const all = c.parts.map(p => p.id);
  const sign = (k:number,i:number) => k < 0 ? '-' : i ? '+' : '';
  const sum = d.map((x,i)=>`${sign(x.k,i)}I_{${x.i}}`).join('');
  const fmtTerms = d.map(x=>`\\frac{${num(x.E)}}{${num(x.R)}}`).join('+');
  const conductances = d.map(x=>`\\frac{1}{${num(x.R)}}`).join('+');
  const steps: WorkedStep[] = [
    {title:'1 · المعطيات والمطلوب',text:'المطلوب: عدّ العقد والفروع والحلقات، كتابة معادلات كيرشوف وحساب تيارات المسارات. القيم أدناه مأخوذة من العناصر الحالية؛ تغييرها يحدّث الحل.',tex:c.parts.map(p=>`${p.kind==='battery'?'E':'R'}_{${p.label?.slice(1) ?? c.parts.indexOf(p)+1}}=${num(p.value)}\\,${p.kind==='battery'?'\\mathrm{V}':'\\Omega'}`),parts:all},
    {title:'2 · بنية الدارة',text:'العقدة الأساسية تجمع ثلاثة فروع أو أكثر؛ العقدة العادية تصل عنصرين. الفرع الأساسي مسار متسلسل بين عقدتين أساسيتين. الحلقات البسيطة تشمل الحلقة الخارجية، لكن عدد المعادلات المستقلة اثنان. ليست الحلقات الأساسية المستخرجة خوارزميًا بالضرورة الوجوه الداخلية للرسم.',tex:[`n=${t.nodes.length},\\quad b=${t.branches.length},\\quad l=b-n+1=${t.loops.length}`,`n_{\\mathrm{ess}}=${g.essential.length},\\quad b_{\\mathrm{ess}}=${g.paths.length},\\quad N_{\\mathrm{simple}}=${g.simple.length}`],parts:all},
    {title:'3 · اختيار أوم وكيرشوف',text:'لكل مسار نجمع هبوطات الجهد من A إلى B، ثم نطبق حفظ التيار عند A. التيار J موجب من A إلى B، أما I فيتبع سهم المقاومة الذي اخترته. E هو مجموع هبوطات المصادر الموقّعة في المسار؛ لم نستخدم نظرية جديدة خارج هذا الاشتقاق.',tex:['\\sum i=0,\\qquad \\sum v=0,\\qquad v_R=Ri','V_{AB}=R_jJ_j+E_j,\\qquad J_j=\\frac{V_{AB}-E_j}{R_j}'],parts:all},
    {title:'4 · معادلات المسارات والعقدة',text:'I₁ وI₂ وI₃ هنا تيارات المسارات بحسب أسهم مقاوماتها، بترتيب المسارات. لكل معادلة زر يبرز عناصرها. أقطاب البطاريات ثابتة؛ تغيير مرجع جهد المقاومة لا يغيّر المصدر.',tex:[`${sum}=0`,...checks(c,r).kvl.map(l => l.terms.map((s,i)=>`${s.sign<0?'-':i?'+':''}${linked(registry.part(s.id,'V'))}`).join('')+'=0'),...d.map(x=>`V_{AB}=${x.k<0?'-':''}${num(x.R)}I_{${x.i}}+(${num(x.E)})`)],parts:all,terminals:A.terminals},
    {title:'5 · القانون العام وحل المعادلات',text:'نعوّض تيارات المسارات في معادلة العقدة ونجمّع معاملات الجهد. هذه عملية حل معادلات أوم وكيرشوف، وهي صالحة لقيم أخرى أيضًا.',tex:['\\sum_j\\frac{V_{AB}-E_j}{R_j}=0','V_{AB}\\sum_j\\frac{1}{R_j}=\\sum_j\\frac{E_j}{R_j}','V_{AB}=\\frac{\\sum_j\\frac{E_j}{R_j}}{\\sum_j\\frac{1}{R_j}}'],parts:all},
    {title:'6 · التعويض والحساب',text:'المقاومة هنا مجموع المقاومات المتسلسلة في المسار. الإشارة المرافقة لكل تيار مأخوذة من اتجاه سهمه الحالي.',tex:[`\\begin{aligned}V_{AB}&=\\frac{${fmtTerms}}{${conductances}}\\\\&=\\frac{${num(numerator)}}{${num(denominator)}}=${num(voltage)}\\,\\mathrm{V}\\end{aligned}`,...d.map(x=>`I_{${x.i}}=${x.k<0?'-':''}\\frac{${num(voltage)}-(${num(x.E)})}{${num(x.R)}}=${num(reading(x.p,r)!.current)}\\,\\mathrm{A}`)],parts:all},
    {title:'7 · النتيجة والتفسير',text:'التيار السالب ليس خطأ توصيل: اتجاهه الفعلي معاكس للسهم المرجعي. الجهد السالب يعني أن الطرف المعلّم − أعلى جهدًا من الطرف المعلّم +. القدرة الممتصة مستقلة عن اختيار المراجع.',tex:d.flatMap(x=>[`\\boxed{I_{${x.i}}=${num(reading(x.p,r)!.current)}\\,\\mathrm{A}}`, `${linked(registry.part(x.p.id,'V'))}=${ref(x.p.voltageRef)*ref(x.p.currentRef)}\\times ${num(x.p.value)}I_{${x.i}}=${num(reading(x.p,r)!.voltage)}\\,\\mathrm{V}`]),parts:all},
    {title:'8 · التحقق العلمي',text:'نفحص كل عقدة وكل حلقة مستقلة وموازنة القدرة. كما قورن الجهد بحل مستقل لمعادلة العقدة قبل عرض هذه الخطوات.',tex:[...checks(c,r).kcl.map((x,i)=>`\\sum i_{\\mathrm{node}\\,${i+1}}=${num(x.residual)}\\,\\mathrm{A}`),...checks(c,r).kvl.map((x,i)=>`\\sum v_{\\mathrm{loop}\\,${i+1}}=${num(x.residual)}\\,\\mathrm{V}`),`\\sum P=${num(checks(c,r).power)}\\,\\mathrm{W}`],parts:all},
  ];
  return {steps: steps.map(step=>({...step, tex: step.tex.map(tex=>tex.replace(/I_\{(\d+)\}/g, (original,n)=> {const x=d[Number(n)-1];return x ? linked(registry.part(x.p.id,'I')) : original;}))}))};
}

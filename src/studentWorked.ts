import type {Circuit,Result} from './solver';
import {ref,topology,reading,checks} from './analysis';
import {symbols,linked,numberTex as n} from './symbols';
export function extraCalculations(id:string,c:Circuit,r:Result):{title:string;text:string;tex:string[]}[] {
 if(r.error) return [];
 const s=symbols(c),sym=(id:string,l:string)=>linked(s.part(id,l));
 const resistors=c.parts.filter(p=>p.kind==='resistor'),source=c.parts.find(p=>p.kind==='battery');
 if(!source) return [];
 if(id==='ohm') {
  const p=resistors[0];if(!p) return [];
  const v=reading(p,r)!;
  return [{title:'الموصلية والقدرة في Example 2.2',text:'الموصلية هي مقلوب المقاومة. القدرة الممتصة تُحسب وفق المراجع؛ حاصل الجهد والتيار وحده يحتاج إشارة موجبة عندما يدخل التيار من القطب الموجب.',tex:[`\\begin{aligned}G&=\\frac{1}{${sym(p.id,'R')}}\\\\&=\\frac{1}{${n(p.value)}}\\\\&=${n(1/p.value)}\\,\\mathrm{S}\\end{aligned}`,`\\begin{aligned}P&=${ref(p.voltageRef)*ref(p.currentRef)<0?'-':''}${sym(p.id,'V')}${sym(p.id,'I')}\\\\&=${ref(p.voltageRef)*ref(p.currentRef)<0?'-':''}(${n(v.voltage)})(${n(v.current)})\\\\&=\\boxed{${n(v.power)}\\,\\mathrm{W}}\\end{aligned}`]}];
 }
 if(id==='series') {
  const t=topology(c);
  if(c.parts.filter(p=>p.kind==='battery').length!==1 || t.loops.length!==1 || t.open.length || t.nodes.some(n=>t.branches.filter(b=>b.a===n.id||b.b===n.id).length!==2)) return [];
  const total=resistors.reduce((sum,p)=>sum+p.value,0);
  return [{title:'مقسم الجهد من أوم وكيرشوف',text:'لأن التيار واحد، يكون هبوط الجهد على كل مقاومة متناسبًا مع قيمتها. نضيف إشارة القطبية المرجعية كما تظهر في الرسم؛ لهذا يبقى الجهد الثاني سالبًا في المثال الأصلي.',tex:resistors.map(p=>`\\begin{aligned}${sym(p.id,'V')}&=${ref(p.voltageRef)*(r.values[p.id].current<0?-1:1)<0?'-':''}\\frac{${sym(p.id,'R')}}{\\sum_jR_j}V_s\\\\&=${ref(p.voltageRef)*(r.values[p.id].current<0?-1:1)<0?'-':''}\\frac{${n(p.value)}}{${n(total)}}\\times${n(source.value)}\\\\&=\\boxed{${n(reading(p,r)!.voltage)}\\,\\mathrm{V}}\\end{aligned}`)}];
 }
 if(id==='parallel') {
  const t=topology(c),pairs=resistors.flatMap((p,i)=>resistors.slice(i+1).map(q=>[p,q] as const));
  const pair=pairs.find(([p,q])=>{const a=t.branches.find(b=>b.id===p.id)!,b=t.branches.find(b=>b.id===q.id)!;return a.a!==a.b&&((a.a===b.a&&a.b===b.b)||(a.a===b.b&&a.b===b.a));});
  if(!pair) return [];
  const node=t.branches.find(b=>b.id===pair[0].id)!.a;
  const feeding=t.branches.filter(b=>b.active&&!pair.some(p=>p.id===b.id)&&(b.a===node||b.b===node));
  if(feeding.length!==1) return [];
  const total=Math.abs(r.values[feeding[0].id].current);
  const residual=checks(c,r,t).kcl.find(k=>k.id===node)!.residual;
  return [{title:'مقسم التيار في الجزء المتوازي',text:'المقاومتان المتصلتان بالعقدتين نفسيهما تتقاسمان التيار الداخل إلى مجموعتهما. نستخدم تيار المجموعة فقط، ونحوّل النتيجة إلى سهم كل عنصر.',tex:[`I_T=${n(total)}\\,\\mathrm{A}`,...pair.map(p=>`\\begin{aligned}${sym(p.id,'I')}&=${ref(p.currentRef)*(r.values[p.id].current<0?-1:1)<0?'-':''}\\frac{\\frac{1}{${sym(p.id,'R')}}}{\\sum_j\\frac{1}{R_j}}I_T\\\\&=${ref(p.currentRef)*(r.values[p.id].current<0?-1:1)<0?'-':''}\\frac{\\frac{1}{${n(p.value)}}}{${pair.map(q=>`\\frac{1}{${n(q.value)}}`).join('+')}}\\times${n(total)}\\\\&=\\boxed{${n(reading(p,r)!.current)}\\,\\mathrm{A}}\\end{aligned}`),`\\sum I_{\\mathrm{out}}-I_T=${n(residual)}\\,\\mathrm{A}`]}];
 }
 return [];
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import {studentLessons,lessonCircuit,studentSolution} from './studentCourse';
import {extraCalculations} from './studentWorked';
import {blackboardTex} from './blackboard';
import {checks,reading,equivalent} from './analysis';
import {solve} from './solver';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('student: blackboard aligns equality chains without breaking fractions, links or simultaneous equations',()=>{
 assert.match(blackboardTex('I=2=2\\,\\mathrm{A}'),/aligned/);
 assert.equal(blackboardTex('I=V/R=2'),'\\begin{aligned}I&=V/R\\\\&=2\\end{aligned}');
 for(const tex of ['V=RI,\\quad I=\\frac{V}{R}','\\boxed{I=2}','\\begin{aligned}I&=2\\end{aligned}']) assert.equal(blackboardTex(tex),tex);
 assert.doesNotThrow(()=>katex.renderToString(blackboardTex('\\htmlData{symbol=I1}{I_1}=\\frac{2}{3}'),{trust:true,strict:'ignore'}));
});
test('course:C2-EX-02 actual 30V/5kOhm circuit, current, conductance, power and independent conservation',()=>{
 const c=lessonCircuit('ohm'),r=solve(c);assert.equal(r.error,undefined);
 near(r.values.R1.current,30/5000);near(1/c.parts[0].value,.0002);near(r.values.R1.power,.18);near(checks(c,r).power,0);
 const l=studentLessons[0];near(studentSolution(l,c).lesson.value!,.006);
 c.parts[0].value=2500;near(studentSolution(l,c).lesson.value!,.012);
 assert.match(JSON.stringify(extraCalculations('ohm',c,solve(c))),/0.36/);
});
test('course:C2-EX-05 series 20V 2/3Ohm original negative reference matches independent KVL and divider',()=>{
 const c=lessonCircuit('series'),r=solve(c);near(r.values.R1.current,20/(2+3));near(reading(c.parts[0],r)!.voltage,8);near(reading(c.parts[1],r)!.voltage,-12);near(equivalent(c).value!,5);
 for(const x of checks(c,r).kvl)near(x.residual,0);
 const kvl=studentLessons.find(l=>l.id==='kvl')!;near(studentSolution(kvl,c).lesson.value!,-12);
 c.parts[0].value=7;c.parts[1].value=13;const changed=solve(c);near(changed.values.R1.current,1);near(reading(c.parts[1],changed)!.voltage,-13);
 assert.match(JSON.stringify(extraCalculations('series',c,changed)),/13/);
});
test('course:C2-EX-08 mixed network 8+(3||6), all voltages/currents match independent two-equation solution',()=>{
 const c=lessonCircuit('parallel'),r=solve(c);near(equivalent(c).value!,10);
 // Independent KCL i1=i2+i3; KVL 30=8i1+3i2 and 3i2=6i3.
 near(r.values.R1.current,3);near(r.values.R2.current,2);near(r.values.R3.current,1);
 near(r.values.R1.voltage,24);near(r.values.R2.voltage,6);near(r.values.R3.voltage,6);
 near(checks(c,r).power,0);for(const k of checks(c,r).kcl)near(k.residual,0);
 c.parts[0].value=5;c.parts[1].value=4;c.parts[2].value=12;const rr=solve(c);
 const eq=1/(1/4+1/12),it=30/(5+eq);near(rr.values.R2.current,it*12/(4+12));near(rr.values.R3.current,it*4/(4+12));
});
test('student: every implemented lesson and extra calculation renders academic LaTeX for all reference signs',()=>{
 for(const l of studentLessons.filter(l=>l.fixture))for(const v of [1,-1] as const)for(const i of [1,-1] as const){
  const c=lessonCircuit(l.fixture!);c.parts=c.parts.map(p=>({...p,voltageRef:v,currentRef:i}));
  const {lesson,result}=studentSolution(l,c);assert.equal(result.error,undefined);assert.equal(lesson.steps.length,10);
  const tex=[l.law,...lesson.steps.flatMap(s=>s.lines.map(l=>l.tex)),...extraCalculations(l.id,c,result).flatMap(s=>s.tex)];
  for(const t of tex){assert.doesNotThrow(()=>katex.renderToString(blackboardTex(t),{displayMode:true,throwOnError:true,strict:'ignore',trust:true}));assert.ok(!/Iphys|phiN|MNA|undefined|NaN/.test(t));}
 }
});
test('student: reference reversals preserve results and live divider explanations change with circuit values',()=>{
 for(const kind of ['ohm','series','parallel'] as const){const c=lessonCircuit(kind),r=solve(c),before=JSON.stringify(extraCalculations(kind,c,r));c.parts=c.parts.map(p=>({...p,currentRef:-1,voltageRef:-1}));const rr=solve(c);for(const p of c.parts)near(rr.values[p.id].power,r.values[p.id].power);assert.notEqual(before,JSON.stringify(extraCalculations(kind,c,rr)));}
 const open=lessonCircuit('series');open.wires.pop();assert.deepEqual(extraCalculations('series',open,solve(open)),[]);
 const changed=lessonCircuit('parallel');changed.wires=changed.wires.filter(w=>!(w.a==='R2:0'&&w.b==='R3:0'));assert.deepEqual(extraCalculations('parallel',changed,solve(changed)),[]);
});
test('student: lesson links refer exclusively to the supplied sources; unfinished theories have no executable fixtures',()=>{
 for(const l of studentLessons){assert.match(l.source,/Chapter 1.pdf|Series 1.pdf/);assert.ok(l.definition&&l.goal&&l.when&&l.idea);if(!l.fixture)assert.equal(l.method,undefined);}
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { exercise1, twoNodeLesson } from './exercise1';
import { solve, type Circuit } from './solver';
import { topology, structuralDetails, checks, reading, diagnose } from './analysis';
import { connectivity, terminalPosition, wirePath } from './connectivity';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function verify(c:Circuit) {
  const r=solve(c);assert.equal(r.error,undefined);
  for(const v of checks(c,r).kcl) near(v.residual,0);
  for(const v of checks(c,r).kvl) near(v.residual,0);
  near(checks(c,r).power,0);
  return r;
}
test('course:S-01 exact PDF connections, original source poles and branch arrows',()=>{
  const c=exercise1(), t=topology(c), g=structuralDetails(c,t), r=verify(c);
  assert.equal(t.nodes.length,4);assert.equal(t.branches.length,5);assert.equal(t.loops.length,2);
  assert.equal(g.essential.length,2);assert.equal(g.paths.length,3);assert.equal(g.simple.length,3);
  assert.equal(c.parts.find(p=>p.id==='E1')!.value,20);assert.equal(c.parts.find(p=>p.id==='E2')!.value,70);
  // Independent mesh equations: 7 I1 - 5 I3 = -50; I1 + 3 I3 = 4.
  // Solve the two-by-two system by Cramer's rule, independently of MNA.
  const determinant=7*3-(-5)*1;
  const i1=((-50)*3-(-5)*4)/determinant;
  const i3=(7*4-(-50)*1)/determinant;
  const i2=i3-i1;
  near(i1,-5);near(i2,8);near(i3,3);
  for(const [id,i] of [['R1',i1],['R2',i2],['R3',i3]] as const) near(reading(c.parts.find(p=>p.id===id)!,r)!.current,i);
  near(r.terminalVoltages!['R2:0']-r.terminalVoltages!['E2:1'],30);
  near(r.values.R1.power,50);near(r.values.R2.power,320);near(r.values.R3.power,90);
  near(r.values.E1.power,100);near(r.values.E2.power,-560);
});
test('course:S-01 arbitrary values match independent two-mesh equations, not answer constants',()=>{
  for(const [a,b,d,e,f] of [[3,7,11,9,17],[20,4,8,120,6],[.5,2,9,3,60]]) {
    const c=exercise1();for(const [i,v] of [a,b,d,e,f].entries()) c.parts[i].value=v;
    // (a+b) I1 - b I3=e-f; a I1+d I3=e.
    const determinant=(a+b)*d+a*b;
    const i1=((e-f)*d+b*e)/determinant;
    const i3=((a+b)*e-a*(e-f))/determinant;
    const r=verify(c);near(-r.values.R1.current,i1);near(-r.values.R2.current,i3-i1);near(r.values.R3.current,i3);
    assert.equal(twoNodeLesson(c,r).steps.length,8);
  }
  const c=exercise1(), names=new Map(c.parts.map((p,i)=>[p.id,`arbitrary-${i}`]));
  const rename=(t:string)=>names.get(t.slice(0,t.lastIndexOf(':')))!+t.slice(t.lastIndexOf(':'));
  c.parts=c.parts.map(p=>({...p,id:names.get(p.id)!}));
  c.wires=c.wires.map(w=>({...w,a:rename(w.a),b:rename(w.b)}));
  c.nodeNames=Object.fromEntries(Object.entries(c.nodeNames!).map(([t,n])=>[rename(t),n]));
  assert.equal(twoNodeLesson(c,verify(c)).steps.length,8);
});
test('course:S-01 stable connectivity through moves, rotations, reversed wire order and reversed parts',()=>{
  const c=exercise1(), base=solve(c), nodes=connectivity(c);
  for(const angle of [0,90,180,270,37]) {
    const changed={...c, parts:[...c.parts].reverse().map((p,i)=>({...p,rotation:angle,x:100+i*137,y:150+i*12})), wires:[...c.wires].reverse().map(w=>({...w,a:w.b,b:w.a}))};
    assert.deepEqual(connectivity(changed),nodes);const r=verify(changed);
    for(const p of c.parts) near(r.values[p.id].current,base.values[p.id].current);
    for(const p of changed.parts) for(const n of [0,1]) {
      const v=terminalPosition(p,n),op=terminalPosition(p,1-n);
      near(Math.hypot(v.x-p.x,v.y-p.y),58);near(Math.hypot(v.x-op.x,v.y-op.y),116);
    }
    const p=changed.parts[0],q=changed.parts[1],v=terminalPosition(p,0);
    assert.ok(wirePath(p,0,q,1).startsWith(`M ${v.x} ${v.y}`));
  }
});
test('course:S-01 all voltage/current reference combinations preserve physics and academic signs',()=>{
  for(const vr of [1,-1] as const) for(const ir of [1,-1] as const) {
    const c=exercise1();c.parts=c.parts.map(p=>({...p,currentRef:ir,voltageRef:vr}));const r=verify(c);
    near(r.values.R1.current,5);near(reading(c.parts[0],r)!.current,5*ir);
    const l=twoNodeLesson(c,r);assert.equal(l.steps.length,8);
    for(const s of l.steps) for(const tex of s.tex) {
      assert.doesNotThrow(()=>katex.renderToString(tex,{throwOnError:true,strict:'ignore',trust:true}));
      assert.ok(!/Iphys|phiN|MNA|undefined|NaN/.test(tex));
    }
  }
});
test('course:S-01 open, bypassed resistor, invalid terminal, duplicate identifiers, ideal short and unsupported teaching structure',()=>{
  let c=exercise1();c.wires.splice(2,1);const open=verify(c);near(open.values.R1.current,0);assert.ok(diagnose(c,open).some(x=>x.parts.includes('R1')&&/مفتوحة/.test(x.text)));
  c=exercise1();c.wires.push({id:'bypass',a:'R1:0',b:'R1:1'});assert.ok(diagnose(c,solve(c)).some(x=>x.parts.includes('R1')&&/تتجاوزها/.test(x.text)));
  c=exercise1();c.wires.push({id:'short',a:'E1:0',b:'E1:1'});assert.match(solve(c).error!,/قصر/);
  c=exercise1();c.wires[0].a='missing:0';assert.ok(solve(c).error);assert.equal(topology(c).error,solve(c).error);
  c=exercise1();c.parts[1].id=c.parts[0].id;assert.match(solve(c).error!,/مكرر/);
  c=exercise1();c.wires[1].id=c.wires[0].id;assert.match(solve(c).error!,/مكرر/);
  c=exercise1();c.wires.pop();assert.ok(twoNodeLesson(c,solve(c)).reason);
});
test('course:S-01 coincident geometry and wire crossing never implicitly join terminals',()=>{
  const c=exercise1(), before=topology(c);
  c.parts=c.parts.map(p=>({...p,x:400,y:200,rotation:0}));
  assert.deepEqual(topology(c),before);verify(c);
});
test('course:S-01 analytic lesson uses live values, full equations, links and KCL/KVL/power checks',()=>{
  const c=exercise1(), l=twoNodeLesson(c,verify(c));assert.equal(l.steps.length,8);
  assert.ok(l.steps[3].tex.length>=6);assert.ok(l.steps[7].tex.length===7);
  assert.ok(l.steps.some(s=>s.tex.some(t=>t.includes('htmlData'))));
  const text=JSON.stringify(l);c.parts[0].value=13;
  assert.notEqual(JSON.stringify(twoNodeLesson(c,verify(c))),text);
});

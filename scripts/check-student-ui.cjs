const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(12000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());
 await p.goto(process.env.APP_URL||'http://127.0.0.1:4173/electrolab-dz/',{waitUntil:'domcontentloaded'});
 await p.locator('.course-nav').getByRole('button',{name:'الدروس والتجارب',exact:true}).click();
 const student=p.locator('.student-course'),notebook=p.locator('.student-notebook');
 assert.equal(await student.locator('.student-catalog button').count(),5);assert.equal(await student.locator('.availability').count(),5);
 assert.ok(!/COURSE_PROGRESS|src\/|MNA|Iphys|phiN|\.test\.|Chromium|KaTeX|معرّف/.test(await student.innerText()));
 fs.mkdirSync('/tmp/student-visual',{recursive:true});
 const lessons=[['قانون أوم','ohm'],['قانون كيرشوف للتيار','kcl'],['قانون كيرشوف للجهد','kvl'],['التوالي والمقاومة المكافئة ومقسم الجهد','series'],['التوازي والمقاومة المكافئة ومقسم التيار','parallel']];
 for(const [name,id] of lessons){
  await p.getByRole('button',{name:`افتح درس ${name}`,exact:true}).click();
  assert.equal(await notebook.locator('.notebook-step').count(),id==='kcl'||id==='kvl'?11:12);
  assert.equal(await notebook.getByRole('alert').count(),0);assert.ok(await notebook.locator('.mfrac').count()>0);
  assert.equal(await notebook.locator('.math-display').first().evaluate(e=>getComputedStyle(e).direction),'ltr');
  assert.ok(await notebook.locator('.boxed, .fbox').count()>0);
  await notebook.locator('.student-law').screenshot({path:`/tmp/student-visual/${id}-law-desktop.png`});
  await notebook.locator('.notebook-step').nth(7).screenshot({path:`/tmp/student-visual/${id}-calculation-desktop.png`});
  const eq=notebook.locator('.notebook-step').nth(7).locator('.katex-html').first();
  const positions=await eq.locator('.mrel').evaluateAll(els=>els.filter(e=>e.textContent==='=').map(e=>e.getBoundingClientRect().x));
  if(positions.length>1)assert.ok(Math.max(...positions)-Math.min(...positions)<3,`${id}: equality signs misaligned ${positions}`);
  await notebook.locator('[data-symbol]').first().click();assert.ok(await notebook.locator('.diagram-focus').count()>0);
  await notebook.locator('svg [role=button]').first().click();assert.ok(await notebook.locator('.symbol-active').count()>0);
  await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${id}: mobile overflow`);
  await notebook.locator('.student-law').screenshot({path:`/tmp/student-visual/${id}-law-mobile.png`});
  await notebook.locator('.notebook-step').nth(7).screenshot({path:`/tmp/student-visual/${id}-calculation-mobile.png`});
  assert.equal(await notebook.getByRole('alert').count(),0);await p.setViewportSize({width:1440,height:1000});
 }
 // Live data, reference changes, answer concealment and grading.
 await p.getByRole('button',{name:'افتح درس قانون أوم',exact:true}).click();
 await notebook.locator('.student-inputs input').first().fill('2500');
 await notebook.getByRole('button',{name:'إخفاء الحل للمحاولة',exact:true}).click();assert.equal(await notebook.locator('.notebook-solution').count(),0);
 await p.getByLabel('إجابة الدرس').fill('0.012');await p.getByRole('button',{name:'تحقق من إجابتي',exact:true}).click();assert.match(await notebook.getByRole('status').innerText(),/صحيحة/);
 await notebook.getByRole('button',{name:'عكس سهم R1',exact:true}).click();await p.getByLabel('إجابة الدرس').fill('-0.012');await p.getByRole('button',{name:'تحقق من إجابتي',exact:true}).click();assert.match(await notebook.getByRole('status').innerText(),/صحيحة/);
 await p.getByRole('button',{name:'عرض المثال المحلول',exact:true}).click();assert.equal(await notebook.getByRole('alert').count(),0);
 await notebook.getByRole('button',{name:'ركّب وعدّل هذه الدارة في المختبر',exact:true}).click();assert.equal(await p.locator('.component').count(),2);await p.getByRole('button',{name:'تشغيل المحاكاة',exact:true}).click();assert.match(await p.locator('.all-readings tbody tr').first().innerText(),/-0.012/);
 await p.locator('.course-nav').getByRole('button',{name:'حالة تطوير المختبر · للمطور',exact:true}).click();
 assert.equal(await p.locator('.course-table tbody tr').count(),94);await p.locator('.status-guide summary').click();assert.match(await p.locator('.status-guide').innerText(),/الشرح والتفاعل/);assert.match(await p.locator('.course-table').innerText(),/exercise1.test.ts/);
 assert.deepEqual(errors,[]);console.log('PASS student UI: five real lessons, no developer details, unfinished lessons without buttons, 20 visual captures, LTR and equality alignment, linked diagrams, live data, signs, concealment/grading, editable lab handoff, developer statuses, mobile and zero runtime/math errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

// Optional browser check: set PLAYWRIGHT_MODULE to an installed playwright-core.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
 const p=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
 p.setDefaultTimeout(10000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://fonts.googleapis.com/**',r=>r.abort());
 await p.goto(process.env.APP_URL||'http://127.0.0.1:4173/electrolab-dz/',{waitUntil:'domcontentloaded'});
 const exercise=p.locator('#exercise-one');
 await p.getByRole('button',{name:'فتح دائرة Exercise 1',exact:true}).click();
 assert.equal(await p.locator('.component').count(),5);
 assert.equal(await p.locator('.wire').count(),6);
 assert.equal(await exercise.locator('.step').count(),0);
 await p.getByRole('button',{name:'تشغيل المحاكاة',exact:true}).click();
 const rows=p.locator('.education:not(.exercise-one) .all-readings tbody tr');
 assert.match(await rows.nth(0).innerText(),/−?\-5/);
 assert.match(await rows.nth(1).innerText(),/8/);
 assert.match(await rows.nth(2).innerText(),/3/);
 await p.getByLabel('إجابة I1',{exact:true}).fill('-5');await p.getByLabel('إجابة I2',{exact:true}).fill('8');await p.getByLabel('إجابة I3',{exact:true}).fill('3');
 await exercise.getByRole('button',{name:'تصحيح المحاولة',exact:true}).click();
 assert.match(await exercise.getByRole('status').innerText(),/I1: صحيح · I2: صحيح · I3: صحيح/);
 await exercise.getByRole('button',{name:'إظهار الحل خطوة بخطوة',exact:true}).click();
 assert.equal(await exercise.locator('.step').count(),8);assert.equal(await exercise.getByRole('alert').count(),0);
 assert.ok(await exercise.locator('.katex').count()>25);
 await exercise.locator('[data-symbol]').first().click();assert.ok(await p.locator('.highlighted').count()>0);
 await exercise.getByRole('button',{name:'إبراز المسار 1',exact:true}).click();assert.equal(await p.locator('.highlighted').count(),2);
 // Move with real pointer events; save before/after to verify terminal identities.
 async function save(name){const event=p.waitForEvent('download');await p.getByRole('button',{name:'حفظ وتنزيل',exact:true}).click();const d=await event;await d.saveAs(name);return JSON.parse(require('fs').readFileSync(name,'utf8'));}
 const before=await save('/tmp/ex1-before.json');
 const component=p.locator('.component').first();await component.scrollIntoViewIfNeeded();const box=await component.boundingBox();
 await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+35,box.y+box.height/2+25,{steps:5});await p.mouse.up();
 await p.getByRole('button',{name:'تدوير',exact:true}).click();
 const moved=await save('/tmp/ex1-moved.json');assert.deepEqual(moved.wires,before.wires);assert.notEqual(moved.parts[0].rotation,before.parts[0].rotation);assert.notEqual(moved.parts[0].x,before.parts[0].x);
 await p.getByRole('button',{name:'تشغيل المحاكاة',exact:true}).click();assert.match(await rows.nth(0).innerText(),/-5/);
 await p.getByRole('button',{name:'عكس تيار العنصر 1',exact:true}).click();assert.match(await rows.nth(0).innerText(),/\t5\t/);
 await p.getByRole('button',{name:'عكس قطبية العنصر 1',exact:true}).first().click();assert.match(await rows.nth(0).innerText(),/-10/);assert.equal(await exercise.getByRole('alert').count(),0);
 // Draw a real ideal short, then restore editable saved circuit.
 const terminals=p.locator('.terminal');await terminals.nth(6).click();await terminals.nth(7).click();
 await p.getByRole('button',{name:'تشغيل المحاكاة',exact:true}).click();assert.match(await p.getByLabel('تشخيص التوصيلات').innerText(),/قصر/);
 await p.locator('input[type=file]').setInputFiles('/tmp/ex1-before.json');
 await p.getByRole('button',{name:'تشغيل المحاكاة',exact:true}).click();assert.match(await rows.nth(0).innerText(),/-5/);
 // Remove one wire using the actual wire selection hit target.
 await p.locator('.wire-hit').nth(2).click({force:true});await p.getByRole('button',{name:'حذف السلك المحدد',exact:true}).click();
 await p.getByRole('button',{name:'تشغيل المحاكاة',exact:true}).click();assert.match(await p.getByLabel('تشخيص التوصيلات').innerText(),/مفتوحة/);
 await p.locator('input[type=file]').setInputFiles('/tmp/ex1-before.json');await p.getByRole('button',{name:'تشغيل المحاكاة',exact:true}).click();
 await p.screenshot({path:'/tmp/exercise1-desktop.png',fullPage:true});
 await p.locator('svg[viewBox="0 0 960 490"]').screenshot({path:'/tmp/exercise1-canvas.png'});
 await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 for(const name of ['حالة تطوير المختبر · للمطور','حول المختبر','المختبر']) {await p.locator('.course-nav').getByRole('button',{name,exact:true}).click();assert.match(await p.locator('.creator-footer').innerText(),/Created & Developed by Oussama Azzouz/);if(name==='حالة تطوير المختبر · للمطور'){assert.equal(await p.locator('.course-table tbody tr').count(),94);assert.deepEqual(await p.locator('.course-counts strong').allTextContents(),['13','6','52','4']);assert.match(await p.locator('.course-table tbody tr').filter({hasText:'S-01'}).innerText(),/اجتاز الاختبارات/);}}
 assert.deepEqual(errors,[]);
 console.log('PASS Exercise 1: editable original circuit, currents, hidden correction, grading, eight KaTeX stages, linked highlighting, real drag/rotation, reference signs, drawn short/open diagnostics, JSON restore, mobile and creator footer.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await browser.newPage({acceptDownloads:true});p.setDefaultTimeout(12000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.goto(process.env.APP_URL||'http://127.0.0.1:4173/electrolab-dz/',{waitUntil:'domcontentloaded'});
 const addCap=()=>p.locator('.part-card').filter({hasText:'مكثف'}).click();
 const drop=()=>p.getByRole('button',{name:'حذف',exact:true}).click();
 const charts=p.locator('.rc-chart');
 await p.getByRole('button',{name:'دارة جديدة فارغة',exact:true}).click();
 await addCap();assert.equal(await charts.count(),5);
 await addCap();assert.equal(await p.locator('.component').count(),2);assert.equal(await charts.count(),0);assert.match(await p.locator('.rc-lab [role=alert]').innerText(),/مكثفًا واحدًا/);
 await addCap();assert.equal(await p.locator('.component').count(),3);assert.equal(await charts.count(),0);
 const download=p.waitForEvent('download');await p.getByRole('button',{name:'حفظ وتنزيل',exact:true}).click();await(await download).saveAs('/tmp/electrolab-multi-cap.json');
 await drop(); // third -> second
 await p.locator('.component').first().click();await drop(); // remove original model capacitor, keep the second
 assert.equal(await p.locator('.component').count(),1);assert.equal(await charts.count(),5);
 await p.locator('input[type=file]').setInputFiles('/tmp/electrolab-multi-cap.json');await p.locator('.component').nth(2).waitFor();assert.equal(await p.locator('.component').count(),3);assert.equal(await charts.count(),0);
 await p.locator('.component').last().click();await drop();await p.locator('.component').last().click();await drop();assert.equal(await charts.count(),5);
 // Running RC -> unsupported -> recovery must stop old playback and retain editing.
 await p.locator('.optional-experiments summary').click();await p.getByRole('button',{name:/شحن مكثف غير مشحون/}).click();
 await p.getByRole('button',{name:'تشغيل المحاكاة',exact:true}).click();
 await addCap();assert.equal(await p.locator('.component').count(),5);assert.equal(await charts.count(),0);await drop();assert.equal(await charts.count(),5);
 // The fix must keep voltage continuity across switch-only changes.
 await p.locator('.rc-controls').getByRole('button',{name:'تشغيل / استئناف',exact:true}).click();await p.waitForTimeout(220);await p.locator('.rc-controls').getByRole('button',{name:'إيقاف مؤقت',exact:true}).click();
 const before=Number((await charts.first().locator('strong').innerText()).split(' ')[0]);assert.ok(before>0);
 await p.locator('.component').nth(3).click();await p.getByRole('button',{name:'فتح المفتاح',exact:true}).click();
 const after=Number((await charts.first().locator('strong').innerText()).split(' ')[0]);assert.ok(Math.abs(before-after)<1e-5,`${before} -> ${after}`);
 await p.getByRole('button',{name:'إغلاق المفتاح',exact:true}).click();const closed=Number((await charts.first().locator('strong').innerText()).split(' ')[0]);assert.ok(Math.abs(after-closed)<1e-5);
 // Adding/deleting other selected RC parts also must not consume stale readings.
 await p.locator('.part-card').filter({hasText:'مقاومة'}).click();assert.equal(await charts.count(),5);await drop();assert.equal(await charts.count(),5);
 await p.setViewportSize({width:390,height:844});await addCap();assert.equal(await charts.count(),0);assert.ok(await p.locator('.rc-lab [role=alert]').isVisible());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.match(await p.locator('.creator-footer').innerText(),/Oussama Azzouz/);assert.deepEqual(errors,[]);
 console.log('PASS capacitor recovery: 1/2/3 capacitors, editable unsupported state, save/import, deleting original or added cap, running transitions, switch voltage continuity, other RC parts, mobile, no JS exceptions.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

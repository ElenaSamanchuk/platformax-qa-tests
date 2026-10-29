// Source: 29.10.2026 user brief, Encyclopedia filters acceptance criteria.
const fs=require('fs');
const {test,expect}=require('@playwright/test');
const {configuration}=require('../lib/configuration');
const {acquire,release}=require('../lib/coordination');
const {readOnlyContext,failureScreenshot}=require('./fixtures/read-only');
const {buildEvidence}=require('./fixtures/build-evidence');
const {filterLessons,groups}=require('../lib/encyclopedia-contracts');
test.use({video:'off',trace:'off',screenshot:'off'});
test.setTimeout(60000);

async function withEncyclopedia(browser,testInfo,mobile,fn){
  const base=configuration().baseURL;
  const state=process.env.ENC_STORAGE_STATE,path=process.env.ENC_PRODUCT_PATH;
  const userId=Number(process.env.ENC_EXPECTED_USER_ID);
  if(!state||!fs.existsSync(state)||!/^\/products\/\d+$/.test(path||'')||!Number.isSafeInteger(userId)||userId<1)
    throw Error('BLOCKED: private ENC_STORAGE_STATE, ENC_PRODUCT_PATH and ENC_EXPECTED_USER_ID required');
  const lock=acquire(process.env,'encyclopedia-filters');let context;
  try{
    context=await readOnlyContext(browser,{storageState:state,viewport:mobile?{width:390,height:844}:{width:1440,height:900},locale:'ru-RU',isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1});
    const page=await context.newPage();page.setDefaultTimeout(8000);
    const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});
    expect(response?.status()).toBe(200);expect(new URL(page.url()).pathname,'fixture access must open the requested product').toBe(path);
    const initial=JSON.parse(await page.locator('#app').getAttribute('data-page'));
    const data=await context.request.get(base+path,{maxRedirects:0,headers:{'X-Inertia':'true','X-Inertia-Version':initial.version,'X-Inertia-Partial-Component':initial.component,'X-Inertia-Partial-Data':'auth,isProduction,product,encyclopedia','X-Requested-With':'XMLHttpRequest',Accept:'text/html, application/xhtml+xml'}});
    expect(data.status()).toBe(200);const props=(await data.json()).props;
    expect(props.isProduction).toBe(false);expect(props.auth?.user?.id===userId,'confirmed QA identity; account data stays private').toBe(true);
    const encyclopedia=props.encyclopedia;
    expect(encyclopedia.filters_enabled).toBe(true);expect(encyclopedia.lessons.length,'tagged fixture required').toBeGreaterThan(0);
    await expect(page.getByRole('button',{name:'Фильтры',exact:true})).toBeVisible();
    await buildEvidence(page,testInfo);
    // Close test-environment toolbar using its own UI; never hide product UI.
    const debugClose=page.locator('.phpdebugbar-close-btn');
    if(await debugClose.isVisible())await debugClose.click();
    const panel=mobile?page.getByRole('dialog'):page.locator('#encyclopedia-filters');
    async function open(){await page.getByRole('button',{name:/^Фильтры(?: \(\d+\))?$/}).click();}
    async function choose(category,value){const c=encyclopedia.categories.find(c=>c.key===category);const label=c.options.find(o=>o.value===value).label;const included=panel.getByRole('button',{name:label,exact:true});await (await included.count()?included:panel.getByRole('button',{name:`Без: ${label}`,exact:true})).click();}
    async function assertResult(expected){
      // Collapsed cards remain in the DOM. Verify the complete result set and
      // counters, then disclosure visibility separately in ENC-3.
      const sections=page.locator('section:has(> .encyclopedia-disclosure)');
      const sorted=expected.filter(x=>!x.is_locked).map(x=>x.url).sort();
      await expect.poll(async()=>sections.locator('a[href*="video_id="]').evaluateAll(es=>es.map(e=>e.href).sort())).toEqual(sorted);
      const expectedGroups=groups(expected);
      expect(await sections.count()).toBe(expectedGroups.size);
      for(const [key,lessons] of expectedGroups){
        const section=sections.filter({has:page.getByRole('heading',{level:3,name:new RegExp('^'+lessons[0].section_label+'\\s'+lessons.length+'$')})});
        await expect(section).toHaveCount(1);
        expect(await section.locator('a[href*="video_id="]').count()).toBe(lessons.filter(x=>!x.is_locked).length);
      }
    }
    async function shot(name){const file=testInfo.outputPath(name+'.png');await page.screenshot({path:file,scale:'device'});await testInfo.attach(name,{path:file,contentType:'image/png'});}
    try{await fn({page,panel,encyclopedia,open,choose,assertResult,shot,base,path});}catch(error){await shot('failure-state').catch(()=>{});throw error;}
  }finally{try{if(context)await context.close().catch(e=>{if(!/Target .*closed/.test(e.message))throw e;});}finally{release(lock);}}
}

test('ENC-1 desktop: OR within category, AND across categories, equipment include/exclude/remove',async({browser},info)=>withEncyclopedia(browser,info,false,async({page,panel,encyclopedia:e,open,choose,assertResult,shot})=>{
  await open();await choose('body_area','neck');const neck=filterLessons(e.lessons,{body_area:['neck']});await assertResult(neck);
  await choose('body_area','shoulder');const union=filterLessons(e.lessons,{body_area:['neck','shoulder']});expect(union.length).toBeGreaterThan(neck.length);await assertResult(union);
  await choose('equipment','barbell');const narrowed=filterLessons(e.lessons,{body_area:['neck','shoulder'],equipment:['barbell']});expect(narrowed.length).toBeLessThan(union.length);await assertResult(narrowed);
  await choose('equipment','barbell');await expect(page.getByRole('button',{name:'Убрать фильтр: Без: Штанга',exact:true})).toBeVisible();await assertResult(filterLessons(e.lessons,{body_area:['neck','shoulder']},['barbell']));
  await choose('equipment','barbell');await expect(page.getByRole('button',{name:'Убрать фильтр: Без: Штанга',exact:true})).toHaveCount(0);await assertResult(union);await shot('or-and-equipment');
  await panel.getByRole('button',{name:'Сбросить',exact:true}).click();await expect(page.getByRole('button',{name:'Фильтры',exact:true})).toBeVisible();expect(new URL(page.url()).search).toBe('');
}));

test('ENC-2 desktop: neck plus barbell is empty and reset restores sections',async({browser},info)=>withEncyclopedia(browser,info,false,async({page,open,choose,encyclopedia:e,shot})=>{
  expect(filterLessons(e.lessons,{body_area:['neck'],equipment:['barbell']})).toEqual([]);
  await open();await choose('body_area','neck');await choose('equipment','barbell');await expect(page.getByText('Ничего не найдено. Попробуйте убрать часть фильтров',{exact:true})).toBeVisible();await shot('empty-neck-barbell');
  await page.getByRole('button',{name:'Сбросить',exact:true}).last().click();await expect(page.getByText('Ничего не найдено. Попробуйте убрать часть фильтров',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Фильтры',exact:true})).toBeVisible();expect(new URL(page.url()).search).toBe('');
}));

test('ENC-3 desktop: group disclosure and lesson Back preserve selected filters and results',async({browser},info)=>withEncyclopedia(browser,info,false,async({page,open,choose,encyclopedia:e,assertResult,shot,path,base})=>{
  await open();await choose('body_area','shoulder');const expected=filterLessons(e.lessons,{body_area:['shoulder']});await assertResult(expected);
  const section=page.locator('section:has(> .encyclopedia-disclosure)').filter({has:page.getByRole('heading',{level:3,name:/^Анатомия\s/})});const total=groups(expected).get('anatomy').length;expect(total).toBeGreaterThan(3);
  const expand=section.getByRole('button',{name:`Показать ещё (${total-3})`,exact:true});await expect(expand).toHaveAttribute('aria-expanded','false');
  await expand.click();await expect(section.getByRole('button',{name:'Свернуть',exact:true})).toHaveAttribute('aria-expanded','true');await expect(section.locator('.encyclopedia-disclosure')).not.toHaveAttribute('inert');await shot('expanded-group');
  await section.getByRole('button',{name:'Свернуть',exact:true}).click();await expect(section.locator('.encyclopedia-disclosure')).toHaveAttribute('inert','');
  const before=page.url();await section.locator('a[href*="video_id="]').first().click();await expect(page).not.toHaveURL(before);
  const back=page.locator(`a[href="${base}${path}"]`).filter({hasText:/Модуль.*Тема/});
  await expect(back).toBeVisible();await page.keyboard.press('Escape');await back.click();
  await expect(page).toHaveURL(url=>url.pathname===path);await shot('after-screen-back');await expect(page,'screen Back must retain the selected filter query').toHaveURL(before);await expect(page.getByRole('button',{name:'Убрать фильтр: Плечевой пояс и плечо',exact:true})).toBeVisible();await assertResult(expected);await shot('back-preserves-results');
  expect(new URL(page.url()).pathname).toBe(path);
}));

test('ENC-4 mobile emulation: initial accordion, show all, live count, close and reset',async({browser},info)=>withEncyclopedia(browser,info,true,async({page,panel,open,encyclopedia:e,shot})=>{
  await open();await expect(panel.getByRole('heading',{name:'Фильтры',exact:true})).toBeVisible();
  const request=panel.getByRole('button',{name:'Запрос клиента',exact:true}),body=panel.getByRole('button',{name:'Область тела',exact:true});
  await expect(request).toHaveAttribute('aria-expanded','true');for(const label of ['Область тела','Движение','Оборудование'])await expect(panel.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-expanded','false');
  await body.click();await expect(body).toHaveAttribute('aria-expanded','true');await expect(panel.getByRole('button',{name:/Показать все/}).first()).toBeVisible();await panel.getByRole('button',{name:'Показать все',exact:true}).first().click();await expect(panel.getByRole('button',{name:'Голеностоп и стопа',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'Шея',exact:true}).click();await expect(panel.getByRole('button',{name:`Показать ${filterLessons(e.lessons,{body_area:['neck']}).length}`,exact:true})).toBeVisible();await shot('mobile-sheet-selection');
  await panel.getByRole('button',{name:'Закрыть фильтры',exact:true}).click();await expect(panel).toHaveCount(0);await expect(page.getByRole('button',{name:'Убрать фильтр: Шея',exact:true})).toBeVisible();
  await open();if(await panel.getByRole('button',{name:'Область тела',exact:true}).getAttribute('aria-expanded')==='false')await panel.getByRole('button',{name:'Область тела',exact:true}).click();await expect(panel.getByRole('button',{name:'Шея',exact:true})).toHaveAttribute('aria-pressed','true');await panel.getByRole('button',{name:'Сбросить',exact:true}).click();await expect(panel.getByRole('button',{name:'Шея',exact:true})).toHaveAttribute('aria-pressed','false');await expect(panel.getByRole('button',{name:`Показать ${e.lessons.length}`,exact:true})).toBeVisible();await shot('mobile-reset');
}));

// Browser history is a separate path from the product's on-screen Back link.
test('ENC-5 desktop: browser Back restores selected filters and complete results',async({browser},info)=>withEncyclopedia(browser,info,false,async({page,open,choose,encyclopedia:e,assertResult,shot,path,base})=>{
  await open();await choose('body_area','shoulder');const expected=filterLessons(e.lessons,{body_area:['shoulder']});await assertResult(expected);const before=page.url();
  await page.locator('section:has(> .encyclopedia-disclosure) a[href*="video_id="]').first().click();await expect(page).not.toHaveURL(before);await expect(page.locator(`a[href="${base}${path}"]`).filter({hasText:/Модуль.*Тема/})).toBeVisible();
  await page.goBack({waitUntil:'domcontentloaded'});await expect(page).toHaveURL(before);await expect(page.getByRole('button',{name:'Убрать фильтр: Плечевой пояс и плечо',exact:true})).toBeVisible();await assertResult(expected);await shot('browser-back-preserves-filters');
}));

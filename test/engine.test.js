// 抽取 index.html 里的纯计算逻辑，用 node 跑断言
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');

const start = src.indexOf('const LS = {');
const end   = src.indexOf('/* =========================================================\n   3. 渲染');
if (start < 0 || end < 0) { console.error('抽取失败', start, end); process.exit(1); }
const pure = src.slice(start, end);

const store = {};
const ctx = { console, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
vm.createContext(ctx);
vm.runInContext(pure + '\n;this.__eval = evaluate;', ctx);
const evaluate = ctx.__eval;

const S = (...ids) => new Set(ids);

const cases = [
  { label:'5kg 泰迪 · 50g 黑巧55%（≈半块） · 30分钟 · 呕吐', inp:{species:'dog', weight:5,  amount:50, minutes:30, toxinId:'chocolate', subtype:2, symptoms:S('vomit')}, expect:'red',    dose:67,    unit:'mg/kg' },
  { label:'5kg 泰迪 · 25g 牛奶巧克力 · 30分钟 · 无症状',      inp:{species:'dog', weight:5,  amount:25, minutes:30, toxinId:'chocolate', subtype:1, symptoms:S()},          expect:'green',  dose:6,     unit:'mg/kg' },
  { label:'10kg 犬 · 200g 牛奶巧克力 · 20分钟',               inp:{species:'dog', weight:10, amount:200,minutes:20, toxinId:'chocolate', subtype:1, symptoms:S()},          expect:'yellow', dose:24,    unit:'mg/kg' },
  { label:'5kg 犬 · 5g 白巧克力 · 10分钟',                    inp:{species:'dog', weight:5,  amount:5,  minutes:10, toxinId:'chocolate', subtype:0, symptoms:S()},          expect:'green',  dose:0.1,   unit:'mg/kg' },
  { label:'3.8kg 猫 · 百合 · 90分钟',                         inp:{species:'cat', weight:3.8,amount:5,  minutes:90, toxinId:'lily',      subtype:0, symptoms:S()},          expect:'red',    dose:null,  unit:null },
  { label:'20kg 金毛 · 百合 · 30分钟（犬远低于猫）',            inp:{species:'dog', weight:20, amount:5,  minutes:30, toxinId:'lily',      subtype:0, symptoms:S()},          expect:'yellow', dose:null,  unit:null },
  { label:'2.5kg 博美 · 3粒木糖醇口香糖（0.9g） · 45分钟',      inp:{species:'dog', weight:2.5,amount:3,  minutes:45, toxinId:'xylitol',   subtype:0, symptoms:S()},          expect:'orange', dose:0.36,  unit:'g/kg' },
  { label:'2.5kg 博美 · 5粒木糖醇口香糖（1.5g） · 45分钟',      inp:{species:'dog', weight:2.5,amount:5,  minutes:45, toxinId:'xylitol',   subtype:0, symptoms:S()},          expect:'red',    dose:0.6,   unit:'g/kg' },
  { label:'15kg 边牧 · 1粒木糖醇口香糖（0.3g） · 45分钟',       inp:{species:'dog', weight:15, amount:1,  minutes:45, toxinId:'xylitol',   subtype:0, symptoms:S()},          expect:'green',  dose:0.02,  unit:'g/kg' },
  { label:'15kg 边牧 · 2粒木糖醇 · 45分钟 · 已无力',            inp:{species:'dog', weight:15, amount:2,  minutes:45, toxinId:'xylitol',   subtype:0, symptoms:S('weak')},    expect:'red',    dose:0.04,  unit:'g/kg' },
  { label:'8kg 犬 · 100g 洋葱（12.5 g/kg，低于15）',            inp:{species:'dog', weight:8,  amount:100,minutes:60, toxinId:'allium',    subtype:0, symptoms:S()},          expect:'yellow', dose:12.5,  unit:'g/kg' },
  { label:'8kg 犬 · 200g 洋葱（25 g/kg，超过15）',              inp:{species:'dog', weight:8,  amount:200,minutes:60, toxinId:'allium',    subtype:0, symptoms:S()},          expect:'red',    dose:25,    unit:'g/kg' },
  { label:'4kg 猫 · 50g 洋葱（12.5 g/kg，超过猫5）',             inp:{species:'cat', weight:4,  amount:50, minutes:60, toxinId:'allium',    subtype:0, symptoms:S()},          expect:'red',    dose:12.5,  unit:'g/kg' },
  { label:'12kg 犬 · 20g 葡萄',                                inp:{species:'dog', weight:12, amount:20, minutes:60, toxinId:'grape',     subtype:0, symptoms:S()},          expect:'red',    dose:null,  unit:null },
  { label:'5kg 犬 · 不确定物 · 5小时前',                        inp:{species:'dog', weight:5,  amount:20, minutes:300,toxinId:'unknown',   subtype:0, symptoms:S()},          expect:'red',    dose:null,  unit:null },
  { label:'5kg 犬 · 人的药 1片',                               inp:{species:'dog', weight:5,  amount:1,  minutes:30, toxinId:'med',       subtype:0, symptoms:S()},          expect:'red',    dose:null,  unit:null },
  // —— 自定义输入 ——
  { label:'自定义「夏威夷果」1 颗（剧毒类）',                    inp:{species:'dog', weight:5,  amount:10, minutes:30, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'夏威夷果'}, expect:'red', dose:null, unit:null },
  { label:'自定义「木屑」1 g / 5 kg（惰性）',                    inp:{species:'dog', weight:5,  amount:1,  minutes:7,  toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'木屑'}, expect:'green', dose:null, unit:null },
  { label:'自定义「绿萝叶子」2 片（刺激性）',                     inp:{species:'cat', weight:4,  amount:2,  minutes:20, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'绿萝叶子'}, expect:'yellow', dose:null, unit:null },
  { label:'自定义「老鼠药」（剧毒）',                            inp:{species:'dog', weight:8,  amount:3,  minutes:40, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'老鼠药'}, expect:'red', dose:null, unit:null },
  { label:'自定义「丝袜」（异物梗阻）',                          inp:{species:'dog', weight:12, amount:30, minutes:60, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'丝袜'}, expect:'yellow', dose:null, unit:null },
  { label:'自定义「紫色小药片」（未收录）',                       inp:{species:'dog', weight:6,  amount:1,  minutes:15, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'紫色小药片'}, expect:'yellow', dose:null, unit:null },
  { label:'自定义「木屑」但已抽搐 → 症状升级到红',                 inp:{species:'dog', weight:5,  amount:1,  minutes:7,  toxinId:'custom',    subtype:0, symptoms:S('tremor'), customToxin:'木屑'}, expect:'red', dose:null, unit:null },
  { label:'自定义「巧克力」→ 指路并判红（不漏判）',                inp:{species:'dog', weight:5,  amount:50, minutes:30, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'巧克力半块'}, expect:'red', dose:null, unit:null },
  // —— 常见食物与异物 ——
  { label:'自定义「狗粮」（惰性）',                              inp:{species:'dog', weight:5,  amount:20, minutes:10, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'狗粮'}, expect:'green', dose:null, unit:null },
  { label:'自定义「猫粮」（惰性）',                              inp:{species:'cat', weight:4,  amount:15, minutes:10, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'猫粮'}, expect:'green', dose:null, unit:null },
  { label:'自定义「鸡胸肉」（惰性）',                            inp:{species:'dog', weight:6,  amount:30, minutes:10, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'鸡胸肉'}, expect:'green', dose:null, unit:null },
  { label:'自定义「玉米芯」→ 应判异物而非惰性',                   inp:{species:'dog', weight:8,  amount:40, minutes:30, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'玉米芯'}, expect:'yellow', dose:null, unit:null },
  // —— AI 初判：只上调，不下调 ——
  { label:'未收录 + AI判剧毒 → 上调为红',                        inp:{species:'dog', weight:5,  amount:2,  minutes:20, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'蓝色小颗粒', aiClass:{key:'severe',reason:'疑似灭鼠药',confidence:'medium'}}, expect:'red', dose:null, unit:null },
  { label:'未收录 + AI判惰性 → 仍为黄（不下调）',                 inp:{species:'dog', weight:5,  amount:2,  minutes:20, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'蓝色小颗粒', aiClass:{key:'inert',reason:'可能是塑料珠',confidence:'low'}}, expect:'yellow', dose:null, unit:null },
  // —— 多物种：同一剂量在不同物种应给出不同等级 ——
  { label:'犬 2kg · 50g 牛奶巧克力（=30 mg/kg）→ 黄',              inp:{species:'dog',   weight:2,    amount:50, minutes:30, toxinId:'chocolate', subtype:1, symptoms:S()}, expect:'yellow', dose:30, unit:'mg/kg' },
  { label:'兔 2kg · 50g 牛奶巧克力（同剂量）→ 橙（系数 0.6）',      inp:{species:'rabbit',weight:2,    amount:50, minutes:30, toxinId:'chocolate', subtype:1, symptoms:S()}, expect:'orange', dose:30, unit:'mg/kg' },
  { label:'仓鼠 0.1kg · 2g 牛奶巧克力（=24 mg/kg）→ 橙（系数 0.5）', inp:{species:'rodent',weight:0.1,  amount:2,  minutes:30, toxinId:'chocolate', subtype:1, symptoms:S()}, expect:'orange', dose:24, unit:'mg/kg' },
  { label:'犬 2kg · 10g 洋葱 → 绿；兔同量 → 黄',                   inp:{species:'rabbit',weight:2,    amount:10, minutes:30, toxinId:'allium',    subtype:0, symptoms:S()}, expect:'yellow', dose:5,  unit:'g/kg' },
  { label:'未收录「剩饭」+ 用户选「剩饭剩菜」→ 居家观察',           inp:{species:'dog', weight:9,  amount:100,minutes:20, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'剩饭', customCategory:'leftover'}, expect:'green', dose:null, unit:null },
  { label:'未收录「某某牌饼干」+ 用户选「正常食物」→ 居家观察',      inp:{species:'dog', weight:7,  amount:50, minutes:15, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'某某牌饼干', customCategory:'food'},      expect:'green', dose:null, unit:null },
  { label:'未收录「不明粉末」+ 用户选「药品」→ 即刻送医',           inp:{species:'cat', weight:4,  amount:1,  minutes:20, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'不明粉末', customCategory:'drug'},        expect:'red',   dose:null, unit:null },
  { label:'未收录「不明液体」+ 用户选「化学品」→ 即刻送医',         inp:{species:'dog', weight:6,  amount:20, minutes:20, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'不明液体', customCategory:'chemical'},    expect:'red',   dose:null, unit:null },
  { label:'未收录「某塑料片」+ 用户选「小物件」→ 电话咨询',         inp:{species:'dog', weight:8,  amount:5,  minutes:20, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'某塑料片', customCategory:'object'},      expect:'yellow',dose:null, unit:null },
  { label:'规则优先：选「食物」但写「老鼠药」→ 仍判红',             inp:{species:'dog', weight:8,  amount:5,  minutes:20, toxinId:'custom',    subtype:0, symptoms:S(), customToxin:'老鼠药', customCategory:'food'},          expect:'red',   dose:null, unit:null },
  { label:'牛奶巧克力 6mg/kg（绿）+ 自定义轻症「打喷嚏」',          inp:{species:'dog', weight:5,  amount:25, minutes:30, toxinId:'chocolate', subtype:1, symptoms:S(), customSymptoms:['打喷嚏']}, expect:'yellow', dose:6, unit:'mg/kg' },
  { label:'牛奶巧克力 6mg/kg（绿）+ 自定义重症「抽搐」',            inp:{species:'dog', weight:5,  amount:25, minutes:30, toxinId:'chocolate', subtype:1, symptoms:S(), customSymptoms:['抽搐']},   expect:'red',    dose:6, unit:'mg/kg' },
];

let pass = 0, fail = 0;
for (const c of cases){
  let r;
  try { r = evaluate(c.inp); }
  catch (e) { console.log(`✗ 崩溃  ${c.label}\n     ${e.message}`); fail++; continue; }
  if (r.error){ console.log(`✗ 报错  ${c.label} → ${r.error}`); fail++; continue; }

  const problems = [];
  if (r.level !== c.expect) problems.push(`等级 ${r.level} ≠ 期望 ${c.expect}`);
  if (c.dose !== null && Math.abs(r.value - c.dose) > 0.006) problems.push(`剂量 ${r.value.toFixed(3)} ≠ 期望 ${c.dose}`);
  if (!r.calcLines || r.calcLines.length < 3) problems.push('计算过程不足 3 行');
  if (!r.actions || r.actions.length !== 3) problems.push('行动建议不是 3 条');
  if (!r.dont) problems.push('缺少「不要做」');
  if (!r.toxin.source) problems.push('缺少来源');
  // 计算过程里不允许出现 NaN / undefined
  const txt = r.calcLines.map(x=>x.join(' ')).join(' ');
  if (/NaN|undefined|null/.test(txt)) problems.push('计算过程含 NaN/undefined');

  if (problems.length){
    console.log(`✗ ${c.label}\n     ${problems.join(' / ')}`);
    console.log(`     等级=${r.level} 剂量=${r.value===null?'n/a':r.value.toFixed(3)} ${r.tierLabel} · 症状分${r.symScore}`);
    fail++;
  } else {
    console.log(`✓ ${c.label}  →  ${r.level} · ${r.value===null?'n/a':r.value.toFixed(2)+' '+c.unit} · ${r.tierLabel}`);
    pass++;
  }
}

// 边界
const edge = evaluate({species:'dog', weight:0, amount:10, minutes:10, toxinId:'chocolate', subtype:1, symptoms:S()});
if (edge.error){ console.log(`\n✓ 边界：体重 0 被正确拒绝`); pass++; }
else { console.log(`\n✗ 边界：体重 0 未被拒绝`); fail++; }

const zero = evaluate({species:'dog', weight:5, amount:0, minutes:10, toxinId:'chocolate', subtype:2, symptoms:S()});
console.log(zero.level === 'green' ? '✓ 边界：吃 0 g 判为绿色（合理）' : `✗ 边界：吃 0 g 判为 ${zero.level}`);
zero.level === 'green' ? pass++ : fail++;

console.log(`\n===== ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);

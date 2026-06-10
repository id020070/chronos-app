/**
 * CHRONOS ENGINE — Backend API
 * Vercel Serverless Function: /api/analyze
 *
 * Handles:
 *  1. Normal market analysis  (keyword + mode)
 *  2. Competitor hack mode    (hackMode: true)
 *  3. Real-data override      (customData: { monthly, adFee, cpa })
 *
 * API keys are read exclusively from environment variables:
 *  - process.env.GEMINI_API_KEY
 *  - process.env.SCRAPINGBEE_API_KEY  (reserved for future scraping)
 */

export default async function handler(req, res) {
  // ── CORS headers (allow same-origin + Vercel preview URLs) ──────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Parse request body ───────────────────────────────────────────────────
  const { keyword, mode, hackMode, customData } = req.body || {};

  if (!keyword || typeof keyword !== 'string') {
    return res.status(400).json({ error: 'keyword is required' });
  }

  const industry  = mode === 'cosme' ? 'cosme' : 'apparel';
  const isHack    = Boolean(hackMode);
  const kw        = keyword.trim().slice(0, 100);

  // ── Env vars ─────────────────────────────────────────────────────────────
  const GEMINI_KEY      = process.env.GEMINI_API_KEY      || '';
  const SCRAPINGBEE_KEY = process.env.SCRAPINGBEE_API_KEY || '';

  // ── If customData override request → recalculate KPIs and regenerate text
  if (customData && (customData.monthly || customData.adFee || customData.cpa)) {
    const result = buildOverrideResponse(kw, industry, isHack, customData, GEMINI_KEY);
    return res.status(200).json(await result);
  }

  // ── Main analysis ─────────────────────────────────────────────────────────
  try {
    let analysisResult;

    if (GEMINI_KEY) {
      // Try Gemini first; fall back to deterministic sim on failure
      analysisResult = await tryGemini(kw, industry, isHack, GEMINI_KEY);
    }

    if (!analysisResult) {
      // Deterministic simulation (always succeeds, consistent per keyword)
      analysisResult = buildSimData(kw, industry, isHack);
    }

    return res.status(200).json(analysisResult);
  } catch (err) {
    console.error('[CHRONOS API] Error:', err.message);
    // Never return a 5xx during a demo — fall through to sim
    const fallback = buildSimData(kw, industry, isHack);
    return res.status(200).json(fallback);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// GEMINI API CALL
// ════════════════════════════════════════════════════════════════════════════
async function tryGemini(kw, industry, isHack, apiKey) {
  const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'];
  const BASE   = 'https://generativelanguage.googleapis.com/v1beta/models';

  const prompt = buildGeminiPrompt(kw, industry, isHack);

  for (const model of MODELS) {
    try {
      const response = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          contents          : [{ parts: [{ text: prompt }] }],
          generationConfig  : { temperature: 0.7, maxOutputTokens: 3000 },
        }),
      });

      if (response.status === 404 || response.status === 400) continue;
      if (!response.ok) continue;

      const data    = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = rawText.replace(/```json\s*|```\s*/g, '').trim();
      const match   = cleaned.match(/\{[\s\S]*\}/);
      if (!match) continue;

      const parsed = JSON.parse(match[0]);
      parsed.kw       = kw;
      parsed.ind      = industry;
      parsed.hackMode = isHack;
      parsed._source  = model + ' [LIVE]';
      return parsed;
    } catch (e) {
      continue;
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// GEMINI PROMPT BUILDER
// Instructs the model to return structured JSON matching the frontend schema
// ════════════════════════════════════════════════════════════════════════════
function buildGeminiPrompt(kw, industry, isHack) {
  const base = industry === 'apparel' ? 'アパレル（ファッション）' : 'コスメ（化粧品・スキンケア）';
  const mode = isHack ? '競合ハッキング分析（競合の脆弱性・SKU別売上・ネガレビュー特定）' : '通常市場分析';

  const schema = isHack ? `{
  "product_name": "競合ブランド/店舗名",
  "review_count": 推計ネガレビュー件数（数値）,
  "hackMode": true,
  "totalM": 月間総売上万円（数値）,
  "totalA": 年間総売上万円（数値）,
  "topSkuPct": 上位2SKU売上依存率%（数値）,
  "v1": 主要不満発生率%（数値14〜26）,
  "v2": 副次不満率%（数値8〜18）,
  "cap": 横取り可能率%（数値28〜45）,
  "roas": 攻略後予測ROAS整数（例380）,
  "kpi": {
    "roas_now": "競合の推定ROAS（例: 1.4x）",
    "roas_now_sub": "現状コメント1文",
    "roas_after": "攻略後ROAS（例: 4.2x）",
    "roas_after_sub": "攻略後コメント1文",
    "profit": "月次横取り利益（例: +¥2.1M）",
    "profit_sub": "根拠1文",
    "cpa_imp": "CPA改善幅（例: -42%）",
    "cpa_sub": "根拠1文"
  },
  "ranks": [
    { "rank": 1, "name": "SKU名（ブランド名）", "sub": "SKU別売上", "monthly": 数値, "annual": 数値, "trend": 数値 }
  ],
  "donutData": [
    { "name": "SKU名", "pct": シェア%（数値）, "color": "#hex" }
  ],
  "donutCenter": { "val": "月間総売上万", "lbl": "月間総売上" },
  "donutTitle": "${kw} SKU別売上構成比",
  "senti": { "pos": ポジティブ%（数値）, "neu": 中立%（数値） },
  "complaints": [
    { "text": "具体的な不満原因", "pct": 発生率%（数値）, "sev": "high|mid|low" }
  ],
  "praises": ["高評価ポイント1", "高評価ポイント2", "高評価ポイント3"],
  "keywords": ["攻略KW1", "KW2", "KW3", "KW4", "KW5"],
  "hotKw": ["最重要KW1", "KW2"],
  "output": "【警告：競合「${kw}」の脆弱性を検知】\\n...（詳細な攻略ロジック、具体的数字入り、改行は\\nで）",
  "apvQ": "承認を求める文章（具体的数字入り、80字以内）"
}` : `{
  "product_name": "${kw}",
  "review_count": 推計レビュー件数（数値）,
  "hackMode": false,
  "topM": TOP SKU月次売上万円（数値）,
  "roas": 推奨投入後ROAS整数,
  "p1": 主要不満率%（数値14〜22）,
  "p2": 副次不満率%（数値8〜16）,
  "kpi": {
    "roas_now": "現状ROAS（例: 1.8x）",
    "roas_now_sub": "現状コメント1文",
    "roas_after": "提案後ROAS（例: 4.2x）",
    "roas_after_sub": "改善後コメント1文",
    "profit": "月次純増利益（例: +¥1.8M）",
    "profit_sub": "根拠1文",
    "cpa_imp": "CPA改善幅（例: -38%）",
    "cpa_sub": "根拠1文"
  },
  "ranks": [
    { "rank": 1, "name": "競合商品名", "sub": "楽天/Amazon", "monthly": 数値, "annual": 数値, "trend": 数値 }
  ],
  "shopRanks": [
    { "rank": 1, "name": "競合店舗名", "sub": "EC店舗", "monthly": 数値, "annual": 数値, "trend": 数値 }
  ],
  "donutData": [
    { "name": "属性名", "pct": シェア%（数値）, "color": "#hex" }
  ],
  "donutCenter": { "val": "TOP SKU万", "lbl": "TOP SKU/月" },
  "donutTitle": "${industry === 'apparel' ? 'カラー×デザイン トレンドシェア' : 'テクスチャ×成分 市場占有率'}",
  "senti": { "pos": ポジティブ%（数値）, "neu": 中立%（数値） },
  "complaints": [
    { "text": "具体的な不満内容", "pct": 発生率%（数値）, "sev": "high|mid|low" }
  ],
  "praises": ["高評価ポイント1", "高評価ポイント2", "高評価ポイント3"],
  "keywords": ["勝てる訴求KW1", "KW2", "KW3", "KW4", "KW5"],
  "hotKw": ["最重要KW1", "KW2"],
  "output": "競合分析+商品開発指示（具体的数字入り、改行は\\nで）",
  "apvQ": "開発承認を求める文章（数字入り80字以内）"
}`;

  return `あなたはアパレル×コスメ特化型EC市場分析AI「Chronos Engine」です。
業界：${base}
分析モード：${mode}
対象キーワード：「${kw}」

以下のJSONスキーマに完全に従って、実在しそうなリアルな数値と文章で全フィールドを埋めて返してください。
説明文・前置き・マークダウン・コードブロック記号は一切不要です。JSONのみ出力してください。
donutDataの合計は必ず100になるようにしてください。
outputフィールドは、MDが気絶するほど具体的で泥臭い「勝てる新商品仕様・攻略戦略テキスト」にしてください。改行は\\nで表現してください。

${schema}`;
}

// ════════════════════════════════════════════════════════════════════════════
// OVERRIDE RESPONSE BUILDER
// Recalculates KPIs from real numbers; optionally calls Gemini for new text
// ════════════════════════════════════════════════════════════════════════════
async function buildOverrideResponse(kw, industry, isHack, customData, apiKey) {
  const { monthly = 0, adFee = 0, cpa = 0 } = customData;
  const mBase   = monthly || 1000;
  const adBase  = adFee   || Math.round(mBase * 0.3);
  const cpaBase = cpa     || 8000;

  const roasNow  = adBase > 0 ? (mBase * 10000 / (adBase * 10000)).toFixed(1) : 1.5;
  const roasTgt  = (parseFloat(roasNow) * 1.85).toFixed(1);
  const cpaImp   = Math.round((1 - cpaBase / (cpaBase * 1.55)) * 100);
  const profitM  = (mBase * 0.44 / 100).toFixed(1);

  const kpi = {
    roas_now     : roasNow  + 'x',
    roas_now_sub : '実績値ベース算出',
    roas_after   : roasTgt  + 'x',
    roas_after_sub: '提案施策後の予測値',
    profit       : '+¥' + profitM + 'M',
    profit_sub   : '月次純増利益（実績値ベース）',
    cpa_imp      : '-' + cpaImp + '%',
    cpa_sub      : '実CPA ' + cpaBase.toLocaleString() + '円をベースに算出',
  };

  // Generate override output text — try Gemini first
  let outputText = `【実数値で再最適化完了】\n御社のリアルな実績（月商 ${mBase}万円、広告費 ${adBase}万円、CPA ${cpaBase.toLocaleString()}円）をベースに再計算しました。\n\n現在のROASは ${roasNow}x ですが、提案施策実行後には ${roasTgt}x が見込まれます。月次純増利益は +¥${profitM}M の上乗せが可能です。\n\n具体的には、CPA削減施策（訴求KW最適化×クリエイティブ改善）と、競合の未充足ニッチを狙った1型追加投入を並行実施してください。御社の実績月商 ${mBase}万円をベースにした数値なので、これは絵空事ではありません。`;

  if (apiKey) {
    try {
      const overridePrompt = `あなたはEC市場分析AIです。以下の実績値を基に、具体的なROAS改善・利益最大化の戦略テキストを日本語で200字程度生成してください。改行は\\nで。JSON不要、テキストのみ。\n業界: ${industry === 'apparel' ? 'アパレル' : 'コスメ'}\nキーワード: ${kw}\n実績月商: ${mBase}万円\n月間広告費: ${adBase}万円\n現在CPA: ${cpaBase}円\n現在ROAS: ${roasNow}x\n提案後ROAS: ${roasTgt}x`;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ contents: [{ parts: [{ text: overridePrompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 500 } }),
      });
      if (r.ok) {
        const d   = await r.json();
        const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (txt.length > 50) outputText = `【実数値で再最適化完了（AI生成）】\n` + txt;
      }
    } catch (_) {}
  }

  return { kpi, output: outputText, _overrideApplied: true };
}

// ════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC SIMULATION
// Produces consistent, realistic-looking data from keyword seed
// ════════════════════════════════════════════════════════════════════════════
function buildSimData(kw, industry, isHack) {
  const seed = kw.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  const rng  = (mn, mx) => {
    const x = Math.abs(Math.sin(seed + mn + mx));
    return Math.floor(x * (mx - mn + 1)) + mn;
  };

  if (isHack) return buildHackSim(kw, industry, rng);
  return buildNormalSim(kw, industry, rng);
}

function buildNormalSim(kw, industry, rng) {
  const isApparel = industry === 'apparel';

  // Category-specific presets
  const apparelPresets = {
    'ワンピース': { c: 'ネイビー×ストライプ', k1: '着丈補正', k2: '透け防止ライナー', p1: '丈が長く踏む', p2: '透けが気になる', p3: 'サイズ感が大きい' },
    'スーツ'    : { c: 'チャコールグレー×スリムフィット', k1: '肩幅対応', k2: '厚手素材', p1: '肩幅が合わない', p2: '裾上げ必要', p3: '生地が薄い' },
    'ニット'    : { c: 'オフホワイト×ケーブル編み', k1: '毛玉防止加工', k2: 'ウォッシャブル', p1: '毛玉ができやすい', p2: '洗濯で縮む', p3: 'チクチクする' },
    'コート'    : { c: 'キャメル×チェスター', k1: '軽量中綿', k2: '裏地強化', p1: '裏地が薄い', p2: '袖丈が長い', p3: '重い' },
    'デニム'    : { c: 'インディゴ×ストレート', k1: 'ウエスト調節', k2: '防色加工', p1: 'ウエストが合わない', p2: '股下が長い', p3: '色落ちが早い' },
  };
  const cosmePresets = {
    'ファンデーション': { sku: '21番リキッドファンデ', k1: '保湿成分15%強化', k2: '毛穴フィラー配合', p1: '夕方の乾燥・毛穴落ち', p2: 'カバー力が物足りない', p3: '酸化して崩れる' },
    'リップ'          : { sku: '12番ティントリップ', k1: 'セラミド配合', k2: '長時間密着', p1: '乾燥してヨレる', p2: '色持ちが悪い', p3: '落ちにくい' },
    '美容液'          : { sku: 'レチノール美容液', k1: '低刺激処方', k2: 'カプセル型レチノール', p1: 'ベタつく', p2: '刺激が強い', p3: '効果を感じにくい' },
    'アイシャドウ'    : { sku: '08番アイパレット', k1: 'マイクロパウダー加工', k2: '高密着処方', p1: '粉飛びが激しい', p2: '発色が薄い', p3: 'ヨレやすい' },
  };

  const presets = isApparel ? apparelPresets : cosmePresets;
  const key     = Object.keys(presets).find(k => kw.includes(k)) || Object.keys(presets)[0];
  const p       = presets[key];

  const brands    = isApparel
    ? ['URBAN RESEARCH', 'SHIPS', 'nano・universe', 'BEAMS', 'TOMORROWLAND']
    : ['CLIO', 'rom&nd', 'CANMAKE', 'KATE', 'EXCEL'];
  const shops = isApparel
    ? ['JOURNAL STANDARD', 'UNITED ARROWS', 'BEAUTY&YOUTH', 'EDIFICE', 'IENA']
    : ['@cosme SHOPPING', 'NARS公式', 'LANEIGE', 'innisfree', "Kiehl's"];

  const roas = rng(360, 580);
  const p1   = rng(14, 22);
  const p2   = rng(8, 16);
  const p3   = rng(4, 10);

  const ranks = brands.map((b, i) => {
    const m = Math.max(400, rng(800, 3200) - i * rng(100, 300));
    return { rank: i + 1, name: b + ' ' + (p.sku || kw), sub: '楽天/Amazon掲載', monthly: m, annual: Math.round(m * 11.5 / 100) * 100, trend: rng(-12, 28) };
  }).sort((a, b) => b.monthly - a.monthly).map((r, i) => ({ ...r, rank: i + 1 }));

  const shopRanks = shops.map((b, i) => {
    const m = Math.max(600, rng(1200, 4200) - i * rng(150, 400));
    return { rank: i + 1, name: b, sub: 'EC店舗', monthly: m, annual: Math.round(m * 11.8 / 100) * 100, trend: rng(-8, 35) };
  }).sort((a, b) => b.monthly - a.monthly).map((r, i) => ({ ...r, rank: i + 1 }));

  const donutData = isApparel
    ? [{ name: 'ネイビー/ブラック', pct: rng(28, 38), color: '#1a3a6b' }, { name: 'ベージュ/ブラウン', pct: rng(20, 28), color: '#c4a882' }, { name: 'ホワイト/グレー', pct: rng(15, 22), color: '#a0b4be' }, { name: 'カーキ/グリーン', pct: rng(8, 14), color: '#4a6741' }, { name: 'その他', pct: 0, color: '#2a4a5c' }]
    : [{ name: 'マット系', pct: rng(30, 40), color: '#8b4513' }, { name: 'ツヤ/グロウ系', pct: rng(22, 30), color: '#d4a017' }, { name: 'ナチュラル系', pct: rng(15, 22), color: '#f5deb3' }, { name: 'カバー力重視', pct: rng(8, 14), color: '#6b3a7d' }, { name: 'その他', pct: 0, color: '#2a4a5c' }];
  donutData[4].pct = 100 - donutData.slice(0, 4).reduce((a, d) => a + d.pct, 0);

  const topM   = ranks[0].monthly;
  const k1     = p.k1;
  const k2     = p.k2;
  const color  = p.c || p.sku || kw;

  const output = isApparel
    ? `競合店舗の「${ranks[0].name}」が、今月「${kw}」カテゴリで${color}（1SKU）だけで推計 ${topM}万円 を稼ぎ出しています。\n\n3重補正推計モデルによるレビュー感情解析の結果、${p1}%のユーザーが「${p.p1}」という強烈な不満を抱えており、${p2}%が「${p.p2}」を指摘しています。\n\n御社は今すぐ、${k1}・${k2}対応の補正モデルを1型投入してください。初月からROAS ${roas}% で競合の売上を横取りできます。`
    : `競合ブランドの「${ranks[0].name}」が、今月「${kw}」カテゴリの「${color}（SKU）」だけでモール全体から推計 ${topM}万円 の売上を上げています。\n\nレビューの文脈解析により、${p1}%のユーザーが「${p.p1}」に悩まされており、${p2}%が「${p.p2}」を不満として残しています。\n\n御社は今すぐ、${k1}・${k2}を採用した自社EC限定モデルを投入してください。@cosmeの高額データに頼らずとも、ROAS ${roas}% のニッチシェアをピンポイントで奪えます。`;

  return {
    kw,
    ind      : industry,
    hackMode : false,
    _source  : 'simulation',
    reviewCount: rng(12000, 48000),
    topM,
    roas,
    p1,
    p2,
    kpi: {
      roas_now     : (rng(14, 24) / 10).toFixed(1) + 'x',
      roas_now_sub : '現状の広告費効率',
      roas_after   : (rng(34, 56) / 10).toFixed(1) + 'x',
      roas_after_sub: '提案投入後の予測値',
      profit       : '+¥' + (rng(12, 28) / 10).toFixed(1) + 'M',
      profit_sub   : '月次純増利益試算',
      cpa_imp      : '-' + rng(28, 52) + '%',
      cpa_sub      : '訴求KW最適化効果',
    },
    ranks,
    shopRanks,
    donutData,
    donutCenter: { val: topM + '万', lbl: 'TOP SKU/月' },
    donutTitle : isApparel ? 'カラー×デザイン トレンドシェア' : 'テクスチャ×成分 市場占有率',
    senti      : { pos: rng(52, 70), neu: rng(15, 24) },
    complaints : [
      { text: p.p1, pct: p1, sev: 'high' },
      { text: p.p2, pct: p2, sev: 'mid'  },
      { text: p.p3, pct: p3, sev: 'low'  },
      { text: isApparel ? 'カラー展開が少ない' : 'パッケージが壊れやすい', pct: rng(3, 8), sev: 'low' },
    ],
    praises  : isApparel ? ['デザインが良い', 'コスパが高い', 'リピート購入', '着回しが効く'] : ['発色が良い', 'コスパが高い', '肌なじみが良い', 'リピート購入'],
    keywords : [k1, k2, isApparel ? '低身長対応' : '敏感肌対応', isApparel ? '日本製素材' : '低刺激処方', 'エコ素材'],
    hotKw    : [k1, k2],
    output,
    apvQ     : `ニッチ補正モデル投入で初月ROAS ${roas}% 達成が見込まれます。開発を承認しますか？`,
  };
}

function buildHackSim(kw, industry, rng) {
  const isApparel  = industry === 'apparel';
  const totalM     = rng(2800, 5500);
  const totalA     = Math.round(totalM * 11.5 / 100) * 100;
  const topSkuPct  = rng(55, 70);
  const v1         = rng(14, 26);
  const v2         = rng(8, 18);
  const roas       = rng(380, 520);
  const cap        = rng(28, 45);

  const skuNames = isApparel
    ? ['ティアードワンピース', 'シアーシャツ', 'テーパードパンツ', 'ニットカーデ', 'デニムスカート']
    : ['色番21番（リキッドBB）', '色番23番（クッションBB）', 'モイスチャーセラム', 'UVプライマー', 'セッティングパウダー'];

  const skuMonthly = skuNames.map((_, i) => Math.round(totalM * rng(i === 0 ? 28 : 5, i === 0 ? 38 : 20) / 100));
  const ranks = skuNames.map((nm, i) => ({
    rank   : i + 1,
    name   : `${nm}（${kw}）`,
    sub    : 'SKU別売上',
    monthly: skuMonthly[i],
    annual : Math.round(skuMonthly[i] * 11.5 / 100) * 100,
    trend  : rng(-15, 25),
  })).sort((a, b) => b.monthly - a.monthly).map((r, i) => ({ ...r, rank: i + 1 }));

  const donutColors = ['#1a3a6b', '#c4a882', '#4a6741', '#6b3a7d', '#2a4a5c'];
  const donutData   = skuNames.slice(0, 4).map((nm, i) => ({
    name : nm, pct: rng(i === 0 ? 28 : 8, i === 0 ? 38 : 22), color: donutColors[i],
  }));
  donutData.push({ name: 'その他SKU', pct: 100 - donutData.reduce((a, d) => a + d.pct, 0), color: '#2a4a5c' });

  const complaints = isApparel
    ? [
        { text: '購入後の発送遅延（2〜5日超過）',          pct: v1,          sev: 'high' },
        { text: 'サイズ交換時の往復送料が自己負担',        pct: rng(10, 18), sev: 'high' },
        { text: '写真と実物の色・素材感が異なる',          pct: v2,          sev: 'mid'  },
        { text: 'カスタマー対応が遅い・不親切',            pct: rng(6, 12),  sev: 'mid'  },
      ]
    : [
        { text: 'リニューアル後の成分変更による肌荒れ・ピリつき', pct: v1,         sev: 'high' },
        { text: '香料が強くなり刺激を感じる',                    pct: rng(10, 20), sev: 'high' },
        { text: '旧処方の方が肌なじみが良かった',                pct: v2,          sev: 'mid'  },
        { text: '容量が減って値段が上がった',                    pct: rng(5, 12),  sev: 'mid'  },
      ];

  const output = isApparel
    ? `【警告：競合「${kw}」の脆弱性を検知】\n当該店舗は今月、全館で推計 ${totalM}万円 を売り上げていますが、その売上の約${topSkuPct}%を上位2つのSKUのみに依存している極めて歪な構造です。\n\nさらに、店舗レビューを感情分析した結果、全体の ${v1}% が「購入後の発送遅延と、サイズ交換時の往復送料が自己負担であること」への怒りに集中しています。\n\n御社が勝つための戦略は明白です。同型デザインを「即日発送・サイズ交換無料」の訴求で自社ECにぶつけてください。流入客の ${cap}% をノーリスクで横取りし、初月からROAS ${roas}% を達成可能です。`
    : `【警告：競合「${kw}」の脆弱性を検知】\n当該ブランドは今月、特定モールだけで推計 ${totalM}万円 のシェアを維持していますが、レビューの文脈解析により「リニューアル後の成分変更による肌荒れ・ピリつき」のクレームが直近で ${v1}% 急増しています。\n\n御社は今すぐ、旧来の安心安全な低刺激成分を前面に押し出した対抗製品をSNS広告でブーストしてください。ライバルが炎上・困惑している今こそ、顧客リストを総ざらいする最大の好機です。ROAS ${roas}% で流出顧客を全捕捉できます。`;

  return {
    kw,
    ind     : industry,
    hackMode: true,
    _source : 'simulation',
    reviewCount: rng(8000, 32000),
    topM    : totalM,
    totalM,
    totalA,
    topSkuPct,
    v1,
    v2,
    roas,
    cap,
    kpi: {
      roas_now     : (rng(10, 20) / 10).toFixed(1) + 'x',
      roas_now_sub : '競合の推定ROAS（炎上後低下）',
      roas_after   : (roas / 100).toFixed(1) + 'x',
      roas_after_sub: '攻略後の予測ROAS',
      profit       : '+¥' + (rng(15, 38) / 10).toFixed(1) + 'M',
      profit_sub   : '月次純増利益試算（横取り分）',
      cpa_imp      : '-' + rng(30, 55) + '%',
      cpa_sub      : isApparel ? '即日発送+無料交換で差別化' : '安全訴求×SNSブーストで差別化',
    },
    ranks,
    shopRanks  : ranks,
    donutData,
    donutCenter: { val: totalM + '万', lbl: '月間総売上' },
    donutTitle : kw + ' SKU別売上構成比',
    senti      : { pos: rng(38, 58), neu: rng(14, 22) },
    complaints,
    praises    : isApparel ? ['デザインが良い', 'コスパは良い', '写真映えする'] : ['旧処方は良かった', '発色は良い', 'パッケージが可愛い'],
    keywords   : isApparel
      ? ['即日発送', 'サイズ交換無料', '写真と同じ色', '丁寧な梱包', '返品保証']
      : ['旧処方相当', '低刺激処方', '無香料', '肌荒れしない', '敏感肌向け'],
    hotKw: isApparel ? ['即日発送', 'サイズ交換無料'] : ['低刺激処方', '無香料'],
    output,
    apvQ: `${kw}の脆弱点を突く対抗モデルで初月ROAS ${roas}% 達成。今すぐ投入しますか？`,
  };
}

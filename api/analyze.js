export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { industry, brand, category, channel, region, color, design, size } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'サーバー環境変数に GEMINI_API_KEY が設定されていません。' });
    }

    const colorStr = color ? color : "未指定";
    const designStr = design ? design : "未指定";
    const sizeStr = size ? size : "未指定";

    const prompt = `
あなたは世界最高峰の商業データアナリストであり、アパレル・コスメ業界のMD商品開発スペシャリストです。
指定された以下の条件を基に、グローバル市場データに即した【極めてリアルな統計数値および生データ構造】を演算シミュレーションし、指定のJSONフォーマットのみで出力してください。前後に説明文などは一切不要です。

【入力パラメータ】
・業界: ${industry} / ブランド: ${brand} / 品種: ${category} / チャネル: ${channel} / 国: ${region}
・個別条件: 色柄[${colorStr}], デザイン[${designStr}], サイズ区分[${sizeStr}]

【通貨・数値の単位ルール】
・対象国が「日本」を含む場合は、金額データは【億円・万円・円】単位。
・対象国が日本以外（全世界、アメリカなど）の場合は、【万ドル・ドル】単位。

【JSONフォーマットに関する鉄の掟】
・"commentary"の値を含め、JSONの内部に「生の改行コード（Enterキーによる改行）」や「タブ文字」を絶対に含めないでください。文章内の改行は必ず「\\\\n」という文字列を使用し、全体は必ず1行のテキストとして出力してください。

【出力必須のJSONフォーマット（このキー名・構造を完全に維持して出力してください）】
{
  "chartProducts": {
    "labels": ["製品A(売れ筋)", "製品B", "製品C", "製品D"],
    "data": [1800, 1350, 920, 460]
  },
  "chartProductsDetail": {
    "製品A(売れ筋)": { "sales": "1,800点", "revenue": "540万円(または万ドル)", "avgPrice": "3,000円(またはドル)" },
    "製品B": { "sales": "1,350点", "revenue": "405万円", "avgPrice": "3,000円" },
    "製品C": { "sales": "920点", "revenue": "368万円", "avgPrice": "4,000円" },
    "製品D": { "sales": "460点", "revenue": "230万円", "avgPrice": "5,000円" }
  },
  "chartChannels": {
    "labels": ["Amazon", "楽天市場", "Shopee", "eBay", "Qoo10", "自社EC/その他"],
    "data": [450, 320, 210, 110, 65, 95] 
  },
  "chartRegions": {
    "labels": ["日本", "アメリカ", "東南アジア", "ヨーロッパ", "その他地域"],
    "data": [180, 450, 220, 310, 90]
  },
  "chartRegionsDetail": {
    "日本": { "revenue": "180億円(または万ドル)", "sales": "60,000点", "avgPrice": "3,000円(またはドル)" },
    "アメリカ": { "revenue": "450万ドル(または億円)", "sales": "90,000点", "avgPrice": "50ドル" },
    "東南アジア": { "revenue": "220万ドル", "sales": "110,000点", "avgPrice": "20ドル" },
    "ヨーロッパ": { "revenue": "310万ドル", "sales": "62,000点", "avgPrice": "50ドル" },
    "その他地域": { "revenue": "90万ドル", "sales": "30,000点", "avgPrice": "30ドル" }
  },
  "chartPrices": {
    "labels": ["低価格帯", "ボリューム層下限", "ボリューム層上限", "高価格帯"],
    "data": [120, 450, 680, 95]
  },
  "chartDiscounts": {
    "labels": ["30%以上値下げ (15%)", "10-20%値下げ (25%)", "定価販売(値下げなし) (50%)", "その他処分価格 (10%)"],
    "data": [15, 25, 50, 10]
  },
  "chartSizes": {
    "labels": ["レギュラーサイズ", "オーバーサイズ/ルーズ", "プラスサイズ", "プチサイズ", "その他"],
    "data": [45, 25, 15, 10, 5]
  },
  "chartSpeeds": {
    "labels": ["完売までの平均日数", "再入荷した型数", "新商品が死に筋化する日数"],
    "data": [14, 28, 45]
  },
  "chartSatisfactions": {
    "labels": ["満足: 要因A(具体的な理由)", "満足: 要因B", "満足: 要因C"],
    "data": [150, 110, 85]
  },
  "chartSatisfactionsReviews": {
    "満足: 要因A(具体的な理由)": [
      { "text": "アパレル・コスメの特化データとして非常に満足。質感が素晴らしいです。", "url": "https://www.amazon.com/dp/mock-review1" },
      { "text": "エリさんのAmazon運用でも即戦力になるレベルの仕上がりです。", "url": "https://www.amazon.com/dp/mock-review2" },
      { "text": "このセグメントの展開は素晴らしい。買って大正解でした。", "url": "https://www.amazon.com/dp/mock-review3" }
    ]
  },
  "chartComplaints": {
    "labels": ["不満: 要因X(具体的な不満理由)", "不満: 要因Y", "不満: 要因Z"],
    "data": [95, 60, 40]
  },
  "chartComplaintsReviews": {
    "不満: 要因X(具体的な不満理由)": [
      { "text": "サイズ感が少しタイト。ワンサイズ上を選べば良かったです。", "url": "https://www.amazon.com/dp/mock-review4" },
      { "text": "デザインは良いがカラー展開がもう少し欲しかった。", "url": "https://www.amazon.com/dp/mock-review5" },
      { "text": "身幅がもう少しゆったりしていれば完璧でした。", "url": "https://www.amazon.com/dp/mock-review6" }
    ]
  },
  "commentary": "ここに、指定された業界（${industry}）および品種（${category}）のプロとして、価格・値引き・サイズ（${sizeStr}）・国別データ（${region}）を多角分析した結果を記述し、ブランド（${brand}）に完全勝利するための具体的なMD商品開発指示書を、熱い日本語で1行の文字列として記述してください。"
}

※注意：レビューや詳細の内訳テキストは、選択された品種や条件に完全連動したドロドロにリアルな言葉に動的変換して生成してください。
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        if (data.error) return res.status(500).json({ error: `Gemini API Error: ${data.error.message}` });
        if (!data.candidates || data.candidates.length === 0) return res.status(500).json({ error: 'Geminiからの応答データが空でした。' });

        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const cleanJson = JSON.parse(rawText);
        return res.status(200).json(cleanJson);

    } catch (error) {
        return res.status(500).json({ error: `例外が発生しました: ${error.message}` });
    }
}
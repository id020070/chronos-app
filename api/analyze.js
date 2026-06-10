export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json5 ? res.status(405).json({ error: 'Method Not Allowed' }) : null;
    }

    const { industry, brand, category, channel, region, color, design, material } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'サーバー環境変数に GEMINI_API_KEY が設定されていません。' });
    }

    const colorStr = color ? color : "未指定";
    const designStr = design ? design : "未指定";
    const materialStr = material ? material : "未指定";

    const prompt = `
あなたは世界最高峰の商業データアナリストであり、アパレル・コスメ業界のMD商品開発スペシャリストです。
指定された条件を基に、市場データに即した【極めてリアルな統計数値および生データ構造】を演算シミュレーションし、指定のJSONフォーマットのみで出力してください。前後に説明文などは一切不要です。

【入力パラメータ】
・業界: ${industry} / ブランド: ${brand} / 品種: ${category} / チャネル: ${channel} / 国: ${region}
・個別条件: 色柄[${colorStr}], デザイン[${designStr}], 素材[${materialStr}]

【数値・通貨の厳格ルール】
・対象国が「日本」を含む場合は、金額は【円・万円・億円】単位。
・対象国が日本以外（全世界、アメリカなど）の場合は、【ドル・万ドル】単位。

【JSONフォーマットに関する鉄の掟】
・"commentary"の値を含め、JSONの内部に「生の改行コード（Enterキーによる改行）」や「タブ文字」を絶対に含めないでください。文章内の改行は「\\\\n」を使用し、全体は必ず1行のテキストとして出力してください。

【出力必須のJSONフォーマット（このキー名・構造を1ミリも変えずに完全に出力してください）】
{
  "chartProducts": {
    "labels": ["具体的なヒット商品名A", "具体的なヒット商品名B", "具体的なヒット商品名C", "具体的なヒット商品名D"],
    "data": [1800, 1350, 920, 460]
  },
  "chartProductsDetail": {
    "具体的なヒット商品名A": { "sales": "1,800点", "revenue": "540万円(または万ドル)", "avgPrice": "3,000円(またはドル)" },
    "具体的なヒット商品名B": { "sales": "1,350点", "revenue": "405万円", "avgPrice": "3,000円" },
    "具体的なヒット商品名C": { "sales": "920点", "revenue": "368万円", "avgPrice": "4,000円" },
    "具体的なヒット商品名D": { "sales": "460点", "revenue": "230万円", "avgPrice": "5,000円" }
  },
  "chartChannels": {
    "labels": ["Amazon", "楽天市場", "Shopee", "eBay", "Qoo10", "自社EC/その他"],
    "data": [450, 320, 210, 110, 65, 95] 
  },
  "chartPrices": {
    "labels": ["低価格帯", "ボリューム層下限", "ボリューム層上限", "高価格帯"],
    "data": [120, 450, 680, 95]
  },
  "chartDiscounts": {
    "labels": ["30%以上値下げ (15%)", "10-20%値下げ (25%)", "定価販売(値下げなし) (50%)", "その他処分価格 (10%)"],
    "data": [15, 25, 50, 10]
  },
  "chartSpeeds": {
    "labels": ["完売までの平均日数", "再入荷した型数", "新商品が死に筋化する日数"],
    "data": [14, 28, 45]
  },
  "chartSatisfactions": {
    "labels": ["満足: 着心地・肌触りが抜群", "満足: デザインが洗練されている", "満足: コスパが良い"],
    "data": [150, 110, 85]
  },
  "chartSatisfactionsReviews": {
    "満足: 着心地・肌触りが抜群": [
      { "text": "生地が本当に柔らかくて、一日中着ていても全くストレスがありません。最高です。", "url": "https://www.amazon.com/dp/mock-review1" },
      { "text": "この価格でこの素材感は信じられない。エリさんのAmazon運用でも絶対にウケる質感です。", "url": "https://www.amazon.com/dp/mock-review2" },
      { "text": "洗濯してもヨレにくく、肌触りがずっとキープされるのが素晴らしい。", "url": "https://www.amazon.com/dp/mock-review3" }
                ]
  },
  "chartComplaints": {
    "labels": ["不満: サイズがやや小さめ", "不満: 縫製が一部甘い", "不満: カラーバリエーションが少ない"],
    "data": [95, 60, 40]
  },
  "chartComplaintsReviews": {
    "不満: サイズがやや小さめ": [
      { "text": "アメリカサイズだと思って買ったら意外とタイトでした。ワンサイズ上がおすすめです。", "url": "https://www.amazon.com/dp/mock-review4" },
      { "text": "デザインは可愛いけれど、アームホールが少し狭くて肩が凝る印象があります。", "url": "https://www.amazon.com/dp/mock-review5" },
      { "text": "洗濯したら少し縮みました。身幅がもう少しゆったりしていれば100点でした。", "url": "https://www.amazon.com/dp/mock-review6" }
    ]
  },
  "commentary": "ここに、指定された業界（${industry}）および品種（${category}）のプロとして、市場データを徹底分析した背景、および競合（${brand}）に完全勝利するための、超具体的な商品開発のアドバイスを、熱い日本語で1行の文字列として記述してください。"
}

※注意：満足・不満の理由ラベル、詳細レビューの中身は、入力された業界（${industry}）や品種（${category}）に合わせて、信じられないほどリアルな言葉に動的に変換して生成してください。
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
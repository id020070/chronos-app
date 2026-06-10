export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { industry, brand, category, channel, region, color, design, material } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'サーバー環境変数に GEMINI_API_KEY が設定されていません。' });
    }

    const colorStr = color ? color : "未指定（全体集計）";
    const designStr = design ? design : "未指定（全体集計）";
    const materialStr = material ? material : "未指定（全体集計）";

    const prompt = `
あなたは世界最高峰の商業データアナリストであり、アパレルおよびコスメ業界のMD商品開発のスペシャリストです。
競合分析ツール「EDITED」の全機能を遥かに超越するデータマトリクスを作成してください。
指定された条件を基に、市場データに即した【極めてリアルな統計数値】を演算シミュレーションし、指定のJSONフォーマットのみで出力してください。前後にJSON以外のテキストは一切含めないでください。

【入力パラメータ】
・業界: ${industry} / ブランド: ${brand} / 品種: ${category} / チャネル: ${channel} / 国: ${region}
・個別条件: 色柄[${colorStr}], デザイン[${designStr}], 素材[${materialStr}]

【出力必須のJSONフォーマット】
{
  "chartProducts": {
    "labels": ["製品A(売れ筋)", "製品B", "製品C", "製品D"],
    "data": [1800, 1350, 920, 460]
  },
  "chartChannels": {
    "labels": ["Amazon", "楽天市場", "Shopee", "eBay", "Qoo10", "自社EC/その他"],
    "data": [40, 20, 15, 12, 8, 5]
  },
  "chartPrices": {
    "labels": ["低価格帯", "ボリューム層下限", "ボリューム層上限", "高価格帯"],
    "data": [120, 450, 680, 95]
  },
  "chartDiscounts": {
    "labels": ["30%以上値下げ", "10-20%値下げ", "定価販売(値下げなし)", "その他処分価格"],
    "data": [15, 25, 50, 10]
  },
  "chartSpeeds": {
    "labels": ["完売までの平均日数", "再入荷した型数", "新商品が死に筋化する日数"],
    "data": [14, 28, 45]
  },
  "chartSentiments": {
    "labels": ["不満要因1位", "不満要因2位", "ポジティブ評価1位", "不満要因3位"],
    "data": [110, 75, 50, 25]
  },
  "commentary": "ここに、指定された業界（${industry}）および品種（${category}）の専門家として、価格分布（プライシング）、値引き傾向（ディスカウント）、完売スピード（スピード）の3つのEDITEDデータを徹底的に分析した背景を記述してください。さらに、指定の国（${region}）や販売チャネル（${channel}）で競合（${brand}）を完全に叩き潰すための、超具体的なMD商品開発戦闘指示書（デザイン、素材、原価、価格設定、最適な投入型数、顧客の不満レビューを逆手にとったプロダクト設計）を、熱く実戦的な日本語で記述してください。"
}
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
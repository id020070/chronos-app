export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { brand, category, channel, region, attributes } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    // Geminiへ「数字とグラフのリアリティ」を強制する超強力なプロンプト
    const prompt = `
あなたは世界最高峰のアパレル・コスメ特化型データアナリストです。
以下の入力パラメータを基に、グローバル市場の実データおよび統計予測に基づいた【極めてリアルな数値データ】をシミュレーションし、指定のJSONフォーマットのみで出力してください。

【入力条件】
・対象ブランド/店舗: ${brand}
・分析品種: ${category}
・指定販売チャネル: ${channel}
・対象国・地域: ${region}
・指定属性(色柄/素材/デザイン): ${attributes}

【出力必須のJSONフォーマット（これ以外のテキストは一切含めないでください）】
{
  "chartProducts": {
    "labels": ["上位製品Aの名前", "上位製品Bの名前", "上位製品Cの名前", "上位製品Dの名前"],
    "data": [1200, 980, 750, 430] 
  },
  "chartChannels": {
    "labels": ["Amazon", "楽天市場", "Shopee", "eBay", "Qoo10", "自社EC"],
    "data": [35, 25, 15, 10, 5, 10]
  },
  "chartDesigns": {
    "labels": ["色柄1(例:ブラック/無地)", "色柄2(例:ホワイト/ロゴ)", "素材デザイン1", "その他"],
    "data": [40, 30, 20, 10]
  },
  "chartSentiments": {
    "labels": ["不満1(例:サイズが小さい)", "不満2(例:生地が薄い)", "良い評価1(例:肌触りが良い)", "不満3(例:配送遅延)"],
    "data": [85, 62, 45, 31]
  },
  "commentary": "ここに、アパレルのプロが唸るほどの、数値の背景分析と次のMD商品開発への具体的な戦闘指示書（型数、原価、デザインの修正点など）を、ドロドロにリアルに、かつ熱く日本語で記述してください。"
}

※注意：
・数値データ（data）は、選択された国（${region}）やチャネル（${channel}）の市場規模のリアリティを反映させてください（例: 日本×Shopeeなら数値は小さくなる、世界×Amazonなら大きくなるなど）。
・感情分析は数の多い順のランキング形式にしてください。
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" } // JSONとして強制出力
            })
        });

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No candidates found from Gemini API');
        }

        const rawText = data.candidates[0].content.parts[0].text;
        const cleanJson = JSON.parse(rawText);

        return res.status(200).json(cleanJson);

    } catch (error) {
        console.error("Gemini Execution Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
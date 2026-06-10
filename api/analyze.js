export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { industry, brand, category, channel, region, attributes } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'サーバー環境変数に GEMINI_API_KEY が設定されていません。' });
    }

    const prompt = `
あなたは世界最高峰の商業データアナリストです。
指定された業界セクター、ブランド、品種、チャネル、国、属性を基に、市場の実データに基づいた【リアルな統計数値】をシミュレーションし、指定のJSONフォーマットのみで出力してください。

【入力パラメータ】
・業界セクター: ${industry}
・対象ブランド/店舗: ${brand}
・分析品種: ${category}
・指定販売チャネル: ${channel}
・対象国・地域: ${region}
・指定属性(色柄/素材/デザイン): ${attributes}

【出力必須のJSONフォーマット（これ以外の文章は絶対に含めないでください）】
{
  "chartProducts": {
    "labels": ["商品Aの名前", "商品Bの名前", "商品Cの名前", "商品Dの名前"],
    "data": [1600, 1200, 750, 390]
  },
  "chartChannels": {
    "labels": ["Amazon", "楽天市場", "Shopee", "eBay", "Qoo10", "自社EC/その他"],
    "data": [35, 25, 15, 10, 8, 7]
  },
  "chartDesigns": {
    "labels": ["売れ筋仕様A", "売れ筋仕様B", "売れ筋仕様C", "その他"],
    "data": [40, 30, 20, 10]
  },
  "chartSentiments": {
    "labels": ["不満要因1位", "不満要因2位", "良い評価1位", "不満要因3位"],
    "data": [90, 65, 45, 18]
  },
  "commentary": "ここに、指定された業界（${industry}）および品種（${category}）の専門家として、この統計数字の背景を詳細に解説し、指定の国（${region}）や販売チャネル（${channel}）で競合ブランド（${brand}）に勝つための、具体的で即戦力となるMD・商品開発戦略指示書（デザイン、素材、価格、型数、ターゲットの不満の完全な潰し方）を熱く日本語で記述してください。"
}

※注意：
・数値は、チャネル（${channel}）や国（${region}）の市場規模のリアリティを反映させてください。
・感情不満分析は必ず「件数の多い順」のランキング形式にしてください。
`;

    try {
        // 最も安定している「v1」の正式版エンドポイントURLに修正
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        
        if (data.error) {
            return res.status(500).json({ error: `Gemini API Error: ${data.error.message}` });
        }

        if (!data.candidates || data.candidates.length === 0) {
            return res.status(500).json({ error: 'Geminiからの応答が空でした。' });
        }

        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const cleanJson = JSON.parse(rawText);
        return res.status(200).json(cleanJson);

    } catch (error) {
        console.error("Execution Error:", error);
        return res.status(500).json({ error: `例外が発生しました: ${error.message}` });
    }
}
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { industry, brand, category, channel, region, attributes } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'サーバー環境変数に GEMINI_API_KEY が設定されていません。VercelのSettingsから再設定してください。' });
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
    "labels": ["製品・商品Aの名前", "製品・商品Bの名前", "製品・商品Cの名前", "製品・商品Dの名前"],
    "data": [1500, 1100, 850, 490]
  },
  "chartChannels": {
    "labels": ["Amazon", "楽天市場", "Shopee", "eBay", "Qoo10", "自社EC/その他"],
    "data": [30, 25, 20, 10, 8, 7]
  },
  "chartDesigns": {
    "labels": ["指定属性に沿った仕様A", "仕様B", "仕様C", "その他"],
    "data": [45, 25, 20, 10]
  },
  "chartSentiments": {
    "labels": ["不満要因1位", "不満要因2位", "良い評価1位", "不満要因3位"],
    "data": [95, 70, 48, 22]
  },
  "commentary": "ここに、指定された業界（${industry}）および品種（${category}）の専門家として、この統計数字の背景を解説し、指定の国（${region}）や販売チャネル（${channel}）で競合に勝つための、泥臭く具体的なMD・商品開発戦略指示書（デザイン、素材、価格、型数、ターゲットの不満の潰し方）を熱く日本語で記述してください。"
}

※注意：
・数値は、チャネル（${channel}）や国（${region}）の市場規模、全品種累計か個別品種かに応じて、リアリティのあるスケール感に変動させてください。
・感情不満分析は必ず「件数の多い順」のランキング形式にしてください。
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
            return res.status(500).json({ error: 'Geminiから応答候補（candidates）が返されませんでした。' });
        }

        let rawText = data.candidates[0].content.parts[0].text;
        
        // 【超重要】Markdownのゴミ（```json ... ```）を徹底排除する鉄壁のクリーニング
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const cleanJson = JSON.parse(rawText);
        return res.status(200).json(cleanJson);

    } catch (error) {
        console.error("Execution Error:", error);
        return res.status(500).json({ error: `バックエンド処理で例外が発生しました: ${error.message}` });
    }
}
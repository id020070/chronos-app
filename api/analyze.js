export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { industry, brand, category, channel, region, color, design, material } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'サーバー環境変数に GEMINI_API_KEY が設定されていません。' });
    }

    // 未入力（空文字）の項目に対するAI用のケア処理
    const colorStr = color ? color : "未指定（全体集計）";
    const designStr = design ? design : "未指定（全体集計）";
    const materialStr = material ? material : "未指定（全体集計）";

    const prompt = `
あなたは世界最高峰の商業データアナリストであり、アパレルおよびコスメ業界のMD商品開発のスペシャリストです。
指定された以下の条件を基に、グローバル市場データに即した【極めてリアルな統計数値】を演算シミュレーションし、指定のJSONフォーマットのみで出力してください。
挨拶文や説明文など、JSON以外のテキストは絶対に前後に含めないでください。必ず「{」で始まり「}」で終わる純粋なデータ構造にしてください。

【入力パラメータ】
・業界セクター: ${industry}
・対象ブランド/店舗: ${brand}
・分析品種: ${category}
・指定販売チャネル: ${channel}
・対象国・地域: ${region}
・個別の絞り込み条件（空欄の場合は全体として集計・分析せよ）：
  - 指定の色柄: ${colorStr}
  - 指定のデザイン傾向: ${designStr}
  - 指定の素材・成分: ${materialStr}

【出力必須のJSONフォーマット】
{
  "chartProducts": {
    "labels": ["ヒット商品Aの名前", "ヒット商品Bの名前", "ヒット商品Cの名前", "ヒット商品Dの名前"],
    "data": [1800, 1350, 920, 460]
  },
  "chartChannels": {
    "labels": ["Amazon", "楽天市場", "Shopee", "eBay", "Qoo10", "自社EC/その他"],
    "data": [40, 20, 15, 12, 8, 5]
  },
  "chartDesigns": {
    "labels": ["売れ筋の仕様・特徴A", "仕様・特徴B", "仕様・特徴C", "その他"],
    "data": [50, 25, 15, 10]
  },
  "chartSentiments": {
    "labels": ["顧客の不満・レビュー要因1位", "不満要因2位", "ポジティブ評価1位", "不満要因3位"],
    "data": [110, 75, 50, 25]
  },
  "commentary": "ここに、指定された業界（${industry}）のプロとして、上記統計数字の背景を詳細に解説し、指定の国（${region}）や販売チャネル（${channel}）で競合（${brand}）に完全勝利するための、超具体的なMD商品開発戦闘指示書（デザイン、素材、価格設定、最適な展開型数、顧客の不満の裏をかくプロダクト設計）を、熱く実戦的な日本語で記述してください。"
}
`;

    try {
        // 標準的な「v1beta」のエンドポイントにURLを復旧
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            return res.status(500).json({ error: `Gemini API Error: ${data.error.message}` });
        }

        if (!data.candidates || data.candidates.length === 0) {
            return res.status(500).json({ error: 'Geminiからの応答データが空でした。' });
        }

        let rawText = data.candidates[0].content.parts[0].text;
        // Markdownの余計なラッパー（```json ... ```）を排除
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const cleanJson = JSON.parse(rawText);
        return res.status(200).json(cleanJson);

    } catch (error) {
        console.error("Execution Error:", error);
        return res.status(500).json({ error: `例外が発生しました: ${error.message}` });
    }
}
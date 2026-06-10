export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
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
指定された条件を基に、市場データに即した【極めてリアルな統計数値】を演算シミュレーションし、指定のJSONフォーマットのみで出力してください。

【入力パラメータ】
・業界: ${industry} / ブランド: ${brand} / 品種: ${category} / チャネル: ${channel} / 国: ${region}
・個別条件: 色柄[${colorStr}], デザイン[${designStr}], 素材[${materialStr}]

【数値の単位ルール】
・対象国が「日本」を含む場合は、chartChannelsのデータ（売上高）は【億円】単位の数値（例: 150, 85...）にしてください。
・対象国が日本以外（全世界、アメリカなど）の場合は、【万ドル】単位の数値にしてください。

【JSONフォーマットに関する鉄の掟（最重要）】
出力は必ず純粋なJSONオブジェクトのみとし、前後に一切の説明テキストを含めないでください。
また、"commentary"の値を含め、JSONの内部に「生の改行コード（Enterキーによる改行）」や「タブ文字」を絶対に含めないでください。
文章内で改行を表現したい場合は、必ずエスケープされた文字列としての「\\\\n」を使用してください。
データ全体は、改行のない「1行のテキスト」として出力してください。このルールを破るとシステムがクラッシュします。

【出力必須のJSONフォーマット】
{
  "chartProducts": {
    "labels": ["ヒット商品A", "商品B", "商品C", "商品D"],
    "data": [1800, 1350, 920, 460]
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
    "labels": ["30%以上値下げ", "10-20%値下げ", "定価販売(値下げなし)", "その他処分価格"],
    "data": [15, 25, 50, 10]
  },
  "chartSpeeds": {
    "labels": ["完売までの平均日数", "再入荷した型数", "新商品が死に筋化する日数"],
    "data": [14, 28, 45]
  },
  "chartSentiments": {
    "labels": ["満足: 〇〇(一番多い満足理由)", "満足: 〇〇(2番目)", "不満: 〇〇(一番多い不満)", "満足: 〇〇(3番目)", "不満: 〇〇(2番目)", "不満: 〇〇(3番目)"],
    "data": [120, 95, 85, 60, 45, 30]
  },
  "commentary": "ここに、指定された業界（${industry}）のプロとして、価格分布（プライシング）、値引き傾向（ディスカウント）、完売スピード（スピード）のデータを徹底的に分析した背景を記述してください。さらに、指定の国（${region}）や販売チャネル（${channel}）で競合（${brand}）に完全勝利するための、超具体的なMD商品開発戦闘指示書（デザイン、素材、原価、価格設定、最適な投入型数、顧客の不満レビューを逆手にとったプロダクト設計）を、熱く実戦的な日本語で記述してください。"
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
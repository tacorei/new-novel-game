const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export const AIHelper = {
    async callAPI(prompt, apiKey) {
        if (!apiKey) throw new Error("APIキーが設定されていません。");

        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "AI通信エラーが発生しました。");
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    },

    getStoryPrompt(currentText, historyList) {
        return `
あなたは熟練のノベルゲームライターです。
現在、以下の物語が展開されています。
---
【前までのあらすじ】
${historyList.slice(-3).join("\n")}
【現在のシーン】
${currentText}
---
この先の「魅力的な展開」を200文字以内で、ノベルゲームのセリフや地の文として1つ提案してください。
`;
    },

    getImagePrompt(sceneText) {
        return `
あなたはノベルゲームの背景デザイン監督です。
以下のシーンに最適な、AI画像生成（Stable DiffusionやDALL-E等）で使える英語のプロンプトを作成してください。
出力は英語のプロンプトのみにしてください。
---
【シーン】
${sceneText}
`;
    }
};

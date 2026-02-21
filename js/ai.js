// Transformers.js を使用したブラウザ内蔵型AI
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

let generator = null;

export const AIHelper = {
    async init(onProgress) {
        if (generator) return;

        // 軽量な物語生成モデル（約150MB程度の量子化モデル）を使用
        // ※日本語対応を重視する場合、より大きなモデルが必要になることがありますが、
        // 動作の軽快さを優先し、一般的な小型モデルをベースにします。
        generator = await pipeline('text-generation', 'Xenova/distilgpt2', {
            progress_callback: (p) => {
                if (onProgress) onProgress(p);
            }
        });
    },

    async callAPI(prompt) {
        if (!generator) {
            throw new Error("AIの準備ができていません。init()を先に呼んでください。");
        }

        const output = await generator(prompt, {
            max_new_tokens: 100,
            temperature: 0.7,
            repetition_penalty: 1.2,
        });

        return output[0].generated_text.replace(prompt, "").trim();
    },

    getStoryPrompt(currentText, historyList) {
        // ローカルAI（distilgpt2など）向けにシンプルな英語プロンプト＋指示を与える構成に調整
        // 本来は日本語モデルが望ましいが、リソース制約のため英語で思考させ、
        // 日本語で出力するような指示にするか、プロンプト自体を工夫します。
        return `Finish the story in Japanese.
History: ${historyList.slice(-2).join(" ")}
Current: ${currentText}
Next:`;
    },

    getImagePrompt(sceneText) {
        return `Background image description for: ${sceneText}. Stable Diffusion prompt style:`;
    }
};

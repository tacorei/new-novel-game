// Transformers.js を使用したブラウザ内蔵型AI
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

let generator = null;
let initPromise = null;

export const AIHelper = {
    async init(onProgress) {
        if (generator) return;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            try {
                generator = await pipeline('text-generation', 'Xenova/distilgpt2', {
                    progress_callback: (p) => {
                        if (onProgress) onProgress(p);
                    }
                });
            } catch (err) {
                initPromise = null; // 失敗時は再試行できるようにクリア
                throw err;
            } finally {
                if (generator) initPromise = null;
            }
        })();

        return initPromise;
    },

    async callAPI(prompt, onProgress) {
        if (!generator) {
            if (initPromise) {
                await initPromise;
            } else {
                // 初期化が始まっていない場合は開始する
                await this.init(onProgress);
            }
        }

        // initが終わってもgeneratorがなければエラー（失敗時など）
        if (!generator) {
            throw new Error("AIの初期化に失敗したか、準備が完了していません。");
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
Next: `;
    },

    getImagePrompt(sceneText) {
        return `Background image description for: ${sceneText}. Stable Diffusion prompt style: `;
    }
};

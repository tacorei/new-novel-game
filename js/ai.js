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

    isReady() {
        return generator !== null;
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
            do_sample: true, // 多様性を出すためにサンプリングを有効化
            temperature: 0.8,
            repetition_penalty: 1.2,
            top_k: 40,
            top_p: 0.9,
        });

        return output[0].generated_text.replace(prompt, "").trim();
    },

    // 非ASCII文字を削除または置換するクリーンアップ関数
    _cleanPrompt(text) {
        if (!text) return "";
        // 日本語（非ASCII）が含まれるとモデルがパニックを起こすため、
        // 英語の文字、数字、記号のみを残します。
        return text.replace(/[^\x00-\x7F]/g, " ").replace(/\s+/g, " ").trim();
    },

    getStoryPrompt(currentText, historyList) {
        const cleanCurrent = this._cleanPrompt(currentText);
        const cleanHistory = historyList.slice(-2).map(h => this._cleanPrompt(h)).join(" | ");

        return `Suggest a creative next scene in English based on the context.
Context history: ${cleanHistory || "No previous history."}
Current scene: ${cleanCurrent || "Starting a new story."}
Next scene idea in English: `;
    },

    getImagePrompt(sceneText) {
        const cleanText = this._cleanPrompt(sceneText);
        return `Detailed artistic background image prompt for: "${cleanText}". Stable Diffusion style, high quality: `;
    },

    getCustomPrompt(instruction, currentText) {
        const cleanIns = this._cleanPrompt(instruction);
        const cleanText = this._cleanPrompt(currentText);
        return `Instruction: ${cleanIns}
Context: ${cleanText}
Result in English: `;
    }
};

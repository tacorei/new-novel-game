// Browser-side AI helper using Transformers.js.
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

let generator = null;
let initPromise = null;
let initRetries = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export const AIHelper = {
    async init(onProgress) {
        if (generator) return;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    generator = await pipeline('text-generation', 'Xenova/distilgpt2', {
                        progress_callback: (p) => {
                            if (onProgress) onProgress(p);
                        }
                    });
                    initRetries = 0;
                    return;
                } catch (err) {
                    initRetries++;
                    if (attempt < MAX_RETRIES - 1) {
                        console.warn(`AI init attempt ${attempt + 1}/${MAX_RETRIES} failed, retrying in ${RETRY_DELAY_MS}ms...`, err);
                        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                    } else {
                        console.error(`AI init failed after ${MAX_RETRIES} attempts:`, err);
                        initPromise = null;
                        throw err;
                    }
                }
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
                await this.init(onProgress);
            }
        }

        if (!generator) {
            throw new Error("AI init failed or not ready.");
        }

        const output = await generator(prompt, {
            max_new_tokens: 100,
            do_sample: true,
            temperature: 0.8,
            repetition_penalty: 1.2,
            top_k: 40,
            top_p: 0.9,
        });

        return output[0].generated_text.replace(prompt, "").trim();
    },

    _cleanPrompt(text) {
        if (!text) return "";
        // Preserve Japanese and other Unicode text while stripping control chars.
        return String(text).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
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

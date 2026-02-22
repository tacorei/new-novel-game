// Supabase 連携モジュール
export const CloudStorage = {
    // 環境変数（Netlify等）または直書き用
    config: {
        url: window.SUPABASE_URL || '',
        key: window.SUPABASE_KEY || ''
    },

    client: null,

    async init() {
        if (!this.config.url || !this.config.key) {
            console.warn("Supabase configuration missing. Cloud saving is disabled.");
            return false;
        }

        // Supabase CDN からスクリプトを動的にロード（import Map等がない環境を想定）
        if (!window.supabase) {
            await new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }

        this.client = window.supabase.createClient(this.config.url, this.config.key);
        return true;
    },

    async save(projectId, title, data) {
        if (!this.client) return;

        const { error } = await this.client
            .from('projects')
            .upsert({
                id: projectId,
                title: title,
                data: data,
                updated_at: new Date().toISOString()
            });

        if (error) console.error("Cloud Save Error:", error);
    },

    async load(projectId) {
        if (!this.client) return null;

        const { data, error } = await this.client
            .from('projects')
            .select('data')
            .eq('id', projectId)
            .single();

        if (error) {
            console.error("Cloud Load Error:", error);
            return null;
        }
        return data ? data.data : null;
    },

    async delete(projectId) {
        if (!this.client) return;
        const { error } = await this.client
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) console.error("Cloud Delete Error:", error);
    }
};

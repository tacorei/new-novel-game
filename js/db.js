// Supabase 連携モジュール（認証 + クラウドストレージ）
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

        // Supabase CDN からスクリプトを動的にロード
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

    // --- 認証メソッド ---

    // Google OAuth でサインイン
    async signIn() {
        if (!this.client) return null;
        const { data, error } = await this.client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });
        if (error) console.error("Sign In Error:", error);
        return data;
    },

    // サインアウト
    async signOut() {
        if (!this.client) return;
        const { error } = await this.client.auth.signOut();
        if (error) console.error("Sign Out Error:", error);
    },

    // 現在のユーザーを取得
    async getUser() {
        if (!this.client) return null;
        const { data: { user } } = await this.client.auth.getUser();
        return user;
    },

    // セッションを取得
    async getSession() {
        if (!this.client) return null;
        const { data: { session } } = await this.client.auth.getSession();
        return session;
    },

    // 認証状態の変化を監視
    onAuthStateChange(callback) {
        if (!this.client) return null;
        return this.client.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    // 既存データ（user_id = null）をログインユーザーに紐付け
    async claimOrphanProjects() {
        if (!this.client) return;
        const user = await this.getUser();
        if (!user) return;

        const { error } = await this.client
            .from('projects')
            .update({ user_id: user.id })
            .is('user_id', null);

        if (error) {
            // RLS で他人のデータは見えないので、エラーになる可能性は低い
            console.warn("Claim orphan projects:", error.message);
        }
    },

    // --- データ操作メソッド ---

    async save(projectId, title, data) {
        if (!this.client) return;
        const user = await this.getUser();
        if (!user) return; // 未ログインならクラウド保存しない

        const { error } = await this.client
            .from('projects')
            .upsert({
                id: projectId,
                title: title,
                data: data,
                user_id: user.id,
                updated_at: new Date().toISOString()
            });

        if (error) console.error("Cloud Save Error:", error);
    },

    async load(projectId) {
        if (!this.client) return null;
        const user = await this.getUser();
        if (!user) return null; // 未ログインならクラウドから読まない

        const { data, error } = await this.client
            .from('projects')
            .select('data')
            .eq('id', projectId)
            .single();

        if (error) {
            // PGRST116 = "No rows returned" （他人のデータ or 存在しない）
            if (error.code !== 'PGRST116') {
                console.error("Cloud Load Error:", error);
            }
            return null;
        }
        return data ? data.data : null;
    },

    async delete(projectId) {
        if (!this.client) return;
        const user = await this.getUser();
        if (!user) return;

        const { error } = await this.client
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) console.error("Cloud Delete Error:", error);
    }
};

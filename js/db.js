// Supabase storage and auth helper.
export const CloudStorage = {
    config: {
        url: window.SUPABASE_URL || '',
        key: window.SUPABASE_KEY || ''
    },

    client: null,
    _userCache: null,
    _userCacheExpiry: 0,

    async init() {
        if (!this.config.url || !this.config.key) {
            console.warn("Supabase configuration missing. Cloud saving is disabled.");
            return false;
        }

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

    async signOut() {
        if (!this.client) return;
        this._userCache = null;
        this._userCacheExpiry = 0;
        const { error } = await this.client.auth.signOut();
        if (error) console.error("Sign Out Error:", error);
    },

    async getUser() {
        if (!this.client) return null;
        
        // キャッシュが有効な場合は使用
        if (this._userCache && Date.now() < this._userCacheExpiry) {
            return this._userCache;
        }
        
        const { data: { user } } = await this.client.auth.getUser();
        
        // ユーザー情報をキャッシュ（30秒間有効）
        this._userCache = user;
        this._userCacheExpiry = Date.now() + 30000;
        
        return user;
    },

    async getSession() {
        if (!this.client) return null;
        const { data: { session } } = await this.client.auth.getSession();
        return session;
    },

    onAuthStateChange(callback) {
        if (!this.client) return null;
        return this.client.auth.onAuthStateChange((event, session) => {
            // ユーザーキャッシュをクリア
            this._userCache = null;
            this._userCacheExpiry = 0;
            callback(event, session);
        });
    },

    async claimOrphanProjects() {
        if (!this.client) return;
        const user = await this.getUser();
        if (!user) return;

        const { error } = await this.client
            .from('projects')
            .update({ user_id: user.id })
            .is('user_id', null);

        if (error) {
            console.warn("Claim orphan projects:", error.message);
        }
    },

    async save(projectId, title, data) {
        if (!this.client) return;
        const user = await this.getUser();
        if (!user) return;

        const { error } = await this.client
            .from('projects')
            .upsert({
                id: projectId,
                title: title,
                data: data,
                user_id: user.id,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error("Cloud Save Error:", error);
            throw error;
        }
    },

    async load(projectId) {
        if (!this.client) return null;
        const user = await this.getUser();
        if (!user) return null;

        const { data, error } = await this.client
            .from('projects')
            .select('data')
            .eq('id', projectId)
            .eq('user_id', user.id)
            .single();

        if (error) {
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
            .eq('id', projectId)
            .eq('user_id', user.id);

        if (error) console.error("Cloud Delete Error:", error);
    }
};

// 認証状態の管理とUI連携モジュール
import { CloudStorage } from './db.js';
import NovelStorage from './storage.js';

const Auth = {
    currentUser: null,

    _setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },

    _setAvatar(id, avatarUrl) {
        const el = document.getElementById(id);
        if (!el) return;
        if (avatarUrl) {
            el.src = avatarUrl;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    },

    // 認証UIを初期化
    async init() {
        const cloudReady = await CloudStorage.init();
        if (!cloudReady) {
            // Supabase 未設定時はログインUI非表示
            this.hideAuthUI();
            return;
        }

        // 現在のセッションを確認
        const session = await CloudStorage.getSession();
        if (session?.user) {
            this.currentUser = session.user;
            this.updateUI(session.user);
            // 既存データの移行（初回ログイン時）
            await CloudStorage.claimOrphanProjects();
        }

        // 認証状態の変化を監視
        CloudStorage.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                // ログイン時：現在のセッションデータをクラウドに同期してからリロード
                this.currentUser = session.user;
                this.updateUI(session.user);
                await CloudStorage.claimOrphanProjects();
                
                // 未保存データがあれば保存してからリロード
                try {
                    const projectId = localStorage.getItem('active_project_id');
                    if (projectId) {
                        const rawData = localStorage.getItem('novel_project_' + projectId);
                        if (rawData) {
                            await NovelStorage.save(JSON.parse(rawData).scenes || [], JSON.parse(rawData).characters || []);
                        }
                    }
                } catch (e) {
                    console.warn("Auto-save before reload failed:", e);
                }
                
                // データ同期後にリロード
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.updateUI(null);
            }
        });

        // ボタンのイベントを設定
        this.setupButtons();
    },

    // ログイン/ログアウトボタンの設定
    setupButtons() {
        const btnLogin = document.getElementById('btn-login');
        const btnLogout = document.getElementById('btn-logout');

        if (btnLogin) {
            btnLogin.onclick = async () => {
                await CloudStorage.signIn();
            };
        }

        if (btnLogout) {
            btnLogout.onclick = async () => {
                await CloudStorage.signOut();
                window.location.reload();
            };
        }
    },

    // UIの更新（ログイン状態に応じて切り替え）
    updateUI(user) {
        const loginSection = document.getElementById('auth-login');
        const userSection = document.getElementById('auth-user');
        const userBadge = document.getElementById('auth-user-badge');
        const userName = document.getElementById('auth-user-name');
        const userAvatar = document.getElementById('auth-user-avatar');
        const displayName = user?.user_metadata?.full_name || user?.email || 'ユーザー';
        const avatarUrl = user?.user_metadata?.avatar_url;

        if (user) {
            if (loginSection) loginSection.style.display = 'none';
            if (userSection) userSection.style.display = 'flex';
            if (userBadge) userBadge.style.display = 'flex';
            if (userName) userName.textContent = displayName;
            this._setAvatar('auth-user-avatar', avatarUrl);
        } else {
            if (loginSection) loginSection.style.display = 'flex';
            if (userSection) userSection.style.display = 'none';
            if (userBadge) userBadge.style.display = 'none';
            this._setText('auth-user-name', '');
            this._setAvatar('auth-user-avatar', '');
        }
    },

    // Supabase未設定時はauth要素を非表示
    hideAuthUI() {
        const authContainer = document.getElementById('auth-container');
        if (authContainer) authContainer.style.display = 'none';
    },

    // 現在のユーザーを返す
    getUser() {
        return this.currentUser;
    }
};

export default Auth;

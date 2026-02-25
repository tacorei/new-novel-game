// 認証状態の管理とUI連携モジュール
import { CloudStorage } from './db.js';

const Auth = {
    currentUser: null,

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
                this.currentUser = session.user;
                this.updateUI(session.user);
                await CloudStorage.claimOrphanProjects();
                // ページをリロードして最新データを表示
                if (event === 'SIGNED_IN') {
                    window.location.reload();
                }
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
        const userName = document.getElementById('auth-user-name');
        const userAvatar = document.getElementById('auth-user-avatar');

        if (user) {
            // ログイン中
            if (loginSection) loginSection.style.display = 'none';
            if (userSection) userSection.style.display = 'flex';
            if (userName) userName.textContent = user.user_metadata?.full_name || user.email || 'ユーザー';
            if (userAvatar) {
                const avatarUrl = user.user_metadata?.avatar_url;
                if (avatarUrl) {
                    userAvatar.src = avatarUrl;
                    userAvatar.style.display = 'block';
                } else {
                    userAvatar.style.display = 'none';
                }
            }
        } else {
            // 未ログイン
            if (loginSection) loginSection.style.display = 'flex';
            if (userSection) userSection.style.display = 'none';
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

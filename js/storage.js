const PROJECTS_KEY = 'novel_projects_list';
const ACTIVE_PROJECT_KEY = 'novel_active_project_id';
const DATA_PREFIX = 'novel_data_';

const NovelStorage = {
  // プロジェクト一覧を取得
  getProjects() {
    const list = localStorage.getItem(PROJECTS_KEY);
    return list ? JSON.parse(list) : [];
  },

  // プロジェクト一覧を保存
  saveProjectsList(list) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  },

  // 現在のプロジェクトIDを取得
  getActiveProjectId() {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  },

  // アクティブなプロジェクトを切り替え
  setActiveProjectId(id) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  },

  // 新規プロジェクト作成
  createProject(name) {
    const id = 'p_' + Date.now();
    const list = this.getProjects();
    list.push({ id, name, updatedAt: new Date().toISOString() });
    this.saveProjectsList(list);
    this.setActiveProjectId(id);
    return id;
  },

  // プロジェクトの削除
  deleteProject(id) {
    let list = this.getProjects();
    list = list.filter(p => p.id !== id);
    this.saveProjectsList(list);
    localStorage.removeItem(DATA_PREFIX + id);
    if (this.getActiveProjectId() === id) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  },

  // アクティブなプロジェクトのデータを保存
  save(data) {
    const id = this.getActiveProjectId();
    if (!id) return;
    localStorage.setItem(DATA_PREFIX + id, JSON.stringify(data));

    // 更新日時を更新
    const list = this.getProjects();
    const p = list.find(item => item.id === id);
    if (p) {
      p.updatedAt = new Date().toISOString();
      this.saveProjectsList(list);
    }
  },

  // アクティブなプロジェクトのデータを読み込み
  load() {
    const id = this.getActiveProjectId();
    if (!id) return [];
    const data = localStorage.getItem(DATA_PREFIX + id);
    return data ? JSON.parse(data) : [];
  },

  // サンプルデータの読み込み（新プロジェクトとして作成）
  loadSample() {
    const id = this.createProject('サンプル物語');
    const sampleData = [
      { "text": "ここは静かな夜の街。どこか懐かしい香りがする。", "bg": "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=2000" },
      { "text": "「……誰？」\n暗闇の中から声がした。", "bg": "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&q=80&w=2000" }
    ];
    this.save(sampleData);
    return id;
  }
};

export default NovelStorage;

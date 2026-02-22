import { CloudStorage } from './db.js';

const LIST_NAME = 'novel_projects_list';
const DATA_PREFIX = 'novel_project_';

const NovelStorage = {
  // クラウド同期の初期化
  async initCloud() {
    return await CloudStorage.init();
  },

  // プロジェクトリストを取得
  getProjects() {
    const data = localStorage.getItem(LIST_NAME);
    return data ? JSON.parse(data) : [];
  },

  // プロジェクトリストを保存
  saveProjectsList(list) {
    localStorage.setItem(LIST_NAME, JSON.stringify(list));
  },

  // 新規プロジェクトを作成
  createProject(title) {
    const list = this.getProjects();
    const id = Date.now().toString();
    const newProject = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.push(newProject);
    this.saveProjectsList(list);
    this.setActiveProjectId(id);
    const initialScenes = [{ text: 'ここから物語がはじまります！ｗ', bg: '', note: '', fade: 1.0, audio: '', se: '', choices: [] }];
    this.save(initialScenes, []); // 初期データを保存
    return id;
  },

  // アクティブなプロジェクトIDを設定
  setActiveProjectId(id) {
    localStorage.setItem('active_project_id', id);
  },

  // アクティブなプロジェクトIDを取得
  getActiveProjectId() {
    return localStorage.getItem('active_project_id');
  },

  // プロジェクトの削除
  deleteProject(id) {
    let list = this.getProjects();
    list = list.filter(p => p.id !== id);
    this.saveProjectsList(list);
    localStorage.removeItem(DATA_PREFIX + id);
    if (this.getActiveProjectId() === id) {
      localStorage.removeItem('active_project_id');
    }
    // クラウドからも削除
    CloudStorage.delete(id);
  },

  // データを保存
  save(scenes, characters = []) {
    const id = this.getActiveProjectId();
    if (!id) return;
    const projectData = { scenes, characters };
    localStorage.setItem(DATA_PREFIX + id, JSON.stringify(projectData));

    // 更新日時を更新
    const list = this.getProjects();
    const p = list.find(item => item.id === id);
    if (p) {
      p.updatedAt = new Date().toISOString();
      this.saveProjectsList(list);

      // クラウド同期
      CloudStorage.save(id, p.title, projectData);
    }
  },

  // データを読み込み
  async load() {
    const id = this.getActiveProjectId();
    if (!id) return { scenes: [], characters: [] };

    // まずローカルから
    const raw = localStorage.getItem(DATA_PREFIX + id);
    let localData = { scenes: [], characters: [] };

    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          localData = { scenes: data, characters: [] };
        } else {
          localData = {
            scenes: data.scenes || [],
            characters: data.characters || []
          };
        }
      } catch (e) {
        console.error("Storage Load Error:", e);
      }
    }

    // クラウドから最新を取得
    const cloudData = await CloudStorage.load(id);
    if (cloudData) {
      return cloudData;
    }

    return localData;
  },

  // サンプル読み込み
  async loadSample() {
    try {
      const response = await fetch('sample.json');
      const data = await response.json();

      let scenes = [];
      let characters = [];

      if (Array.isArray(data)) {
        scenes = data;
      } else {
        scenes = data.scenes || [];
        characters = data.characters || [];
      }

      const id = this.createProject("サンプルプロジェクト");
      this.save(scenes, characters);
      return { id, scenes, characters };
    } catch (e) {
      console.error("Sample Load Error:", e);
      return null;
    }
  }
};

export default NovelStorage;

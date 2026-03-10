import { CloudStorage } from './db.js';

const LIST_NAME = 'novel_projects_list';
const DATA_PREFIX = 'novel_project_';
const CLOUD_SYNC_MAX_RETRIES = 3;
const CLOUD_SYNC_RETRY_DELAY = 500;

const NovelStorage = {
  async initCloud() {
    return await CloudStorage.init();
  },

  async _retrySave(projectId, title, projectData, retryCount = 0) {
    try {
      await CloudStorage.save(projectId, title, projectData);
      return true;
    } catch (err) {
      if (retryCount < CLOUD_SYNC_MAX_RETRIES) {
        console.warn(`Cloud save failed, retrying... (${retryCount + 1}/${CLOUD_SYNC_MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, CLOUD_SYNC_RETRY_DELAY));
        return this._retrySave(projectId, title, projectData, retryCount + 1);
      } else {
        console.error("Cloud save failed after retries:", err);
        return false;
      }
    }
  },

  getProjects() {
    const data = localStorage.getItem(LIST_NAME);
    return data ? JSON.parse(data) : [];
  },

  saveProjectsList(list) {
    localStorage.setItem(LIST_NAME, JSON.stringify(list));
  },

  createProject(title, skipInitialScene = false) {
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

    if (!skipInitialScene) {
      const initialScenes = [
        {
          text: 'Once upon a time, a new story begins.',
          bg: '',
          note: '',
          fade: 1.0,
          audio: '',
          se: '',
          choices: []
        }
      ];
      this.save(initialScenes, []);
    }
    return id;
  },

  setActiveProjectId(id) {
    localStorage.setItem('active_project_id', id);
  },

  getActiveProjectId() {
    return localStorage.getItem('active_project_id');
  },

  deleteProject(id) {
    let list = this.getProjects();
    list = list.filter(p => p.id !== id);
    this.saveProjectsList(list);
    localStorage.removeItem(DATA_PREFIX + id);
    if (this.getActiveProjectId() === id) {
      localStorage.removeItem('active_project_id');
    }
    CloudStorage.delete(id);
  },

  async save(scenes, characters = []) {
    const id = this.getActiveProjectId();
    if (!id) return;
    const projectData = { scenes, characters };
    localStorage.setItem(DATA_PREFIX + id, JSON.stringify(projectData));

    const list = this.getProjects();
    const p = list.find(item => item.id === id);
    if (p) {
      p.updatedAt = new Date().toISOString();
      this.saveProjectsList(list);
      await this._retrySave(id, p.title, projectData);
    }
  },

  async load() {
    const id = this.getActiveProjectId();
    if (!id) return { scenes: [], characters: [] };

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

    const cloudData = await CloudStorage.load(id);
    if (cloudData) {
      return cloudData;
    }

    return localData;
  },

  async loadSample(title = "Sample Project") {
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

      const id = this.createProject(title, true);
      await this.save(scenes, characters);
      return { id, scenes, characters };
    } catch (e) {
      console.error("Sample Load Error:", e);
      return null;
    }
  }
};

export default NovelStorage;

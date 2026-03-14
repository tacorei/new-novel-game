import { CloudStorage } from './db.js';
import { SyncQueue } from './syncQueue.js';

const LIST_NAME = 'novel_projects_list';
const DATA_PREFIX = 'novel_project_';
const CLOUD_SYNC_MAX_RETRIES = 3;
const CLOUD_SYNC_RETRY_DELAY = 500;

const NovelStorage = {
  _syncListenerAttached: false,

  _emitStatus(state, detail = {}) {
    window.dispatchEvent(new CustomEvent('novel-storage-status', {
      detail: { state, ...detail }
    }));
  },

  async initCloud() {
    const ready = await CloudStorage.init();
    if (ready) {
      this._attachOnlineSync();
      await this.flushSyncQueue();
    }
    return ready;
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

  _attachOnlineSync() {
    if (this._syncListenerAttached) return;
    window.addEventListener('online', () => {
      this.flushSyncQueue();
    });
    this._syncListenerAttached = true;
  },

  async _queueSave(projectId, title, projectData, updatedAt) {
    await SyncQueue.put({
      operation: 'save',
      projectId,
      title,
      projectData,
      updatedAt
    });
    this._emitStatus('queued', { projectId, message: '同期待ち' });
  },

  async getPendingSyncCount() {
    return SyncQueue.count();
  },

  async getPendingSyncEntries() {
    const entries = await SyncQueue.list();
    return entries.sort((a, b) => this._toTimestamp(b.updatedAt) - this._toTimestamp(a.updatedAt));
  },

  async retryPendingSync() {
    if (!CloudStorage.isReady() || !navigator.onLine) {
      this._emitStatus('queued', { message: 'オンライン時に再試行します' });
      return { state: 'queued' };
    }
    if (!await CloudStorage.getUser()) {
      this._emitStatus('paused', { message: 'ログイン後に同期します' });
      return { state: 'paused' };
    }

    const synced = await this.flushSyncQueue();
    return { state: synced ? 'synced' : 'error' };
  },

  async discardPendingSync(projectId) {
    await SyncQueue.remove(projectId);
    this._emitStatus('discarded', { projectId, message: '保留中の同期を破棄しました' });
    return { state: 'discarded' };
  },

  async _queueDelete(projectId) {
    await SyncQueue.put({
      operation: 'delete',
      projectId,
      updatedAt: new Date().toISOString()
    });
    this._emitStatus('queued', { projectId, message: '削除を同期待ち' });
  },

  async flushSyncQueue() {
    if (!navigator.onLine) return false;
    if (!CloudStorage.isReady()) return false;

    const user = await CloudStorage.getUser();
    if (!user) {
      this._emitStatus('paused', { message: 'ログイン後に同期します' });
      return false;
    }

    const pendingEntries = await SyncQueue.list();
    if (pendingEntries.length === 0) return true;

    let allSynced = true;
    for (const entry of pendingEntries) {
      let synced = false;
      if (entry.operation === 'delete') {
        try {
          await CloudStorage.delete(entry.projectId);
          synced = true;
        } catch (err) {
          console.error("Cloud delete failed:", err);
          synced = false;
        }
      } else {
        synced = await this._retrySave(entry.projectId, entry.title, entry.projectData);
      }

      if (synced) {
        await SyncQueue.remove(entry.projectId);
        this._emitStatus('synced', { projectId: entry.projectId, message: 'クラウド同期済み' });
      } else {
        allSynced = false;
        this._emitStatus('error', { projectId: entry.projectId, message: 'クラウド同期に失敗しました' });
      }
    }

    return allSynced;
  },

  getProjects() {
    const data = localStorage.getItem(LIST_NAME);
    return data ? JSON.parse(data) : [];
  },

  saveProjectsList(list) {
    localStorage.setItem(LIST_NAME, JSON.stringify(list));
  },

  getProjectById(id) {
    return this.getProjects().find(project => project.id === id) || null;
  },

  _generateProjectId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  },

  _toTimestamp(value) {
    const ts = Date.parse(value || '');
    return Number.isNaN(ts) ? 0 : ts;
  },

  createProject(title, skipInitialScene = false) {
    const list = this.getProjects();
    const id = this._generateProjectId();
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

  async renameProject(id, title) {
    const trimmedTitle = String(title || '').trim();
    if (!trimmedTitle) {
      throw new Error('Project title is required');
    }

    const list = this.getProjects();
    const project = list.find(item => item.id === id);
    if (!project) {
      throw new Error('Project not found');
    }

    project.title = trimmedTitle;
    project.updatedAt = new Date().toISOString();
    this.saveProjectsList(list);

    const raw = localStorage.getItem(DATA_PREFIX + id);
    let projectData = { scenes: [], characters: [] };
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        projectData = Array.isArray(parsed) ? { scenes: parsed, characters: [] } : parsed;
      } catch (error) {
        console.error('Rename load error:', error);
      }
    }

    await this._queueSave(id, project.title, projectData, project.updatedAt);
    if (!CloudStorage.isReady() || !navigator.onLine) {
      return { state: 'queued' };
    }
    if (!await CloudStorage.getUser()) {
      this._emitStatus('paused', { message: 'ログイン後に同期します' });
      return { state: 'queued' };
    }

    const synced = await this.flushSyncQueue();
    if (!synced) {
      throw new Error('Cloud rename sync failed');
    }
    return { state: 'synced' };
  },

  setActiveProjectId(id) {
    localStorage.setItem('active_project_id', id);
  },

  getActiveProjectId() {
    return localStorage.getItem('active_project_id');
  },

  async deleteProject(id) {
    let list = this.getProjects();
    list = list.filter(p => p.id !== id);
    this.saveProjectsList(list);
    localStorage.removeItem(DATA_PREFIX + id);
    if (this.getActiveProjectId() === id) {
      localStorage.removeItem('active_project_id');
    }
    await this._queueDelete(id);
    if (!CloudStorage.isReady() || !navigator.onLine) {
      return { state: 'queued' };
    }
    if (!await CloudStorage.getUser()) {
      this._emitStatus('paused', { message: 'ログイン後に同期します' });
      return { state: 'queued' };
    }

    const synced = await this.flushSyncQueue();
    if (!synced) {
      throw new Error('Cloud delete sync failed');
    }
    return { state: 'synced' };
  },

  async save(scenes, characters = []) {
    const id = this.getActiveProjectId();
    if (!id) return { state: 'idle' };
    const projectData = { scenes, characters };
    localStorage.setItem(DATA_PREFIX + id, JSON.stringify(projectData));

    const list = this.getProjects();
    const p = list.find(item => item.id === id);
    if (p) {
      p.updatedAt = new Date().toISOString();
      this.saveProjectsList(list);
      await this._queueSave(id, p.title, projectData, p.updatedAt);
      if (!CloudStorage.isReady()) {
        return { state: 'queued' };
      }
      if (!navigator.onLine) {
        return { state: 'queued' };
      }
      if (!await CloudStorage.getUser()) {
        this._emitStatus('paused', { message: 'ログイン後に同期します' });
        return { state: 'queued' };
      }

      const synced = await this.flushSyncQueue();
      if (!synced) {
        throw new Error('Cloud sync failed');
      }
      return { state: 'synced' };
    }

    return { state: 'local' };
  },

  async load() {
    const id = this.getActiveProjectId();
    if (!id) return { scenes: [], characters: [] };

    const raw = localStorage.getItem(DATA_PREFIX + id);
    const projectMeta = this.getProjectById(id);
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

    const cloudRecord = await CloudStorage.load(id);
    if (!cloudRecord) {
      return localData;
    }

    const localUpdatedAt = this._toTimestamp(projectMeta?.updatedAt);
    const cloudUpdatedAt = this._toTimestamp(cloudRecord.updatedAt);

    if (localUpdatedAt >= cloudUpdatedAt) {
      return localData;
    }

    localStorage.setItem(DATA_PREFIX + id, JSON.stringify(cloudRecord.data));
    if (projectMeta) {
      projectMeta.updatedAt = cloudRecord.updatedAt || projectMeta.updatedAt;
      const projects = this.getProjects().map(project => project.id === id ? projectMeta : project);
      this.saveProjectsList(projects);
    }

    return cloudRecord.data;
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

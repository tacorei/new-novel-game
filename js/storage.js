const STORAGE_KEY = 'novel_game_data';

const sampleData = [
  {
    "text": "ここは静かな夜の街。どこか懐かしい香りがする。",
    "bg": "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=2000",
    "note": "冒頭シーン。導入の雰囲気作り。"
  },
  {
    "text": "「……誰？」\n暗闇の中から声がした。",
    "bg": "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&q=80&w=2000",
    "note": "ヒロインとの出会い（仮）"
  },
  {
    "text": "月明かりが、彼女の横顔を照らしている。",
    "bg": "https://images.unsplash.com/photo-1502481851512-e9e2529bbbf9?auto=format&fit=crop&q=80&w=2000",
    "note": "イベントCG風シーン"
  },
  {
    "text": "物語は、ここから始まる――。",
    "bg": "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=2000",
    "note": "タイトルコール直前"
  }
];

const NovelStorage = {
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  load() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  loadSample() {
    this.save(sampleData);
    return sampleData;
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export default NovelStorage;

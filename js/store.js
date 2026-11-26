// Store trung tâm: tải JSON, lưu tiến độ localStorage, sao lưu/khôi phục & dữ liệu Gia sư

const STORAGE_KEY = "mamxanh_hanngu_state_v1";

const DEFAULT_STATE = {
  lessonStatus: {
    hsk4shang_l01: "in_progress"
  },
  vocabStatus: {}, // { [wordId]: 'unlearned' | 'learning' | 'mastered' | 'needs_review' }
  mistakes: [], // [{ id, question, userAnswer, correctAnswer, explanation, category, sourceRef, date, count }]
  testHistory: [], // [{ id, type, title, score, total, date, details }]
  stationProgress: {}, // { [packageId]: 'not_started' | 'in_progress' | 'completed' | 'needs_review' }
  customLessons: {}, // Cho phép Gia sư bổ sung/chỉnh sửa bài học mà không sửa code
  customVocab: [], // Từ bổ sung riêng của Gia sư theo bài
  nudgeDisabled: false,
  lastNudgeAt: 0
};

class Store {
  constructor() {
    this.textbooks = null;
    this.lessonsCache = {};
    this.clusterTests = null;
    this.stations = [];
    this.hanziDb = {};
    this.hsk30L4Vocab = [];
    this.state = this.loadState();
    this.ready = false;
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        lessonStatus: { ...DEFAULT_STATE.lessonStatus, ...(parsed.lessonStatus || {}) },
        vocabStatus: { ...(parsed.vocabStatus || {}) },
        stationProgress: { ...(parsed.stationProgress || {}) },
        mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
        testHistory: Array.isArray(parsed.testHistory) ? parsed.testHistory : [],
        customLessons: parsed.customLessons || {},
        customVocab: Array.isArray(parsed.customVocab) ? parsed.customVocab : []
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("Không thể ghi localStorage:", e);
    }
  }

  async init() {
    if (this.ready) return;
    const [textbooks, clusterTests, hanziDb, hsk30L4Vocab, ...stationFiles] = await Promise.all([
      this._fetchJson("data/textbooks.json"),
      this._fetchJson("data/cluster_tests.json"),
      this._fetchJson("data/hanzi_db.json"),
      this._fetchJson("data/hsk30_l4_vocab.json").catch(() => []),
      this._fetchJson("data/advanced/station1_synonyms.json"),
      this._fetchJson("data/advanced/station2_grammar.json"),
      this._fetchJson("data/advanced/station3_idioms.json"),
      this._fetchJson("data/advanced/station4_polyphones.json"),
      this._fetchJson("data/advanced/station5_confusable_hanzi.json"),
      this._fetchJson("data/advanced/station6_error_correction.json"),
      this._fetchJson("data/advanced/station7_reading_expression.json")
    ]);

    this.textbooks = textbooks;
    this.clusterTests = clusterTests;
    this.hanziDb = hanziDb;
    this.hsk30L4Vocab = Array.isArray(hsk30L4Vocab) ? hsk30L4Vocab : [];
    this.stations = stationFiles;

    // Nạp trước các bài học đã có tệp dữ liệu JSON
    const loadPromises = [];
    for (const book of textbooks.books) {
      for (const l of book.lessons) {
        if (l.dataFile) {
          loadPromises.push(this.getLesson(l.id));
        }
      }
    }
    await Promise.all(loadPromises);
    this.ready = true;
  }

  async _fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`);
    return res.json();
  }

  getBookById(bookId) {
    return this.textbooks?.books.find((b) => b.id === bookId) || null;
  }

  getLessonMeta(lessonId) {
    for (const book of this.textbooks?.books || []) {
      const found = book.lessons.find((l) => l.id === lessonId);
      if (found) return { book, lesson: found };
    }
    return null;
  }

  async getLesson(lessonId) {
    if (this.state.customLessons[lessonId]) {
      return this._mergeCustomVocab(this.state.customLessons[lessonId]);
    }
    if (this.lessonsCache[lessonId]) {
      return this._mergeCustomVocab(this.lessonsCache[lessonId]);
    }
    const meta = this.getLessonMeta(lessonId);
    if (!meta || !meta.lesson.dataFile) return null;
    try {
      const data = await this._fetchJson(meta.lesson.dataFile);
      this.lessonsCache[lessonId] = data;
      return this._mergeCustomVocab(data);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  _mergeCustomVocab(lessonData) {
    const extras = this.state.customVocab.filter((w) => w.lessonId === lessonData.id);
    if (!extras.length) return lessonData;
    return {
      ...lessonData,
      supplemental_vocabulary: [...(lessonData.supplemental_vocabulary || []), ...extras]
    };
  }

  getAllLoadedLessons() {
    const map = new Map();
    Object.values(this.lessonsCache).forEach((l) => map.set(l.id, this._mergeCustomVocab(l)));
    Object.values(this.state.customLessons).forEach((l) => map.set(l.id, this._mergeCustomVocab(l)));
    return Array.from(map.values());
  }

  getAllVocab() {
    const list = [];
    for (const lesson of this.getAllLoadedLessons()) {
      for (const w of lesson.vocabulary || []) {
        list.push({ ...w, lessonId: lesson.id, lessonTitle: lesson.title_zh, bookId: lesson.book_id });
      }
      for (const w of lesson.supplemental_vocabulary || []) {
        list.push({ ...w, lessonId: lesson.id, lessonTitle: lesson.title_zh, bookId: lesson.book_id, isSupplemental: true });
      }
    }
    return list;
  }

  getHsk30L4Vocab() {
    return this.hsk30L4Vocab || [];
  }

  // Trạng thái bài học
  getLessonStatus(lessonId) {
    return this.state.lessonStatus[lessonId] || "not_started";
  }

  setLessonStatus(lessonId, status) {
    this.state.lessonStatus[lessonId] = status;
    this.saveState();
  }

  // Trạng thái từ vựng cá nhân
  getVocabStatus(wordId) {
    return this.state.vocabStatus[wordId] || "unlearned";
  }

  setVocabStatus(wordId, status) {
    if (status === "unlearned") {
      delete this.state.vocabStatus[wordId];
    } else {
      this.state.vocabStatus[wordId] = status;
    }
    this.saveState();
  }

  // Tiến độ trạm nâng cao
  getPackageStatus(pkgId) {
    return this.state.stationProgress[pkgId] || "not_started";
  }

  setPackageStatus(pkgId, status) {
    this.state.stationProgress[pkgId] = status;
    this.saveState();
  }

  // Sổ lỗi sai
  recordMistake({ question, userAnswer, correctAnswer, explanation, category = "Từ vựng", sourceRef = "" }) {
    const key = `${category}::${question.trim()}`;
    const existing = this.state.mistakes.find((m) => m.key === key);
    const today = new Date().toISOString().slice(0, 10);
    if (existing) {
      existing.userAnswer = userAnswer;
      existing.date = today;
      existing.count = (existing.count || 1) + 1;
    } else {
      this.state.mistakes.unshift({
        id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        key,
        question,
        userAnswer,
        correctAnswer,
        explanation,
        category,
        sourceRef,
        date: today,
        count: 1
      });
    }
    this.saveState();
  }

  removeMistake(id) {
    this.state.mistakes = this.state.mistakes.filter((m) => m.id !== id);
    this.saveState();
  }

  recordTestResult(entry) {
    this.state.testHistory.unshift({
      id: `test_${Date.now()}`,
      date: new Date().toISOString().slice(0, 16).replace("T", " "),
      ...entry
    });
    if (this.state.testHistory.length > 60) this.state.testHistory.pop();
    this.saveState();
  }

  // Dữ liệu đã học (dùng cho Ôn tập ngẫu nhiên — TUYỆT ĐỐI không lấy kiến thức chưa học)
  getStudiedLessonIds() {
    return Object.entries(this.state.lessonStatus)
      .filter(([, st]) => st === "in_progress" || st === "completed" || st === "needs_review")
      .map(([id]) => id);
  }

  getStudiedPackageIds() {
    return Object.entries(this.state.stationProgress)
      .filter(([, st]) => st === "in_progress" || st === "completed" || st === "needs_review")
      .map(([id]) => id);
  }

  // Gia sư thêm từ bổ sung vào một bài học
  addTutorWord(wordObj) {
    this.state.customVocab.push(wordObj);
    this.saveState();
  }

  importCustomLesson(lessonObj) {
    if (!lessonObj || !lessonObj.id) throw new Error("Thiếu trường id của bài học.");
    this.state.customLessons[lessonObj.id] = lessonObj;
    this.saveState();
  }

  // Xuất tiến độ JSON
  exportProgressJson() {
    return JSON.stringify(this.state, null, 2);
  }

  importProgressJson(jsonText) {
    const parsed = JSON.parse(jsonText);
    this.state = { ...structuredClone(DEFAULT_STATE), ...parsed };
    this.saveState();
  }

  // Xuất từ vựng ra CSV tương thích Google Sheets / Excel (UTF-8 BOM)
  exportVocabCsv(vocabList) {
    const headers = [
      "id", "textbook", "lesson", "hanzi", "pinyin",
      "lesson_pos", "lesson_meaning", "lesson_structure",
      "additional_usages_summary", "chinese_explanation", "collocations", "source_status"
    ];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = vocabList.map((w) => [
      w.id,
      w.textbook || "",
      w.lesson || "",
      w.hanzi,
      w.pinyin,
      w.lesson_usage?.part_of_speech || "",
      w.lesson_usage?.meaning || "",
      w.lesson_usage?.structure || "",
      (w.additional_usages || []).map((u) => `[${u.part_of_speech}] ${(u.meanings || []).join("; ")}`).join(" | "),
      w.chinese_explanation || "",
      (w.collocations || []).join("; "),
      w.source_status || ""
    ].map(esc).join(","));
    return "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  }

  // Thống kê tổng quan
  getStats() {
    const books = this.textbooks?.books || [];
    let totalLessons = 0;
    let completedLessons = 0;
    let inProgressLessons = 0;
    const bookProgress = books.map((b) => {
      const total = b.lessons.length;
      const done = b.lessons.filter((l) => this.getLessonStatus(l.id) === "completed").length;
      const active = b.lessons.filter((l) => this.getLessonStatus(l.id) === "in_progress").length;
      totalLessons += total;
      completedLessons += done;
      inProgressLessons += active;
      return { id: b.id, name: b.name, total, done, active, pct: total ? Math.round((done / total) * 100) : 0 };
    });

    const allVocab = this.getAllVocab();
    const masteredVocab = allVocab.filter((w) => this.getVocabStatus(w.id) === "mastered").length;
    const reviewVocab = allVocab.filter((w) => this.getVocabStatus(w.id) === "needs_review").length;
    const learningVocab = allVocab.filter((w) => this.getVocabStatus(w.id) === "learning").length;

    const stationStats = this.stations.map((st) => {
      const total = st.packages.length;
      const done = st.packages.filter((p) => this.getPackageStatus(p.id) === "completed").length;
      return { id: st.id, title: st.shortTitle, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
    });

    return {
      totalLessons,
      completedLessons,
      inProgressLessons,
      bookProgress,
      totalVocabLoaded: allVocab.length,
      masteredVocab,
      reviewVocab,
      learningVocab,
      mistakesCount: this.state.mistakes.length,
      testsCount: this.state.testHistory.length,
      stationStats
    };
  }
}

export const store = new Store();

// PHÒNG KIỂM TRA TỪ VỰNG – THỜI GIAN LINH HOẠT (VOCABULARY CHALLENGE – SPEED TEST)

import { store } from "../store.js";
import { audioManager } from "../audio.js";
import { calculateWordTime } from "../speedTestEngine.js";
import { escapeHtml, makeClickableHanzi, showToast } from "../mascots.js";
import { renderQuyen4QuizView } from "./quyen4QuizView.js";

const MODE_LABELS = {
  vi_to_zh: "Dạng 1: Nghĩa tiếng Việt → Viết chữ Hán ra giấy",
  py_to_zh: "Dạng 2: Pinyin / Âm thanh → Viết chữ Hán ra giấy",
  zh_to_py_vi: "Dạng 3: Chữ Hán → Viết Pinyin & Nghĩa Việt ra giấy",
  mixed: "Trộn ngẫu nhiên cả 3 dạng"
};

let activeTimerId = null;

export function cleanupSpeedTestTimer() {
  if (activeTimerId) {
    clearInterval(activeTimerId);
    activeTimerId = null;
  }
  audioManager.stop();
}

export function renderSpeedTestView(outerContainer, initialTab = "paper") {
  cleanupSpeedTestTimer();

  let activeRoomTab = initialTab === "quyen4" ? "quyen4" : "paper";

  outerContainer.innerHTML = `
    <div class="card" style="padding:12px 16px; margin-bottom:14px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn ${activeRoomTab === "paper" ? "btn-primary" : "btn-outline"}" data-room-tab="paper">
            ⏱ Speed Test 3 Giáo trình (Viết ra giấy)
          </button>
          <button type="button" class="btn ${activeRoomTab === "quyen4" ? "btn-primary" : "btn-outline"}" data-room-tab="quyen4">
            🎯 Kiểm tra từ vựng QUYỂN 4 (Làm trực tiếp trên web · ${store.getHsk30L4Vocab().length} từ)
          </button>
        </div>
      </div>
    </div>
    <div id="vocabTestRoomBody"></div>
  `;

  const container = outerContainer.querySelector("#vocabTestRoomBody");

  outerContainer.querySelectorAll("[data-room-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cleanupSpeedTestTimer();
      activeRoomTab = btn.dataset.roomTab;
      outerContainer.querySelectorAll("[data-room-tab]").forEach((b) => {
        b.classList.toggle("btn-primary", b.dataset.roomTab === activeRoomTab);
        b.classList.toggle("btn-outline", b.dataset.roomTab !== activeRoomTab);
      });
      if (activeRoomTab === "quyen4") {
        renderQuyen4QuizView(container);
      } else {
        phase = "setup";
        renderSetup();
      }
    });
  });

  const loadedLessons = store.getAllLoadedLessons();
  const books = store.textbooks?.books || [];

  const config = {
    scopeType: "all_loaded", // single | multi | book | range | all_loaded
    singleLessonId: loadedLessons[0]?.id || "",
    multiLessonIds: new Set(loadedLessons.map((l) => l.id)),
    bookId: "hsk4shang",
    rangeBookId: "hsk4shang",
    rangeFrom: 1,
    rangeTo: 10,
    count: 10,
    mode: "mixed",
    paceMultiplier: 1.0,
    manualOffset: 0,
    audioOnlyInMode2: false
  };

  let phase = "setup"; // setup | running | results
  let queue = [];
  let currentIdx = 0;
  let remainingSec = 0;
  let totalSec = 0;
  let paused = false;

  function collectPool() {
    const allVocab = store.getAllVocab();
    if (config.scopeType === "single") {
      return allVocab.filter((w) => w.lessonId === config.singleLessonId);
    }
    if (config.scopeType === "multi") {
      return allVocab.filter((w) => config.multiLessonIds.has(w.lessonId));
    }
    if (config.scopeType === "book") {
      return allVocab.filter((w) => w.bookId === config.bookId);
    }
    if (config.scopeType === "range") {
      const from = Math.min(config.rangeFrom, config.rangeTo);
      const to = Math.max(config.rangeFrom, config.rangeTo);
      return allVocab.filter((w) => w.bookId === config.rangeBookId && Number(w.lesson) >= from && Number(w.lesson) <= to);
    }
    return allVocab;
  }

  function pickModeForWord() {
    if (config.mode !== "mixed") return config.mode;
    const modes = ["vi_to_zh", "py_to_zh", "zh_to_py_vi"];
    return modes[Math.floor(Math.random() * modes.length)];
  }

  function startTest() {
    const pool = collectPool();
    if (!pool.length) {
      showToast("Phạm vi bạn chọn chưa có từ vựng nào được nạp. Hãy chọn phạm vi khác nhé!");
      return;
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, Math.min(config.count, shuffled.length));

    queue = chosen.map((word) => {
      const qMode = pickModeForWord();
      const timing = calculateWordTime(word, qMode, {
        paceMultiplier: config.paceMultiplier,
        manualOffset: config.manualOffset
      });
      return {
        word,
        mode: qMode,
        allocatedSec: timing.seconds,
        breakdown: timing.breakdown,
        markedReview: store.getVocabStatus(word.id) === "needs_review"
      };
    });

    currentIdx = 0;
    paused = false;
    phase = "running";
    startQuestion(0);
  }

  function startQuestion(idx) {
    cleanupSpeedTestTimer();
    if (idx >= queue.length) {
      finishTest();
      return;
    }
    currentIdx = idx;
    const item = queue[currentIdx];
    totalSec = item.allocatedSec;
    remainingSec = item.allocatedSec;
    renderRunning();

    if (item.mode === "py_to_zh") {
      audioManager.speak(item.word.hanzi);
    }

    activeTimerId = setInterval(() => {
      if (paused) return;
      remainingSec = Math.max(0, Number((remainingSec - 0.2).toFixed(1)));
      updateTimerDom();
      if (remainingSec <= 0) {
        cleanupSpeedTestTimer();
        startQuestion(currentIdx + 1);
      }
    }, 200);
  }

  function finishTest() {
    cleanupSpeedTestTimer();
    phase = "results";
    store.recordTestResult({
      type: "speed_test",
      title: `Speed Test (${queue.length} từ · ${MODE_LABELS[config.mode].split(":")[0]})`,
      score: queue.length,
      total: queue.length
    });
    renderResults();
  }

  function updateTimerDom() {
    const ring = container.querySelector("#speedRing");
    const num = container.querySelector("#speedSecNum");
    if (!ring || !num) return;
    const pct = totalSec > 0 ? Math.max(0, (remainingSec / totalSec) * 100) : 0;
    ring.style.setProperty("--pct", pct.toFixed(1));
    num.textContent = `${Math.ceil(remainingSec)}s`;
    if (remainingSec <= 3) {
      ring.style.background = `conic-gradient(var(--coral-500) ${pct.toFixed(1)}%, var(--coral-50) 0)`;
    } else {
      ring.style.background = `conic-gradient(var(--green-600) ${pct.toFixed(1)}%, var(--mint-100) 0)`;
    }
  }

  function renderSetup() {
    const pool = collectPool();
    const previewWords = pool.slice(0, 4);
    const previewMode = config.mode === "mixed" ? "vi_to_zh" : config.mode;

    container.innerHTML = `
      <div class="card card-mint">
        <h2>⏱ VOCABULARY CHALLENGE – SPEED TEST</h2>
        <p class="muted-sm">
          Phòng kiểm tra tốc độ ghi nhớ từ vựng (viết ra giấy, không cần gõ máy). <strong>Mỗi từ được tính thời gian riêng theo độ khó</strong> (dạng câu, số chữ, độ phức tạp nét, độ khó ghi nhớ và lịch sử ôn tập của học sinh) — gia sư có thể điều chỉnh thủ công bất cứ lúc nào.
        </p>
      </div>

      <div class="card">
        <h3>1. Chọn phạm vi từ vựng</h3>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
          <button class="btn-chip ${config.scopeType === "all_loaded" ? "active" : ""}" data-scope="all_loaded">Tất cả bài đã nạp (${store.getAllVocab().length} từ)</button>
          <button class="btn-chip ${config.scopeType === "single" ? "active" : ""}" data-scope="single">Một bài cụ thể</button>
          <button class="btn-chip ${config.scopeType === "multi" ? "active" : ""}" data-scope="multi">Chọn nhiều bài</button>
          <button class="btn-chip ${config.scopeType === "book" ? "active" : ""}" data-scope="book">Theo quyển giáo trình</button>
          <button class="btn-chip ${config.scopeType === "range" ? "active" : ""}" data-scope="range">Khoảng bài X → Y</button>
        </div>

        <div style="background:var(--bg-soft); padding:12px; border-radius:14px; border:1px solid var(--border); margin-bottom:14px;">
          ${config.scopeType === "single" ? `
            <label><strong>Chọn bài học:</strong></label>
            <select class="select-input" id="stSingleLesson" style="margin-left:8px;">
              ${loadedLessons.map((l) => `<option value="${l.id}" ${config.singleLessonId === l.id ? "selected" : ""}>${escapeHtml(l.textbook)} – Bài ${l.lesson_number}: ${escapeHtml(l.title_zh)} (${(l.vocabulary || []).length} từ)</option>`).join("")}
            </select>
          ` : config.scopeType === "multi" ? `
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
              ${loadedLessons.map((l) => `
                <label style="display:inline-flex; align-items:center; gap:6px; background:#fff; padding:6px 10px; border-radius:10px; border:1px solid var(--border); cursor:pointer;">
                  <input type="checkbox" data-multi-lesson="${l.id}" ${config.multiLessonIds.has(l.id) ? "checked" : ""} />
                  <span>${escapeHtml(l.textbook)} – Bài ${l.lesson_number} (${escapeHtml(l.title_zh)})</span>
                </label>
              `).join("")}
            </div>
          ` : config.scopeType === "book" ? `
            <select class="select-input" id="stBookSel">
              ${books.map((b) => `<option value="${b.id}" ${config.bookId === b.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}
            </select>
          ` : config.scopeType === "range" ? `
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <select class="select-input" id="stRangeBook">
                ${books.map((b) => `<option value="${b.id}" ${config.rangeBookId === b.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}
              </select>
              <span>Từ bài</span>
              <input type="number" class="text-input" id="stRangeFrom" value="${config.rangeFrom}" min="1" max="20" style="width:76px;" />
              <span>đến bài</span>
              <input type="number" class="text-input" id="stRangeTo" value="${config.rangeTo}" min="1" max="20" style="width:76px;" />
            </div>
          ` : `<span class="muted-sm">Đang chọn toàn bộ ${pool.length} từ vựng đã nạp từ 3 bộ giáo trình (HSK 4 上, HSK 4 下, HSK 5 上).</span>`}
          <div class="muted-sm" style="margin-top:8px;">📦 Kho từ khớp phạm vi hiện tại: <strong>${pool.length} từ</strong></div>
        </div>

        <div class="grid-2">
          <div>
            <h4>2. Số lượng câu hỏi</h4>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${[10, 20, 30, 50].map((n) => `
                <button class="btn-chip ${config.count === n ? "active" : ""}" data-count="${n}">${n} từ</button>
              `).join("")}
            </div>
            ${pool.length < config.count ? `<div class="muted-sm" style="margin-top:6px; color:#854d0e;">ℹ Phạm vi hiện có ${pool.length} từ, bài kiểm tra sẽ chạy đủ ${pool.length} từ hiện có.</div>` : ""}
          </div>

          <div>
            <h4>3. Hình thức kiểm tra (viết ra giấy)</h4>
            <select class="select-input" id="stModeSel" style="width:100%;">
              ${Object.entries(MODE_LABELS).map(([k, v]) => `<option value="${k}" ${config.mode === k ? "selected" : ""}>${escapeHtml(v)}</option>`).join("")}
            </select>
            ${config.mode === "py_to_zh" || config.mode === "mixed" ? `
              <label style="display:inline-flex; align-items:center; gap:6px; margin-top:8px; font-size:0.86rem; cursor:pointer;">
                <input type="checkbox" id="stAudioOnly" ${config.audioOnlyInMode2 ? "checked" : ""} />
                <span>Ở Dạng 2: chỉ phát âm thanh (ẩn Pinyin để nghe viết nâng cao)</span>
              </label>
            ` : ""}
          </div>
        </div>

        <div class="card card-yellow" style="margin-top:16px; margin-bottom:14px;">
          <h4 style="margin-bottom:6px;">🎛 Điều chỉnh thời gian thủ công dành cho Gia sư</h4>
          <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:center;">
            <div>
              <span class="muted-sm">Nhịp độ:</span>
              <button class="btn-chip ${config.paceMultiplier === 1.25 ? "active" : ""}" data-pace="1.25">Thư thả (×1.25)</button>
              <button class="btn-chip ${config.paceMultiplier === 1.0 ? "active" : ""}" data-pace="1.0">Chuẩn (×1.0)</button>
              <button class="btn-chip ${config.paceMultiplier === 0.8 ? "active" : ""}" data-pace="0.8">Tăng tốc (×0.8)</button>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <label for="stManualOffset" class="muted-sm">Cộng/trừ thêm mỗi câu:</label>
              <input type="range" id="stManualOffset" min="-5" max="10" step="1" value="${config.manualOffset}" />
              <strong>${config.manualOffset > 0 ? "+" : ""}${config.manualOffset} giây</strong>
            </div>
          </div>

          ${previewWords.length ? `
            <div style="margin-top:10px; font-size:0.85rem;">
              <strong>Ví dụ thời gian tự tính cho từng từ (không cố định):</strong>
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                ${previewWords.map((pw) => {
                  const t = calculateWordTime(pw, previewMode, config);
                  return `<span class="badge badge-mint" style="background:#fff; border:1px solid var(--mint-300);"><span class="zh">${escapeHtml(pw.hanzi)}</span> → <strong>${t.seconds}s</strong></span>`;
                }).join("")}
              </div>
            </div>
          ` : ""}
        </div>

        <div class="text-center">
          <button class="btn btn-primary" id="btnStartSpeedTest" style="padding:12px 28px; font-size:1.02rem;">
            🚀 Bắt đầu Speed Test ngay
          </button>
        </div>
      </div>
    `;

    container.querySelectorAll("[data-scope]").forEach((b) => b.addEventListener("click", () => { config.scopeType = b.dataset.scope; renderSetup(); }));
    container.querySelectorAll("[data-count]").forEach((b) => b.addEventListener("click", () => { config.count = Number(b.dataset.count); renderSetup(); }));
    container.querySelectorAll("[data-pace]").forEach((b) => b.addEventListener("click", () => { config.paceMultiplier = Number(b.dataset.pace); renderSetup(); }));

    container.querySelector("#stSingleLesson")?.addEventListener("change", (e) => { config.singleLessonId = e.target.value; renderSetup(); });
    container.querySelectorAll("[data-multi-lesson]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) config.multiLessonIds.add(cb.dataset.multiLesson);
        else config.multiLessonIds.delete(cb.dataset.multiLesson);
        renderSetup();
      });
    });
    container.querySelector("#stBookSel")?.addEventListener("change", (e) => { config.bookId = e.target.value; renderSetup(); });
    container.querySelector("#stRangeBook")?.addEventListener("change", (e) => { config.rangeBookId = e.target.value; renderSetup(); });
    container.querySelector("#stRangeFrom")?.addEventListener("change", (e) => { config.rangeFrom = Number(e.target.value) || 1; renderSetup(); });
    container.querySelector("#stRangeTo")?.addEventListener("change", (e) => { config.rangeTo = Number(e.target.value) || 10; renderSetup(); });
    container.querySelector("#stModeSel")?.addEventListener("change", (e) => { config.mode = e.target.value; renderSetup(); });
    container.querySelector("#stAudioOnly")?.addEventListener("change", (e) => { config.audioOnlyInMode2 = e.target.checked; });
    container.querySelector("#stManualOffset")?.addEventListener("input", (e) => { config.manualOffset = Number(e.target.value); renderSetup(); });

    container.querySelector("#btnStartSpeedTest")?.addEventListener("click", startTest);
  }

  function renderRunning() {
    const item = queue[currentIdx];
    const w = item.word;
    const progressPct = Math.round(((currentIdx + 1) / queue.length) * 100);

    let promptHtml = "";
    let taskHint = "";
    if (item.mode === "vi_to_zh") {
      taskHint = "Dạng 1: Nhìn nghĩa tiếng Việt → Viết CHỮ HÁN ra giấy";
      promptHtml = `<div class="speed-prompt-main">${escapeHtml(w.lesson_usage?.meaning || "")}</div>
        <div class="badge badge-mint">${escapeHtml(w.lesson_usage?.part_of_speech || "")}</div>`;
    } else if (item.mode === "py_to_zh") {
      taskHint = "Dạng 2: Nghe / nhìn Pinyin → Viết CHỮ HÁN ra giấy";
      promptHtml = config.audioOnlyInMode2
        ? `<div class="speed-prompt-main">🔊 Nghe âm thanh</div>`
        : `<div class="speed-prompt-main pinyin">${escapeHtml(w.pinyin)}</div>`;
      promptHtml += `<button class="btn btn-sm btn-outline" id="btnReplaySpeedAudio" style="margin-top:6px;">🔊 Phát lại âm thanh (TTS)</button>`;
    } else {
      taskHint = "Dạng 3: Nhìn chữ Hán → Viết PINYIN & NGHĨA TIẾNG VIỆT ra giấy";
      promptHtml = `<div class="speed-prompt-main zh" style="font-size:3.1rem;">${escapeHtml(w.hanzi)}</div>`;
    }

    container.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong>Câu ${currentIdx + 1} / ${queue.length}</strong>
          <span class="badge badge-yellow">${escapeHtml(taskHint)}</span>
        </div>
        <div class="progress-track" style="margin-bottom:18px;"><div class="progress-fill" style="width:${progressPct}%"></div></div>

        <div class="speed-stage">
          <div class="speed-timer-ring" id="speedRing" style="--pct:100">
            <div class="speed-timer-inner">
              <div class="speed-timer-num" id="speedSecNum">${Math.ceil(remainingSec)}s</div>
              <div class="muted-sm" style="font-size:0.74rem;">/ ${item.allocatedSec}s</div>
            </div>
          </div>

          ${promptHtml}

          <div class="speed-formula-chips">
            ${item.breakdown.map((b) => `<span class="badge badge-gray">${escapeHtml(b.label)}: <strong>${escapeHtml(b.delta)}</strong></span>`).join("")}
          </div>

          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap; margin-top:22px;">
            <button class="btn btn-yellow" id="btnPauseSpeed">${paused ? "▶ Tiếp tục" : "⏸ Tạm dừng (Gia sư)"}</button>
            <button class="btn btn-outline" id="btnAdd5Sec">+5 giây</button>
            <button class="btn btn-primary" id="btnNextSpeed">Câu tiếp →</button>
            <button class="btn btn-outline" id="btnRestartSpeed">↻ Bắt đầu lại</button>
            <button class="btn btn-danger" id="btnEndEarlySpeed">⏹ Kết thúc & Xem đáp án</button>
          </div>
        </div>
      </div>
    `;

    updateTimerDom();

    container.querySelector("#btnReplaySpeedAudio")?.addEventListener("click", () => audioManager.speak(w.hanzi));
    container.querySelector("#btnPauseSpeed")?.addEventListener("click", () => {
      paused = !paused;
      renderRunning();
    });
    container.querySelector("#btnAdd5Sec")?.addEventListener("click", () => {
      remainingSec += 5;
      totalSec += 5;
      item.allocatedSec += 5;
      updateTimerDom();
      showToast("Đã cộng thêm +5 giây cho câu này.");
    });
    container.querySelector("#btnNextSpeed")?.addEventListener("click", () => startQuestion(currentIdx + 1));
    container.querySelector("#btnRestartSpeed")?.addEventListener("click", () => {
      cleanupSpeedTestTimer();
      phase = "setup";
      renderSetup();
    });
    container.querySelector("#btnEndEarlySpeed")?.addEventListener("click", finishTest);
  }

  function renderResults() {
    container.innerHTML = `
      <div class="card card-mint">
        <div class="section-header">
          <div>
            <h2>🎉 Hoàn thành Speed Test (${queue.length} từ)!</h2>
            <p class="muted-sm">Hãy đối chiếu bài viết trên giấy của học sinh với bảng đáp án chuẩn bên dưới. Tích chọn những từ chưa nhớ để tự động đưa vào <strong>Sổ từ vựng cá nhân (Cần ôn tập)</strong>.</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-primary" id="btnNewSpeed">↻ Làm lượt kiểm tra mới</button>
            <a href="#review" class="btn btn-outline">🔖 Mở Sổ ôn tập cá nhân</a>
          </div>
        </div>
      </div>

      <div class="card" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Đáp án Chữ Hán</th>
              <th>Pinyin</th>
              <th>Nghĩa tiếng Việt (Trong bài)</th>
              <th>Thời gian cấp</th>
              <th>Đánh dấu ôn tập</th>
            </tr>
          </thead>
          <tbody>
            ${queue.map((item, idx) => {
              const w = item.word;
              const isReview = store.getVocabStatus(w.id) === "needs_review";
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>
                    <strong class="zh" style="font-size:1.3rem;">${makeClickableHanzi(w.hanzi)}</strong>
                    <button class="icon-btn" style="width:26px; height:26px; margin-left:4px;" data-speak="${escapeHtml(w.hanzi)}">🔊</button>
                  </td>
                  <td class="pinyin">${escapeHtml(w.pinyin)}</td>
                  <td>
                    <span class="badge badge-mint">${escapeHtml(w.lesson_usage?.part_of_speech || "")}</span>
                    ${escapeHtml(w.lesson_usage?.meaning || "")}
                  </td>
                  <td><strong>${item.allocatedSec} giây</strong></td>
                  <td>
                    <button class="btn btn-sm ${isReview ? "btn-danger" : "btn-outline"}" data-toggle-review="${w.id}">
                      ${isReview ? "🔖 Đã lưu Cần ôn" : "+ Đánh dấu chưa nhớ"}
                    </button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelector("#btnNewSpeed")?.addEventListener("click", () => {
      phase = "setup";
      renderSetup();
    });

    container.querySelectorAll("[data-speak]").forEach((btn) => {
      btn.addEventListener("click", () => audioManager.speak(btn.dataset.speak));
    });

    container.querySelectorAll("[data-toggle-review]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.toggleReview;
        const current = store.getVocabStatus(id);
        const next = current === "needs_review" ? "mastered" : "needs_review";
        store.setVocabStatus(id, next);
        showToast(next === "needs_review" ? "Đã đưa vào Sổ từ vựng: Cần ôn tập 🔖" : "Đã bỏ khỏi danh sách cần ôn.");
        renderResults();
      });
    });
  }

  if (activeRoomTab === "quyen4") {
    renderQuyen4QuizView(container);
  } else {
    renderSetup();
  }
}

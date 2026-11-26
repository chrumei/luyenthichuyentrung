// Khu vực ÔN TẬP CÁ NHÂN 我的复习
// 1. Sổ từ vựng cá nhân | 2. Sổ lỗi sai | 3. Ôn tập ngẫu nhiên (CHỈ lấy kiến thức đã học) | 4. Theo dõi tiến độ

import { store } from "../store.js";
import { audioManager } from "../audio.js";
import { showVocabDetailPanel } from "../hanziPanel.js";
import { renderExerciseSet } from "../exerciseEngine.js";
import { escapeHtml, makeClickableHanzi, VOCAB_STATUS_LABELS, showToast } from "../mascots.js";

let activeTab = "notebook";
let nbFilter = "all";
let errFilter = "all";

export function renderReviewView(container) {
  function render() {
    const stats = store.getStats();
    container.innerHTML = `
      <div class="card card-mint">
        <h2>🔁 ÔN TẬP CÁ NHÂN <span class="zh">我的复习</span></h2>
        <p class="muted-sm">Quản lý sổ từ vựng cá nhân, sổ lỗi sai tự động, ôn tập ngẫu nhiên theo đúng phạm vi đã học và theo dõi tiến độ trực quan.</p>
        <div class="tabs-bar" style="margin-top:12px; margin-bottom:0; border-bottom:none; padding-bottom:0;">
          <button class="tab-btn ${activeTab === "notebook" ? "active" : ""}" data-rev-tab="notebook">📒 Sổ từ vựng (${stats.totalVocabLoaded})</button>
          <button class="tab-btn ${activeTab === "mistakes" ? "active" : ""}" data-rev-tab="mistakes">❗ Sổ lỗi sai (${stats.mistakesCount})</button>
          <button class="tab-btn ${activeTab === "random" ? "active" : ""}" data-rev-tab="random">🎲 Ôn tập ngẫu nhiên</button>
          <button class="tab-btn ${activeTab === "progress" ? "active" : ""}" data-rev-tab="progress">📊 Theo dõi tiến độ</button>
        </div>
      </div>

      <div id="reviewTabBody"></div>
    `;

    container.querySelectorAll("[data-rev-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.revTab;
        render();
      });
    });

    const body = container.querySelector("#reviewTabBody");
    if (activeTab === "notebook") renderNotebook(body, render);
    else if (activeTab === "mistakes") renderMistakes(body, render);
    else if (activeTab === "random") renderRandomReview(body);
    else if (activeTab === "progress") renderProgress(body, render);
  }

  render();
}

function renderNotebook(box, rerender) {
  const allVocab = store.getAllVocab();
  const counts = {
    all: allVocab.length,
    needs_review: allVocab.filter((w) => store.getVocabStatus(w.id) === "needs_review").length,
    learning: allVocab.filter((w) => store.getVocabStatus(w.id) === "learning").length,
    mastered: allVocab.filter((w) => store.getVocabStatus(w.id) === "mastered").length,
    unlearned: allVocab.filter((w) => store.getVocabStatus(w.id) === "unlearned").length
  };

  const list = nbFilter === "all" ? allVocab : allVocab.filter((w) => store.getVocabStatus(w.id) === nbFilter);
  const vocabMap = new Map(allVocab.map((w) => [w.id, w]));

  box.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <button class="btn-chip ${nbFilter === "all" ? "active" : ""}" data-nb-f="all">Tất cả (${counts.all})</button>
        <button class="btn-chip ${nbFilter === "needs_review" ? "active" : ""}" data-nb-f="needs_review">🔖 Cần ôn tập (${counts.needs_review})</button>
        <button class="btn-chip ${nbFilter === "learning" ? "active" : ""}" data-nb-f="learning">📘 Đang học (${counts.learning})</button>
        <button class="btn-chip ${nbFilter === "mastered" ? "active" : ""}" data-nb-f="mastered">✓ Đã nhớ (${counts.mastered})</button>
        <button class="btn-chip ${nbFilter === "unlearned" ? "active" : ""}" data-nb-f="unlearned">○ Chưa thuộc (${counts.unlearned})</button>
      </div>

      ${list.length ? `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr><th>Chữ Hán</th><th>Pinyin</th><th>Nghĩa (Trong bài)</th><th>Nguồn bài</th><th>Trạng thái</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              ${list.map((w) => {
                const st = store.getVocabStatus(w.id);
                return `
                  <tr>
                    <td><strong class="zh" style="font-size:1.25rem;">${makeClickableHanzi(w.hanzi)}</strong></td>
                    <td class="pinyin">${escapeHtml(w.pinyin)}</td>
                    <td>${escapeHtml(w.lesson_usage?.meaning || "")}</td>
                    <td><span class="badge badge-gray">${escapeHtml(w.textbook || "")} · B${w.lesson || ""}</span></td>
                    <td>
                      <select class="select-input btn-sm" data-nb-st="${w.id}">
                        ${Object.entries(VOCAB_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${st === k ? "selected" : ""}>${v}</option>`).join("")}
                      </select>
                    </td>
                    <td style="white-space:nowrap;">
                      <button class="icon-btn" data-speak="${escapeHtml(w.hanzi)}" title="Đọc (TTS)">🔊</button>
                      <button class="btn btn-sm btn-outline" data-nb-detail="${w.id}">Chi tiết</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="muted">Không có từ nào trong mục này.</p>`}
    </div>
  `;

  box.querySelectorAll("[data-nb-f]").forEach((b) => b.addEventListener("click", () => { nbFilter = b.dataset.nbF; renderNotebook(box, rerender); }));
  box.querySelectorAll("[data-nb-st]").forEach((sel) => {
    sel.addEventListener("change", () => {
      store.setVocabStatus(sel.dataset.nbSt, sel.value);
      showToast(`Đã đổi trạng thái thành: ${VOCAB_STATUS_LABELS[sel.value]}`);
      rerender();
    });
  });
  box.querySelectorAll("[data-speak]").forEach((b) => b.addEventListener("click", () => audioManager.speak(b.dataset.speak)));
  box.querySelectorAll("[data-nb-detail]").forEach((b) => b.addEventListener("click", () => showVocabDetailPanel(vocabMap.get(b.dataset.nbDetail))));
}

function renderMistakes(box, rerender) {
  const categories = ["all", "Từ vựng", "Ngữ pháp", "Đọc hiểu", "Dịch thuật", "Kiến thức nâng cao", "Bài tập giáo trình", "Kiểm tra cụm bài"];
  const mistakes = store.state.mistakes || [];
  const filtered = errFilter === "all" ? mistakes : mistakes.filter((m) => m.category === errFilter);

  box.innerHTML = `
    <div class="card">
      <div class="toolbar">
        ${categories.map((cat) => `
          <button class="btn-chip ${errFilter === cat ? "active" : ""}" data-err-cat="${cat}">
            ${cat === "all" ? `Tất cả (${mistakes.length})` : escapeHtml(cat)}
          </button>
        `).join("")}
      </div>

      ${filtered.length ? filtered.map((m) => `
        <div class="exercise-card">
          <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <span class="badge badge-coral">${escapeHtml(m.category)}</span>
              <span class="badge badge-yellow">Sai ${m.count} lần</span>
              <span class="badge badge-gray">Ngày: ${escapeHtml(m.date)}</span>
              ${m.sourceRef ? `<span class="badge badge-mint">${escapeHtml(m.sourceRef)}</span>` : ""}
            </div>
            <button class="btn btn-sm btn-outline" data-del-err="${m.id}">✓ Đã sửa vững (Xóa)</button>
          </div>
          <div class="zh" style="font-weight:600; margin-bottom:6px;">${makeClickableHanzi(m.question)}</div>
          <div style="font-size:0.9rem; color:var(--coral-700);"><strong>Đáp án bạn đã chọn:</strong> <span class="zh">${escapeHtml(m.userAnswer)}</span></div>
          <div style="font-size:0.9rem; color:var(--green-700);"><strong>Đáp án đúng:</strong> <span class="zh">${escapeHtml(m.correctAnswer)}</span></div>
          ${m.explanation ? `<div class="muted-sm" style="margin-top:4px;"><strong>Giải thích:</strong> ${escapeHtml(m.explanation)}</div>` : ""}
        </div>
      `).join("") : `
        <div class="text-center" style="padding:26px 10px;">
          <div style="font-size:2rem;">🎉</div>
          <h4>Sổ lỗi sai đang trống!</h4>
          <p class="muted-sm">Khi bạn làm bài tập hoặc kiểm tra mà có câu trả lời chưa đúng, hệ thống sẽ tự động lưu vào đây để bạn ôn lại có hệ thống.</p>
        </div>
      `}
    </div>
  `;

  box.querySelectorAll("[data-err-cat]").forEach((b) => b.addEventListener("click", () => { errFilter = b.dataset.errCat; renderMistakes(box, rerender); }));
  box.querySelectorAll("[data-del-err]").forEach((b) => b.addEventListener("click", () => {
    store.removeMistake(b.dataset.delErr);
    showToast("Đã gỡ câu này khỏi Sổ lỗi sai!");
    rerender();
  }));
}

function renderRandomReview(box) {
  const studiedLessonIds = store.getStudiedLessonIds();
  const studiedPkgIds = store.getStudiedPackageIds();

  // CHỈ thu thập từ các bài học và chuyên đề đã học (tuyệt đối không đưa kiến thức chưa học)
  const studiedLessons = store.getAllLoadedLessons().filter((l) => studiedLessonIds.includes(l.id));
  const poolQuestions = [];

  // 1. Câu từ Sổ lỗi sai (ưu tiên ôn lại trước!)
  (store.state.mistakes || []).slice(0, 4).forEach((m, idx) => {
    poolQuestions.push({
      id: `rr_err_${idx}`,
      type: "error_fix",
      level: "Phân biệt",
      origin_tag: "Từ Sổ lỗi sai cũ",
      prompt: `[Ôn lại lỗi cũ] ${m.question}`,
      answer: m.correctAnswer,
      explanation: m.explanation || "Ôn lại lỗi đã từng mắc trước đây.",
      mistake_category: m.category
    });
  });

  // 2. Từ vựng & bài tập từ các bài đã học
  const studiedVocab = [];
  studiedLessons.forEach((l) => {
    (l.vocabulary || []).forEach((w) => studiedVocab.push(w));
    (l.exercises || []).filter((e) => Array.isArray(e.options) && e.options.length).slice(0, 3).forEach((e, idx) => {
      poolQuestions.push({ ...e, id: `rr_les_${l.id}_${idx}`, origin_tag: `Đã học · ${l.textbook} B${l.lesson_number}` });
    });
  });

  // Tạo câu hỏi trắc nghiệm từ vựng động từ các từ đã học
  if (studiedVocab.length >= 4) {
    const pickedVocab = [...studiedVocab].sort(() => Math.random() - 0.5).slice(0, 4);
    pickedVocab.forEach((w, idx) => {
      const distractors = studiedVocab
        .filter((other) => other.id !== w.id && other.lesson_usage?.meaning !== w.lesson_usage?.meaning)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((d) => d.lesson_usage?.meaning || "");
      const opts = [w.lesson_usage?.meaning || "", ...distractors].sort(() => Math.random() - 0.5);
      poolQuestions.push({
        id: `rr_voc_${idx}`,
        type: "meaning_mc",
        level: "Nhận biết",
        origin_tag: `Từ vựng đã học`,
        prompt: `Chọn nghĩa đúng (trong bài học) của từ “${w.hanzi}” (${w.pinyin}):`,
        options: opts,
        answer: w.lesson_usage?.meaning || "",
        explanation: `${w.hanzi} (${w.pinyin}) – [${w.lesson_usage?.part_of_speech}]: ${w.lesson_usage?.meaning}. ${w.chinese_explanation || ""}`,
        mistake_category: "Từ vựng"
      });
    });
  }

  // 3. Câu hỏi từ các chuyên đề nâng cao đã học
  store.stations.forEach((st) => {
    st.packages.filter((p) => studiedPkgIds.includes(p.id)).forEach((p) => {
      (p.exercises || []).slice(0, 2).forEach((e, idx) => {
        poolQuestions.push({ ...e, id: `rr_adv_${p.id}_${idx}`, origin_tag: `Đã học · ${st.shortTitle}` });
      });
    });
  });

  if (!poolQuestions.length) {
    box.innerHTML = `
      <div class="card card-yellow">
        <h3>🎲 Chưa có kiến thức nào được đánh dấu “Đang học” hoặc “Đã hoàn thành”</h3>
        <p class="muted-sm">Để đảm bảo nguyên tắc <strong>không đưa kiến thức chưa học vào Ôn tập ngẫu nhiên</strong>, bạn hãy vào một bài giáo trình hoặc chuyên đề nâng cao và chuyển trạng thái sang <em>Đang học</em> hoặc <em>Đã hoàn thành</em> trước nhé!</p>
        <a href="#basics" class="btn btn-primary btn-sm" style="margin-top:8px;">Đi tới Kiến thức căn bản →</a>
      </div>
    `;
    return;
  }

  const finalSet = [...poolQuestions].sort(() => Math.random() - 0.5).slice(0, 10);

  box.innerHTML = `
    <div class="card card-mint" style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <strong>🎲 Bộ đề ôn ngẫu nhiên chỉ lấy từ kiến thức đã học</strong>
          <div class="muted-sm">Phạm vi hiện tại: ${studiedLessons.length} bài giáo trình đã học · ${studiedPkgIds.length} chuyên đề nâng cao đã học · ${store.state.mistakes.length} lỗi cũ.</div>
        </div>
        <button class="btn btn-sm btn-primary" id="btnShuffleRandom">🎲 Tạo bộ đề mới</button>
      </div>
    </div>
    <div id="randomQuizHost"></div>
  `;

  box.querySelector("#btnShuffleRandom")?.addEventListener("click", () => renderRandomReview(box));
  renderExerciseSet(box.querySelector("#randomQuizHost"), finalSet, {
    title: "Bài ôn tập ngẫu nhiên cá nhân hóa",
    category: "Ôn tập ngẫu nhiên",
    sourceRef: "Ôn tập ngẫu nhiên",
    testType: "random_review"
  });
}

function renderProgress(box, rerender) {
  const stats = store.getStats();
  const history = store.state.testHistory || [];

  box.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3>📚 Tiến độ 3 bộ giáo trình</h3>
        ${stats.bookProgress.map((b) => `
          <div class="bar-chart-row">
            <strong>${escapeHtml(b.name)}</strong>
            <div class="progress-track"><div class="progress-fill" style="width:${b.pct}%"></div></div>
            <span class="text-right"><strong>${b.done}/${b.total}</strong></span>
          </div>
        `).join("")}

        <h3 style="margin-top:18px;">📖 Phân bổ Sổ từ vựng đã nạp</h3>
        <div class="bar-chart-row">
          <span>Đã nhớ</span>
          <div class="progress-track"><div class="progress-fill" style="width:${stats.totalVocabLoaded ? Math.round((stats.masteredVocab / stats.totalVocabLoaded) * 100) : 0}%"></div></div>
          <span class="text-right"><strong>${stats.masteredVocab}</strong></span>
        </div>
        <div class="bar-chart-row">
          <span>Đang học</span>
          <div class="progress-track"><div class="progress-fill" style="width:${stats.totalVocabLoaded ? Math.round((stats.learningVocab / stats.totalVocabLoaded) * 100) : 0}%; background:var(--yellow-300);"></div></div>
          <span class="text-right"><strong>${stats.learningVocab}</strong></span>
        </div>
        <div class="bar-chart-row">
          <span>Cần ôn tập</span>
          <div class="progress-track"><div class="progress-fill" style="width:${stats.totalVocabLoaded ? Math.round((stats.reviewVocab / stats.totalVocabLoaded) * 100) : 0}%; background:var(--coral-500);"></div></div>
          <span class="text-right"><strong>${stats.reviewVocab}</strong></span>
        </div>
      </div>

      <div class="card">
        <h3>🚀 Tiến độ 7 Trạm nâng cao</h3>
        ${stats.stationStats.map((s) => `
          <div class="bar-chart-row">
            <span>${escapeHtml(s.title)}</span>
            <div class="progress-track"><div class="progress-fill" style="width:${s.pct}%"></div></div>
            <span class="text-right"><strong>${s.done}/${s.total}</strong></span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <h3>🏆 Lịch sử làm bài tập & kiểm tra</h3>
      ${history.length ? `
        <table class="data-table">
          <thead><tr><th>Thời gian</th><th>Nội dung</th><th>Kết quả</th></tr></thead>
          <tbody>
            ${history.slice(0, 15).map((h) => `
              <tr>
                <td class="muted-sm">${escapeHtml(h.date)}</td>
                <td><strong>${escapeHtml(h.title)}</strong></td>
                <td><span class="badge badge-mint">${h.score}/${h.total} (${h.total ? Math.round((h.score / h.total) * 100) : 0}%)</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<p class="muted-sm">Chưa có lịch sử kiểm tra nào. Hãy làm bài luyện tập sau bài học hoặc kiểm tra cụm bài để hệ thống ghi nhận điểm nhé!</p>`}
    </div>

    <div class="card card-yellow">
      <h3>💾 Lưu trữ & Sao lưu tiến độ (Quan trọng)</h3>
      <p class="muted-sm" style="margin-bottom:10px;">
        <strong>Giới hạn lưu trữ cục bộ:</strong> Tiến độ học tập hiện được lưu tự động bằng <code>localStorage</code> trên trình duyệt máy tính này. Nếu bạn đổi máy tính, đổi trình duyệt hoặc xóa dữ liệu trình duyệt, tiến độ có thể bị mất. Hãy dùng nút <strong>Sao lưu tiến độ</strong> định kỳ để lưu một bản dự phòng an toàn về máy!
      </p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button class="btn btn-primary btn-sm" id="btnBackupProgress">⬇ Tải file sao lưu tiến độ (JSON)</button>
        <label class="btn btn-outline btn-sm" style="cursor:pointer;">
          ⬆ Khôi phục tiến độ từ file JSON
          <input type="file" id="inpRestoreProgress" accept=".json" hidden />
        </label>
      </div>
    </div>
  `;

  box.querySelector("#btnBackupProgress")?.addEventListener("click", () => {
    const blob = new Blob([store.exportProgressJson()], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tien-do-hoc-tieng-trung-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast("Đã tải tệp sao lưu tiến độ thành công!");
  });

  box.querySelector("#inpRestoreProgress")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      store.importProgressJson(txt);
      showToast("Đã khôi phục tiến độ thành công!");
      rerender();
    } catch {
      showToast("Tệp JSON không hợp lệ, vui lòng kiểm tra lại.");
    }
  });
}

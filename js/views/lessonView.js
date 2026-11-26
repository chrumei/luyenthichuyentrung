// Trang chi tiết 1 bài học: 4 Tab (Từ vựng 生词 · Ngữ pháp 语法 · Bài khóa 课文 · Luyện tập 练习)

import { store } from "../store.js";
import { audioManager } from "../audio.js";
import { showVocabDetailPanel } from "../hanziPanel.js";
import { renderExerciseSet } from "../exerciseEngine.js";
import {
  escapeHtml,
  makeClickableHanzi,
  highlightVocabInText,
  LESSON_STATUS_LABELS,
  showToast
} from "../mascots.js";

const viewPrefs = {
  tab: "vocab",
  showPinyin: true,
  showVietnamese: true,
  expandExamples: true,
  expandAdditional: false,
  vocabSearch: "",
  vocabFilter: "all",
  textShowPinyin: true,
  textShowVi: true,
  audioRate: 0.9
};

export async function renderLessonView(container, lessonId, initialTab = null) {
  if (initialTab && ["vocab", "grammar", "text", "exercise"].includes(initialTab)) {
    viewPrefs.tab = initialTab;
  }
  container.innerHTML = `<div class="loading-box">Đang mở bài học...</div>`;
  const lesson = await store.getLesson(lessonId);

  if (!lesson) {
    container.innerHTML = `
      <div class="card">
        <h3>Không tìm thấy dữ liệu chi tiết cho bài học này</h3>
        <p class="muted">Quay lại danh sách giáo trình để chọn bài học khác.</p>
        <a href="#basics" class="btn btn-primary">← Về Kiến thức căn bản</a>
      </div>
    `;
    return;
  }

  function render() {
    const st = store.getLessonStatus(lesson.id);

    container.innerHTML = `
      <div class="card card-mint">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-bottom:6px;">
              <a href="#basics" class="btn btn-sm btn-outline">← Quay lại ${escapeHtml(lesson.textbook)}</a>
            </div>
            <h2 style="margin-bottom:2px;">
              Bài ${lesson.lesson_number}: <span class="zh">${escapeHtml(lesson.title_zh)}</span>
            </h2>
            <p class="muted-sm">${escapeHtml(lesson.title_vi)}</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label class="muted-sm" for="lessonStatusSel">Trạng thái:</label>
            <select id="lessonStatusSel" class="select-input status-${st}">
              ${Object.entries(LESSON_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${st === k ? "selected" : ""}>${v}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="tabs-bar" style="margin-top:14px; margin-bottom:0; border-bottom:none; padding-bottom:0;">
          <button class="tab-btn ${viewPrefs.tab === "vocab" ? "active" : ""}" data-lesson-tab="vocab">📖 Từ vựng 生词 (${(lesson.vocabulary || []).length})</button>
          <button class="tab-btn ${viewPrefs.tab === "grammar" ? "active" : ""}" data-lesson-tab="grammar">🧩 Ngữ pháp 语法 (${(lesson.grammar || []).length})</button>
          <button class="tab-btn ${viewPrefs.tab === "text" ? "active" : ""}" data-lesson-tab="text">📜 Bài khóa 课文 (${(lesson.texts || []).length})</button>
          <button class="tab-btn ${viewPrefs.tab === "exercise" ? "active" : ""}" data-lesson-tab="exercise">✍️ Luyện tập 练习 (${(lesson.exercises || []).length})</button>
        </div>
      </div>

      <div id="lessonTabContent"></div>
    `;

    container.querySelector("#lessonStatusSel")?.addEventListener("change", (e) => {
      store.setLessonStatus(lesson.id, e.target.value);
      showToast(`Đã lưu trạng thái bài học: ${LESSON_STATUS_LABELS[e.target.value]}`);
      render();
    });

    container.querySelectorAll("[data-lesson-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        audioManager.stop();
        viewPrefs.tab = btn.dataset.lessonTab;
        render();
      });
    });

    const content = container.querySelector("#lessonTabContent");
    if (viewPrefs.tab === "vocab") renderVocabTab(content, lesson, render);
    else if (viewPrefs.tab === "grammar") renderGrammarTab(content, lesson);
    else if (viewPrefs.tab === "text") renderTextTab(content, lesson, render);
    else if (viewPrefs.tab === "exercise") renderExerciseTab(content, lesson);
  }

  render();
}

function renderVocabTab(box, lesson, rerender) {
  const allOfficial = lesson.vocabulary || [];
  const filtered = allOfficial.filter((w) => {
    const q = viewPrefs.vocabSearch.trim().toLowerCase();
    const matchText = !q ||
      w.hanzi.includes(q) ||
      (w.pinyin || "").toLowerCase().includes(q) ||
      (w.lesson_usage?.meaning || "").toLowerCase().includes(q);
    if (!matchText) return false;
    const st = store.getVocabStatus(w.id);
    if (viewPrefs.vocabFilter === "needs_review") return st === "needs_review";
    if (viewPrefs.vocabFilter === "mastered") return st === "mastered";
    if (viewPrefs.vocabFilter === "unlearned") return st === "unlearned" || st === "learning";
    return true;
  });

  box.innerHTML = `
    <div class="toolbar">
      <input type="search" class="search-input" id="vocabSearchInput" placeholder="Tìm chữ Hán, pinyin, nghĩa..." value="${escapeHtml(viewPrefs.vocabSearch)}" style="flex:1; min-width:170px;" />
      <button class="btn-chip ${viewPrefs.showPinyin ? "active" : ""}" id="togglePy">Pinyin</button>
      <button class="btn-chip ${viewPrefs.showVietnamese ? "active" : ""}" id="toggleVi">Nghĩa Việt</button>
      <button class="btn-chip ${viewPrefs.expandExamples ? "active" : ""}" id="toggleEx">Ví dụ</button>
      <button class="btn-chip ${viewPrefs.expandAdditional ? "active" : ""}" id="toggleExtra">Chức năng bổ sung</button>
      <select class="select-input btn-sm" id="vocabFilterSel">
        <option value="all" ${viewPrefs.vocabFilter === "all" ? "selected" : ""}>Tất cả (${allOfficial.length})</option>
        <option value="needs_review" ${viewPrefs.vocabFilter === "needs_review" ? "selected" : ""}>🔖 Cần ôn lại</option>
        <option value="mastered" ${viewPrefs.vocabFilter === "mastered" ? "selected" : ""}>✓ Đã nhớ</option>
        <option value="unlearned" ${viewPrefs.vocabFilter === "unlearned" ? "selected" : ""}>📘 Chưa thuộc</option>
      </select>
    </div>

    <div class="muted-sm" style="margin-bottom:10px;">
      💡 Nhấp từng <strong>chữ Hán</strong> để mở bảng Phân tích chữ Hán bên phải · Nhấp <strong>“Xem chi tiết”</strong> để xem đầy đủ ghi chú · Luôn phân tách rõ <strong>A. Chức năng trong bài</strong> và <strong>B. Chức năng bổ sung</strong>.
    </div>

    ${filtered.length ? filtered.map((w, idx) => renderVocabCard(w, idx)).join("") : `<div class="card muted">Không có từ vựng nào khớp bộ lọc.</div>`}

    ${lesson.proper_nouns?.length ? `
      <div class="card card-cream">
        <h4>🏷 Danh từ riêng trong bài <span class="zh">专有名词</span></h4>
        <div class="grid-2" style="margin-top:8px;">
          ${lesson.proper_nouns.map((pn) => `
            <div style="background:#fff; padding:10px 12px; border-radius:12px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong class="zh" style="font-size:1.15rem;">${makeClickableHanzi(pn.hanzi)}</strong>
                ${viewPrefs.showPinyin ? `<span class="pinyin" style="margin-left:6px;">${escapeHtml(pn.pinyin)}</span>` : ""}
                ${viewPrefs.showVietnamese ? `<div class="muted-sm">${escapeHtml(pn.meaning)}</div>` : ""}
              </div>
              <button class="icon-btn" data-speak="${escapeHtml(pn.hanzi)}" title="Đọc (TTS)">🔊</button>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}

    ${lesson.same_char_expansion ? `
      <div class="card card-yellow">
        <h4>🌱 Phần mở rộng trong sách – Từ đồng tự <span class="zh">扩展 · 同字词</span></h4>
        <p class="muted-sm" style="margin-bottom:8px;">Tách riêng khỏi danh sách từ mới chính thức · Nhóm chữ: <strong class="zh" style="font-size:1.1rem;">${makeClickableHanzi(lesson.same_char_expansion.char)}</strong></p>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          ${lesson.same_char_expansion.words.map((sw) => `
            <span class="collocation-pill" style="background:#fff;">
              <strong class="zh">${makeClickableHanzi(sw.hanzi)}</strong>
              <span class="pinyin">(${escapeHtml(sw.pinyin)})</span> – ${escapeHtml(sw.meaning)}
            </span>
          `).join("")}
        </div>
        ${(lesson.same_char_expansion.examples || []).map((ex) => `
          <div class="example-box">
            <div class="zh">${makeClickableHanzi(ex.chinese)}</div>
            <div class="muted-sm">${escapeHtml(ex.vietnamese)}</div>
          </div>
        `).join("")}
      </div>
    ` : ""}

    ${lesson.supplemental_vocabulary?.length ? `
      <div class="card">
        <h4>➕ Từ bổ sung ngoài danh sách chính thức (Gia sư thêm)</h4>
        <p class="muted-sm" style="margin-bottom:10px;">Các từ này được tách riêng hoàn toàn khỏi từ mới chính thức của giáo trình.</p>
        ${lesson.supplemental_vocabulary.map((w, i) => renderVocabCard(w, i)).join("")}
      </div>
    ` : ""}
  `;

  box.querySelector("#vocabSearchInput")?.addEventListener("input", (e) => {
    viewPrefs.vocabSearch = e.target.value;
    renderVocabTab(box, lesson, rerender);
    box.querySelector("#vocabSearchInput")?.focus();
  });
  box.querySelector("#togglePy")?.addEventListener("click", () => { viewPrefs.showPinyin = !viewPrefs.showPinyin; renderVocabTab(box, lesson, rerender); });
  box.querySelector("#toggleVi")?.addEventListener("click", () => { viewPrefs.showVietnamese = !viewPrefs.showVietnamese; renderVocabTab(box, lesson, rerender); });
  box.querySelector("#toggleEx")?.addEventListener("click", () => { viewPrefs.expandExamples = !viewPrefs.expandExamples; renderVocabTab(box, lesson, rerender); });
  box.querySelector("#toggleExtra")?.addEventListener("click", () => { viewPrefs.expandAdditional = !viewPrefs.expandAdditional; renderVocabTab(box, lesson, rerender); });
  box.querySelector("#vocabFilterSel")?.addEventListener("change", (e) => { viewPrefs.vocabFilter = e.target.value; renderVocabTab(box, lesson, rerender); });

  const vocabIndex = new Map([...allOfficial, ...(lesson.supplemental_vocabulary || [])].map((w) => [w.id, w]));

  box.querySelectorAll("[data-speak]").forEach((btn) => {
    btn.addEventListener("click", () => {
      audioManager.speak(btn.dataset.speak);
    });
  });

  box.querySelectorAll("[data-vocab-detail]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const word = vocabIndex.get(btn.dataset.vocabDetail);
      if (word) showVocabDetailPanel(word);
    });
  });

  box.querySelectorAll("[data-toggle-extra-card]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = box.querySelector(`#extra_${btn.dataset.toggleExtraCard}`);
      if (!target) return;
      const hidden = target.classList.toggle("hidden");
      btn.textContent = hidden ? `▾ Mở Chức năng bổ sung (${btn.dataset.count})` : "▴ Thu gọn Chức năng bổ sung";
    });
  });

  box.querySelectorAll("[data-mark-vocab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.wordId;
      const targetStatus = btn.dataset.markVocab;
      const current = store.getVocabStatus(id);
      const next = current === targetStatus ? "learning" : targetStatus;
      store.setVocabStatus(id, next);
      showToast(next === "mastered" ? "Đã đánh dấu: Đã nhớ ✓" : next === "needs_review" ? "Đã lưu vào danh sách Cần ôn tập 🔖" : "Chuyển sang trạng thái Đang học");
      renderVocabTab(box, lesson, rerender);
    });
  });
}

function renderVocabCard(w, idx) {
  const st = store.getVocabStatus(w.id);
  const extraCount = (w.additional_usages || []).length;
  const meaningsList = Array.isArray(w.lesson_usage?.meanings) && w.lesson_usage.meanings.length
    ? w.lesson_usage.meanings
    : [w.lesson_usage?.meaning || ""];

  return `
    <article class="vocab-card" data-card-word="${w.id}">
      <div class="vocab-top">
        <div class="vocab-head">
          <span class="badge badge-gray">#${w.order || idx + 1}</span>
          <span class="vocab-hanzi">${makeClickableHanzi(w.hanzi)}</span>
          ${viewPrefs.showPinyin ? `<span class="pinyin" style="font-size:1.08rem;">${escapeHtml(w.pinyin)}</span>` : ""}
          ${w.is_out_of_syllabus ? `<span class="badge badge-yellow">* Ngoài khung</span>` : ""}
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-sm btn-outline" data-speak="${escapeHtml(w.hanzi)}" title="Phát âm tổng hợp TTS">🔊 Nghe (TTS)</button>
          <button class="btn btn-sm ${st === "mastered" ? "btn-primary" : "btn-outline"}" data-mark-vocab="mastered" data-word-id="${w.id}">✓ Đã nhớ</button>
          <button class="btn btn-sm ${st === "needs_review" ? "btn-danger" : "btn-outline"}" data-mark-vocab="needs_review" data-word-id="${w.id}">🔖 Cần ôn</button>
          <button class="btn btn-sm btn-yellow" data-vocab-detail="${w.id}">Chi tiết →</button>
        </div>
      </div>

      <!-- A. CHỨC NĂNG TRONG BÀI HỌC (Ưu tiên đầu tiên & nổi bật) -->
      <div class="usage-block-lesson">
        <div class="usage-tag usage-tag-lesson">A. Chức năng trong bài học 课文中的用法</div>
        <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;">
          <span class="badge badge-mint">${escapeHtml(w.lesson_usage?.part_of_speech || "")}</span>
          ${viewPrefs.showVietnamese
            ? (meaningsList.length > 1
              ? `<ol style="margin:2px 0 2px 18px; padding:0;">${meaningsList.map((m) => `<li><strong>${escapeHtml(m)}</strong></li>`).join("")}</ol>`
              : `<strong>${escapeHtml(meaningsList[0])}</strong>`)
            : `<span class="muted-sm"><em>(Đang ẩn nghĩa tiếng Việt)</em></span>`
          }
        </div>
        ${w.lesson_usage?.structure ? `<div class="muted-sm" style="margin-top:4px;"><strong>Cấu trúc:</strong> ${escapeHtml(w.lesson_usage.structure)}</div>` : ""}
        ${w.lesson_usage?.explanation && viewPrefs.showVietnamese ? `<div style="font-size:0.9rem; margin-top:3px;">${escapeHtml(w.lesson_usage.explanation)}</div>` : ""}
        ${w.chinese_explanation ? `<div class="muted-sm" style="margin-top:3px;"><strong>Giải thích tiếng Trung:</strong> <span class="zh">${escapeHtml(w.chinese_explanation)}</span></div>` : ""}

        ${viewPrefs.expandExamples && (w.lesson_usage?.examples || []).length ? `
          <div>
            ${w.lesson_usage.examples.map((ex) => `
              <div class="example-box">
                <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
                  <div>
                    <div class="zh" style="font-size:0.98rem;">${makeClickableHanzi(ex.chinese)} ${ex.from_text ? `<span class="badge badge-mint" style="font-size:0.7rem;">Trích bài khóa</span>` : ""}</div>
                    ${viewPrefs.showPinyin ? `<div class="pinyin" style="font-size:0.84rem;">${escapeHtml(ex.pinyin)}</div>` : ""}
                    ${viewPrefs.showVietnamese ? `<div class="muted-sm">${escapeHtml(ex.vietnamese)}</div>` : ""}
                  </div>
                  <button class="icon-btn" style="flex-shrink:0;" data-speak="${escapeHtml(ex.chinese)}" title="Nghe câu ví dụ (TTS)">🔊</button>
                </div>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>

      <!-- B. CHỨC NĂNG BỔ SUNG (Tách riêng, có thể mở rộng/thu gọn) -->
      ${extraCount > 0 ? `
        <div style="margin-top:8px;">
          <button class="btn-chip" data-toggle-extra-card="${w.id}" data-count="${extraCount}">
            ${viewPrefs.expandAdditional ? "▴ Thu gọn Chức năng bổ sung" : `▾ Mở Chức năng bổ sung (${extraCount})`}
          </button>
          <div id="extra_${w.id}" class="usage-block-additional ${viewPrefs.expandAdditional ? "" : "hidden"}">
            <div class="usage-tag usage-tag-extra">B. Chức năng bổ sung 其他用法 (Mở rộng theo từ điển chuẩn)</div>
            ${w.additional_usages.map((u, uIdx) => `
              <div style="margin-top:${uIdx ? "10px" : "4px"}; padding-top:${uIdx ? "8px" : "0"}; border-top:${uIdx ? "1px dashed #e5c97a" : "none"};">
                <div><span class="badge badge-yellow">Chức năng bổ sung ${uIdx + 1}: ${escapeHtml(u.part_of_speech)}</span></div>
                ${viewPrefs.showVietnamese ? `
                  <ol style="margin:5px 0 4px 18px; padding:0; font-size:0.92rem;">
                    ${(u.meanings || []).map((m) => `<li>${escapeHtml(m)}</li>`).join("")}
                  </ol>
                ` : ""}
                ${u.structure ? `<div class="muted-sm"><strong>Cấu trúc:</strong> ${escapeHtml(u.structure)}</div>` : ""}
                ${u.difference_note ? `<div class="muted-sm" style="color:#7c4a03; margin-top:3px;"><strong>Khác biệt cách dùng:</strong> ${escapeHtml(u.difference_note)}</div>` : ""}
                ${viewPrefs.expandExamples && (u.examples || []).map((ex) => `
                  <div class="example-box">
                    <div class="zh">${makeClickableHanzi(ex.chinese)}</div>
                    ${viewPrefs.showPinyin ? `<div class="pinyin" style="font-size:0.84rem;">${escapeHtml(ex.pinyin)}</div>` : ""}
                    ${viewPrefs.showVietnamese ? `<div class="muted-sm">${escapeHtml(ex.vietnamese)}</div>` : ""}
                  </div>
                `).join("")}
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${(w.collocations?.length || w.usage_note || w.common_errors) ? `
        <div style="margin-top:10px; padding-top:8px; border-top:1px solid var(--border); font-size:0.87rem;">
          ${w.collocations?.length ? `<div style="margin-bottom:4px;"><strong>Kết hợp từ:</strong> ${w.collocations.map((c) => `<span class="collocation-pill zh">${escapeHtml(c)}</span>`).join("")}</div>` : ""}
          ${w.usage_note ? `<div class="muted-sm" style="margin-top:4px;"><strong>📌 Ghi chú:</strong> ${escapeHtml(w.usage_note)}</div>` : ""}
          ${w.common_errors ? `<div style="color:var(--coral-700); font-size:0.85rem; margin-top:4px;"><strong>⚠ Dễ nhầm / Lỗi thường gặp:</strong> ${escapeHtml(w.common_errors)}</div>` : ""}
        </div>
      ` : ""}
    </article>
  `;
}

function renderGrammarTab(box, lesson) {
  const list = lesson.grammar || [];
  box.innerHTML = `
    ${list.map((g, idx) => `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
          <h3>${idx + 1}. <span class="zh">${escapeHtml(g.title)}</span></h3>
          <span class="badge badge-mint">Chú thích ${idx + 1} (Sách gốc)</span>
        </div>
        <div class="usage-block-lesson" style="margin-top:0; margin-bottom:10px;">
          <div><strong>Công thức:</strong> <span class="zh" style="font-weight:700; color:var(--green-700);">${escapeHtml(g.formula)}</span></div>
          <div style="margin-top:4px;"><strong>Ý nghĩa:</strong> ${escapeHtml(g.meaning)}</div>
        </div>
        <p><strong>Cách sử dụng:</strong> ${escapeHtml(g.usage)}</p>
        <p><strong>Ngữ cảnh / Điều kiện dùng:</strong> ${escapeHtml(g.context)}</p>

        <div style="margin:10px 0;">
          <strong>Ví dụ minh họa:</strong>
          ${(g.examples || []).map((ex) => `
            <div class="example-box">
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <div>
                  <div class="zh" style="font-size:1rem;">${makeClickableHanzi(ex.chinese)}</div>
                  <div class="pinyin" style="font-size:0.85rem;">${escapeHtml(ex.pinyin)}</div>
                  <div class="muted-sm">${escapeHtml(ex.vietnamese)}</div>
                </div>
                <button class="icon-btn" data-speak="${escapeHtml(ex.chinese)}">🔊</button>
              </div>
            </div>
          `).join("")}
        </div>

        ${g.important_notes ? `<div class="card card-yellow" style="padding:11px 13px; margin-bottom:8px;"><strong>💡 Lưu ý quan trọng:</strong> ${escapeHtml(g.important_notes)}</div>` : ""}
        ${g.common_errors ? `<div class="feedback-box feedback-err" style="margin-top:0; margin-bottom:8px;"><strong>⚠ Lỗi thường gặp:</strong> ${escapeHtml(g.common_errors)}</div>` : ""}
        ${g.comparison ? `<div class="card card-cream" style="padding:11px 13px; margin-bottom:8px;"><strong>⚖ So sánh nhanh:</strong> ${escapeHtml(g.comparison)}</div>` : ""}

        ${g.mini_practice?.length ? `
          <div style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border-strong);">
            <strong>✍️ Bài tập vận dụng nhanh (Sách gốc):</strong>
            ${g.mini_practice.map((mp, mIdx) => `
              <div style="margin-top:8px; padding:9px 12px; background:var(--bg-soft); border-radius:10px;">
                <div class="zh">${mIdx + 1}. ${escapeHtml(mp.prompt)}</div>
                <details style="margin-top:5px;">
                  <summary style="cursor:pointer; color:var(--green-600); font-weight:600; font-size:0.86rem;">Xem đáp án gợi ý & giải thích</summary>
                  <div style="margin-top:5px; font-size:0.88rem;">
                    <div class="zh"><strong>Gợi ý:</strong> ${escapeHtml(mp.sample_answer)}</div>
                    <div class="muted-sm">${escapeHtml(mp.explanation)}</div>
                  </div>
                </details>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `).join("")}

    ${lesson.comparison_section ? `
      <div class="card card-yellow">
        <h3>⚖ Mục So sánh trong sách <span class="zh">${escapeHtml(lesson.comparison_section.label || "比一比")}</span>: <span class="zh">${escapeHtml(lesson.comparison_section.pair)}</span></h3>
        <p style="margin-top:6px;"><strong>Điểm giống nhau:</strong> ${escapeHtml(lesson.comparison_section.similarity)}</p>
        <table class="data-table" style="margin-top:10px;">
          <thead>
            <tr>
              <th>Tiêu chí</th>
              <th class="zh">${escapeHtml(lesson.comparison_section.term_a)}</th>
              <th class="zh">${escapeHtml(lesson.comparison_section.term_b)}</th>
            </tr>
          </thead>
          <tbody>
            ${lesson.comparison_section.differences.map((d) => `
              <tr>
                <td><strong>${escapeHtml(d.criterion)}</strong></td>
                <td>${escapeHtml(d.a)}</td>
                <td>${escapeHtml(d.b)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    ` : ""}

    ${lesson.collocations_table?.length ? `
      <div class="card card-cream">
        <h3>🔗 Bảng Kết hợp từ trong sách <span class="zh">词语搭配</span></h3>
        <table class="data-table" style="margin-top:10px;">
          <thead><tr><th>Quan hệ ngữ pháp</th><th>Từ trung tâm</th><th>Các từ thường kết hợp</th></tr></thead>
          <tbody>
            ${lesson.collocations_table.map((row) => `
              <tr>
                <td>${escapeHtml(row.relation)}</td>
                <td class="zh"><strong>${makeClickableHanzi(row.head)}</strong></td>
                <td class="zh">${makeClickableHanzi(row.partners)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    ` : ""}
  `;

  box.querySelectorAll("[data-speak]").forEach((btn) => {
    btn.addEventListener("click", () => audioManager.speak(btn.dataset.speak));
  });
}

function renderTextTab(box, lesson, rerender) {
  const texts = lesson.texts || [];
  const vocabList = lesson.vocabulary || [];
  const vocabMap = new Map(vocabList.map((w) => [w.id, w]));

  box.innerHTML = `
    <div class="toolbar">
      <button class="btn-chip ${viewPrefs.textShowPinyin ? "active" : ""}" id="txtTogglePy">Bật/Tắt Pinyin</button>
      <button class="btn-chip ${viewPrefs.textShowVi ? "active" : ""}" id="txtToggleVi">Bật/Tắt Bản dịch</button>
      <label class="muted-sm">Tốc độ đọc:</label>
      <select class="select-input btn-sm" id="txtAudioRate">
        <option value="0.75" ${viewPrefs.audioRate === 0.75 ? "selected" : ""}>0.75x (Chậm)</option>
        <option value="0.9" ${viewPrefs.audioRate === 0.9 ? "selected" : ""}>0.9x (Vừa)</option>
        <option value="1.0" ${viewPrefs.audioRate === 1.0 ? "selected" : ""}>1.0x (Chuẩn)</option>
      </select>
      <button class="btn btn-sm btn-danger" id="txtStopAudio">⏹ Dừng đọc</button>
      <span class="badge badge-yellow">ℹ Audio tổng hợp (TTS tiếng Phổ thông)</span>
    </div>

    ${texts.map((t, idx) => `
      <div class="card">
        <div class="section-header">
          <div>
            <h3>Bài khóa ${idx + 1}: <span class="zh">${escapeHtml(t.title_zh)}</span></h3>
            <p class="muted-sm">${escapeHtml(t.title_vi)}</p>
          </div>
          <button class="btn btn-sm btn-primary" data-play-passage="${idx}">▶ Đọc toàn đoạn (TTS)</button>
        </div>

        <div>
          ${(t.lines || []).map((line) => `
            <div class="text-sentence-row">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                <div style="flex:1;">
                  <div class="zh" style="font-size:1.08rem; line-height:1.7;">
                    ${line.speaker ? `<strong style="color:var(--green-600);">${escapeHtml(line.speaker)}:</strong> ` : ""}
                    ${highlightVocabInText(line.chinese, vocabList)}
                  </div>
                  ${viewPrefs.textShowPinyin ? `<div class="pinyin" style="font-size:0.86rem; margin-top:2px;">${escapeHtml(line.pinyin)}</div>` : ""}
                  ${viewPrefs.textShowVi ? `<div class="muted-sm" style="margin-top:2px;">${escapeHtml(line.vietnamese)}</div>` : ""}
                </div>
                <button class="icon-btn" style="flex-shrink:0;" data-speak-line="${escapeHtml(line.chinese)}" title="Nghe câu này (TTS)">🔊</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("")}

    ${lesson.reading_questions?.length ? `
      <div class="card card-mint">
        <h3>❓ Câu hỏi đọc hiểu sau bài khóa <span class="zh">根据课文内容回答问题</span></h3>
        ${lesson.reading_questions.map((rq, idx) => `
          <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:11px 14px; margin-top:10px;">
            <div class="zh" style="font-weight:600;">${idx + 1}. ${makeClickableHanzi(rq.question_zh)}</div>
            <div class="muted-sm">${escapeHtml(rq.question_vi)}</div>
            <details style="margin-top:6px;">
              <summary style="cursor:pointer; color:var(--green-600); font-weight:600; font-size:0.86rem;">Xem đáp án tham khảo</summary>
              <div style="margin-top:5px;">
                <div class="zh">${makeClickableHanzi(rq.answer_zh)}</div>
                <div class="muted-sm">${escapeHtml(rq.answer_vi)}</div>
              </div>
            </details>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;

  box.querySelector("#txtTogglePy")?.addEventListener("click", () => { viewPrefs.textShowPinyin = !viewPrefs.textShowPinyin; renderTextTab(box, lesson, rerender); });
  box.querySelector("#txtToggleVi")?.addEventListener("click", () => { viewPrefs.textShowVi = !viewPrefs.textShowVi; renderTextTab(box, lesson, rerender); });
  box.querySelector("#txtAudioRate")?.addEventListener("change", (e) => {
    viewPrefs.audioRate = Number(e.target.value);
    audioManager.setRate(viewPrefs.audioRate);
  });
  box.querySelector("#txtStopAudio")?.addEventListener("click", () => audioManager.stop());

  box.querySelectorAll("[data-speak-line]").forEach((btn) => {
    btn.addEventListener("click", () => audioManager.speak(btn.dataset.speakLine, { rate: viewPrefs.audioRate }));
  });

  box.querySelectorAll("[data-play-passage]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const passage = texts[Number(btn.dataset.playPassage)];
      if (!passage) return;
      const sentences = (passage.lines || []).map((l) => l.chinese);
      audioManager.speakSequence(sentences, { rate: viewPrefs.audioRate });
    });
  });

  box.querySelectorAll(".text-vocab-hl").forEach((el) => {
    el.addEventListener("click", (e) => {
      // Nếu người dùng bấm đúng vào span chữ Hán trong khi giữ Alt thì phân tích chữ, mặc định mở nghĩa từ vựng
      if (!e.altKey) {
        e.stopPropagation();
        const w = vocabMap.get(el.dataset.vocabId);
        if (w) showVocabDetailPanel(w);
      }
    });
  });
}

function renderExerciseTab(box, lesson) {
  renderExerciseSet(box, lesson.exercises || [], {
    title: `Luyện tập sau bài: ${lesson.textbook} – Bài ${lesson.lesson_number} (${lesson.title_zh})`,
    category: "Bài tập giáo trình",
    sourceRef: `${lesson.textbook} Bài ${lesson.lesson_number}`,
    testType: "lesson_exercise"
  });
}

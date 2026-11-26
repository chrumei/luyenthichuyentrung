// Bảng phụ bên phải (30% desktop / drawer di động): Phân tích chữ Hán & Chi tiết từ vựng

import { store } from "./store.js";
import { audioManager } from "./audio.js";
import { escapeHtml, makeClickableHanzi, showToast } from "./mascots.js";
import { mountQuickQuizWidget } from "./quickAssistant.js";
import { mountStudyQaWidget } from "./studyQaAssistant.js";

let activeWriter = null;
let homeAssistantTab = "qa"; // qa | quiz

function isOnHomeRoute() {
  const hash = (location.hash || "#home").replace(/^#/, "");
  const route = hash.split("/")[0];
  return !route || route === "home";
}

function openSidePanelIfNeeded() {
  const panel = document.getElementById("sidePanel");
  const backdrop = document.getElementById("drawerBackdrop");
  if (!panel) return;
  if (window.innerWidth <= 1080) {
    panel.classList.add("mobile-open");
    backdrop?.classList.add("open");
  } else if (!isOnHomeRoute()) {
    panel.classList.add("temp-open");
  }
}

export function closeMobileDrawer() {
  const panel = document.getElementById("sidePanel");
  panel?.classList.remove("mobile-open");
  panel?.classList.remove("temp-open");
  document.getElementById("drawerBackdrop")?.classList.remove("open");
}

export function renderDefaultSidePanel() {
  const titleEl = document.getElementById("sidePanelTitle");
  const bodyEl = document.getElementById("sidePanelBody");
  const ws = document.getElementById("workspaceContainer");
  if (!titleEl || !bodyEl) return;

  const onHome = isOnHomeRoute();
  ws?.classList.toggle("single-column", !onHome);
  closeMobileDrawer();

  if (!onHome) {
    bodyEl.innerHTML = "";
    return;
  }

  const stats = store.getStats();
  titleEl.textContent = "🌿 Trợ lý học tập";
  bodyEl.innerHTML = `
    <div style="display:flex; gap:6px; margin-bottom:10px;">
      <button type="button" class="btn-chip ${homeAssistantTab === "qa" ? "active" : ""}" data-ha-tab="qa" style="flex:1; justify-content:center;">💬 Hỏi kiến thức web</button>
      <button type="button" class="btn-chip ${homeAssistantTab === "quiz" ? "active" : ""}" data-ha-tab="quiz" style="flex:1; justify-content:center;">🎯 Hỏi bài nhanh</button>
    </div>

    <div class="card card-cream" style="padding:12px; margin-bottom:12px;">
      <div id="sideAssistantMainHost"></div>
    </div>

    <div class="card card-mint" style="padding:12px; margin-bottom:0;">
      <div style="font-weight:700; color:var(--green-700); margin-bottom:6px; font-size:0.9rem;">📊 Tiến độ hôm nay</div>
      <div style="display:flex; justify-content:space-between; font-size:0.86rem; margin-bottom:4px;">
        <span>Bài đã hoàn thành</span><strong>${stats.completedLessons}/${stats.totalLessons}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.86rem; margin-bottom:4px;">
        <span>Từ đã nhớ</span><strong>${stats.masteredVocab} từ</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.86rem; margin-bottom:4px;">
        <span>Từ cần ôn lại</span><strong style="color:var(--coral-700);">${stats.reviewVocab} từ</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.86rem;">
        <span>Câu trong Sổ lỗi sai</span><strong>${stats.mistakesCount} câu</strong>
      </div>
    </div>
  `;

  bodyEl.querySelectorAll("[data-ha-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      homeAssistantTab = btn.dataset.haTab;
      renderDefaultSidePanel();
    });
  });

  const host = bodyEl.querySelector("#sideAssistantMainHost");
  if (homeAssistantTab === "qa") {
    mountStudyQaWidget(host, {
      onInspectHanzi: (ch) => showHanziAnalysis(ch)
    });
  } else {
    mountQuickQuizWidget(host, {
      compact: false,
      initialCategory: "all"
    });
  }
}

export function showHanziAnalysis(char) {
  const titleEl = document.getElementById("sidePanelTitle");
  const bodyEl = document.getElementById("sidePanelBody");
  if (!titleEl || !bodyEl) return;

  const info = store.hanziDb?.[char] || null;
  titleEl.textContent = `✍️ Phân tích chữ Hán: ${char}`;
  activeWriter = null;

  bodyEl.innerHTML = `
    ${isOnHomeRoute() ? `
      <div style="margin-bottom:8px;">
        <button type="button" class="btn btn-sm btn-outline" id="btnBackSideAssistant">← Về Trợ lý học tập</button>
      </div>
    ` : ""}
    <div class="text-center">
      <div class="hanzi-stage" id="hanziWriterStage">
        <span class="hanzi-fallback-glyph">${escapeHtml(char)}</span>
      </div>
      <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
        <button class="btn btn-sm btn-primary" id="btnAnimateHanzi">▶ Xem viết nét</button>
        <button class="btn btn-sm btn-outline" id="btnAudioHanzi">🔊 Nghe (TTS)</button>
      </div>
      <div class="pinyin" style="font-size:1.2rem; margin-bottom:4px;">
        ${info ? escapeHtml(info.pinyin) : "Chưa xác minh"}
      </div>
      ${info?.multi_readings ? `<div class="badge badge-yellow" style="margin-bottom:8px;">Chữ đa âm: ${escapeHtml(info.multi_readings)}</div>` : ""}
    </div>

    <dl class="kv-list">
      <dt>Bộ thủ tra cứu</dt>
      <dd>${info ? `<strong>${escapeHtml(info.radical)}</strong> (${escapeHtml(info.radical_name)})` : "<em>Chưa xác minh</em>"}</dd>

      <dt>Số nét</dt>
      <dd>${info ? `<strong>${info.strokes}</strong> nét` : "<em>Chưa xác minh</em>"}</dd>

      <dt>Kết cấu chữ</dt>
      <dd>${info ? escapeHtml(info.structure) : "<em>Chưa xác minh</em>"}</dd>

      <dt>Thành phần</dt>
      <dd>${info ? escapeHtml(info.components) : "<em>Chưa xác minh</em>"}</dd>

      <dt>Thứ tự nét</dt>
      <dd>${info ? escapeHtml(info.stroke_order_note) : "<em>Nhấn 'Xem viết nét' (khi có mạng) hoặc đối chiếu từ điển</em>"}</dd>

      <dt>Nghĩa cơ bản</dt>
      <dd>${info ? escapeHtml(info.basic_meaning) : "<em>Chưa xác minh</em>"}</dd>
    </dl>

    ${info?.common_words?.length ? `
      <div style="margin-top:10px;">
        <div style="font-weight:700; font-size:0.88rem; color:var(--green-700); margin-bottom:6px;">🔗 Từ thường gặp chứa “${escapeHtml(char)}”</div>
        <div>
          ${info.common_words.map((cw) => `<span class="collocation-pill"><strong class="zh">${escapeHtml(cw.zh)}</strong> <span class="muted-sm">(${escapeHtml(cw.py)} – ${escapeHtml(cw.vi)})</span></span>`).join("")}
        </div>
      </div>
    ` : ""}
  `;

  document.getElementById("btnBackSideAssistant")?.addEventListener("click", () => renderDefaultSidePanel());

  // Khởi tạo HanziWriter nếu thư viện đã nạp từ CDN
  const stage = document.getElementById("hanziWriterStage");
  if (window.HanziWriter && stage) {
    try {
      stage.innerHTML = "";
      activeWriter = window.HanziWriter.create(stage, char, {
        width: 158,
        height: 158,
        padding: 8,
        strokeColor: "#1B4332",
        radicalColor: "#2D6A4F",
        outlineColor: "#D8F3E5",
        strokeAnimationSpeed: 1.1,
        delayBetweenStrokes: 260,
        onLoadCharDataError: () => {
          stage.innerHTML = `<span class="hanzi-fallback-glyph">${escapeHtml(char)}</span>`;
          activeWriter = null;
        }
      });
    } catch {
      stage.innerHTML = `<span class="hanzi-fallback-glyph">${escapeHtml(char)}</span>`;
      activeWriter = null;
    }
  }

  document.getElementById("btnAnimateHanzi")?.addEventListener("click", () => {
    if (activeWriter) {
      activeWriter.animateCharacter();
    } else {
      showToast("Hình động nét viết cần kết nối Internet (Hanzi Writer CDN).");
    }
  });

  document.getElementById("btnAudioHanzi")?.addEventListener("click", () => {
    audioManager.speak(char);
  });

  openSidePanelIfNeeded();
}

export function showVocabDetailPanel(word) {
  if (!word) return;
  const titleEl = document.getElementById("sidePanelTitle");
  const bodyEl = document.getElementById("sidePanelBody");
  if (!titleEl || !bodyEl) return;

  titleEl.textContent = `📖 Chi tiết từ: ${word.hanzi}`;
  const currentSt = store.getVocabStatus(word.id);

  const renderExamples = (examples = []) =>
    examples.map((ex) => `
      <div class="example-box">
        <div class="zh" style="font-size:1rem;">${makeClickableHanzi(ex.chinese)}</div>
        <div class="pinyin" style="font-size:0.84rem;">${escapeHtml(ex.pinyin)}</div>
        <div class="muted-sm">${escapeHtml(ex.vietnamese)}</div>
        <button class="btn btn-sm btn-outline" style="margin-top:5px;" data-speak="${escapeHtml(ex.chinese)}">🔊 Nghe câu (TTS)</button>
      </div>
    `).join("");

  const singleExample = (!word.lesson_usage?.examples?.length && word.lesson_usage?.example?.chinese)
    ? [word.lesson_usage.example]
    : (word.lesson_usage?.examples || []);

  bodyEl.innerHTML = `
    ${isOnHomeRoute() ? `
      <div style="margin-bottom:8px;">
        <button type="button" class="btn btn-sm btn-outline" id="btnBackSideAssistantVocab">← Về Trợ lý học tập</button>
      </div>
    ` : ""}
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
      <div>
        <div class="vocab-hanzi">${makeClickableHanzi(word.hanzi)}</div>
        <div class="pinyin" style="font-size:1.05rem;">${escapeHtml(word.pinyin)}</div>
      </div>
      <button class="btn btn-sm btn-primary" data-speak="${escapeHtml(word.hanzi)}">🔊 Đọc (TTS)</button>
    </div>

    ${word.is_out_of_syllabus ? `
      <div style="margin:6px 0 8px;">
        <span class="badge badge-yellow">${word.bookId === "hsk30_l4" ? `📘 QUYỂN 4 · Bài ${word.lesson}` : "* Từ mở rộng"}</span>
      </div>
    ` : `<div style="height:8px;"></div>`}

    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
      <button class="btn-chip ${currentSt === "mastered" ? "active" : ""}" data-set-vocab-st="mastered">✓ Đã nhớ</button>
      <button class="btn-chip ${currentSt === "needs_review" ? "active" : ""}" data-set-vocab-st="needs_review">🔖 Cần ôn lại</button>
      <button class="btn-chip ${currentSt === "learning" ? "active" : ""}" data-set-vocab-st="learning">📘 Đang học</button>
    </div>

    <div class="usage-block-lesson">
      <div class="usage-tag usage-tag-lesson">A. Chức năng trong bài học 课文中的用法</div>
      <div><span class="badge badge-mint">${escapeHtml(word.lesson_usage?.part_of_speech || "")}</span> <strong>${escapeHtml(word.lesson_usage?.meaning || "")}</strong></div>
      ${word.lesson_usage?.structure ? `<div class="muted-sm" style="margin-top:4px;"><strong>Cấu trúc:</strong> ${escapeHtml(word.lesson_usage.structure)}</div>` : ""}
      ${word.lesson_usage?.explanation ? `<div style="margin-top:4px; font-size:0.9rem;">${escapeHtml(word.lesson_usage.explanation)}</div>` : ""}
      ${renderExamples(singleExample)}
    </div>

    ${word.chinese_explanation ? `
      <div style="margin-top:10px; font-size:0.88rem; background:var(--bg-soft); padding:9px 11px; border-radius:10px;">
        <strong>Giải thích tiếng Trung:</strong> <span class="zh">${escapeHtml(word.chinese_explanation)}</span>
      </div>
    ` : ""}

    ${(word.additional_usages && word.additional_usages.length) ? `
      <div class="usage-block-additional" style="margin-top:10px;">
        <div class="usage-tag usage-tag-extra">B. Chức năng bổ sung 其他用法 (${word.additional_usages.length})</div>
        ${word.additional_usages.map((u, idx) => `
          <div style="margin-top:${idx ? "10px" : "4px"}; padding-top:${idx ? "8px" : "0"}; border-top:${idx ? "1px dashed #e6c97a" : "none"};">
            <div><span class="badge badge-yellow">${escapeHtml(u.part_of_speech)}</span></div>
            <ol style="margin:5px 0 4px 18px; padding:0; font-size:0.9rem;">
              ${(u.meanings || []).map((m) => `<li>${escapeHtml(m)}</li>`).join("")}
            </ol>
            ${u.structure ? `<div class="muted-sm"><strong>Cấu trúc:</strong> ${escapeHtml(u.structure)}</div>` : ""}
            ${u.difference_note ? `<div class="muted-sm" style="color:#7c4a03; margin-top:3px;"><strong>Khác với bài:</strong> ${escapeHtml(u.difference_note)}</div>` : ""}
            ${renderExamples(u.examples || [])}
          </div>
        `).join("")}
      </div>
    ` : `<div class="muted-sm" style="margin-top:10px;">Chưa có chức năng từ loại bổ sung khác cho từ này.</div>`}

    ${word.collocations?.length ? `
      <div style="margin-top:10px;">
        <div style="font-weight:700; font-size:0.88rem; color:var(--green-700);">🔗 Cụm từ thường kết hợp</div>
        <div>${word.collocations.map((c) => `<span class="collocation-pill zh">${escapeHtml(c)}</span>`).join("")}</div>
      </div>
    ` : ""}

    ${word.usage_note ? `<div style="margin-top:10px; font-size:0.88rem;"><strong>📌 Ghi chú:</strong> ${escapeHtml(word.usage_note)}</div>` : ""}
    ${word.common_errors ? `<div style="margin-top:8px; font-size:0.88rem; color:var(--coral-700);"><strong>⚠ Lỗi dễ gặp / dễ nhầm:</strong> ${escapeHtml(word.common_errors)}</div>` : ""}
  `;

  bodyEl.querySelector("#btnBackSideAssistantVocab")?.addEventListener("click", () => renderDefaultSidePanel());

  bodyEl.querySelectorAll("[data-speak]").forEach((btn) => {
    btn.addEventListener("click", () => audioManager.speak(btn.dataset.speak, { audioUrl: word.audio }));
  });

  bodyEl.querySelectorAll("[data-set-vocab-st]").forEach((btn) => {
    btn.addEventListener("click", () => {
      store.setVocabStatus(word.id, btn.dataset.setVocabSt);
      showToast(`Đã cập nhật trạng thái từ “${word.hanzi}”`);
      showVocabDetailPanel(word);
      window.dispatchEvent(new CustomEvent("vocab-status-changed", { detail: { id: word.id } }));
    });
  });

  openSidePanelIfNeeded();
}

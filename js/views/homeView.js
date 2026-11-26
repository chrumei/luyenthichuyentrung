// Trang chủ: Dashboard học tập tổng quan

import { store } from "../store.js";
import { escapeHtml, MASCOT_SVGS, LESSON_STATUS_LABELS } from "../mascots.js";

export function renderHomeView(container) {
  const stats = store.getStats();
  const loadedLessons = store.getAllLoadedLessons();
  const activeLesson =
    loadedLessons.find((l) => store.getLessonStatus(l.id) === "in_progress") ||
    loadedLessons[0];

  container.innerHTML = `
    <section class="hero-card">
      <div>
        <span class="badge badge-mint" style="margin-bottom:8px;">🌱 Lộ trình ôn thi Chuyên Trung – THPT Chuyên Lê Hồng Phong</span>
        <h1>Chào mừng đến với Mầm Xanh Hán Ngữ!</h1>
        <p class="muted" style="max-width:600px;">
          Học chắc 3 bộ giáo trình chuẩn <strong>HSK 4 上 · HSK 4 下 · HSK 5 上</strong> (38 bài), kết hợp song song <strong>7 Trạm Kiến thức Nâng cao</strong>, <strong>Kiểm tra từ vựng QUYỂN 4 (50 bài)</strong> và <strong>Speed Test</strong>.
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
          ${activeLesson ? `<a href="#lesson/${activeLesson.id}" class="btn btn-primary">📖 Học tiếp: ${escapeHtml(activeLesson.textbook)} – Bài ${activeLesson.lesson_number}</a>` : ""}
          <a href="#speedtest" class="btn btn-yellow">⏱ Speed Test 3 giáo trình</a>
          <a href="#quyen4" class="btn btn-outline">🎯 Kiểm tra từ QUYỂN 4 (50 bài)</a>
          <a href="#review" class="btn btn-outline">🔁 Ôn tập cá nhân</a>
        </div>
      </div>
      <div class="hero-mascots">${MASCOT_SVGS.bunny}</div>
    </section>

    <div class="grid-4" style="margin-bottom:16px;">
      <div class="stat-card">
        <span class="stat-value">${stats.completedLessons}/${stats.totalLessons}</span>
        <span class="stat-label">Bài giáo trình hoàn thành</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.masteredVocab}/${stats.totalVocabLoaded}</span>
        <span class="stat-label">Từ vựng đã nhớ (trong kho đã nạp)</span>
      </div>
      <div class="stat-card">
        <span class="stat-value" style="color:var(--coral-700);">${stats.reviewVocab}</span>
        <span class="stat-label">Từ đang cần ôn lại</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.mistakesCount}</span>
        <span class="stat-label">Câu trong Sổ lỗi sai</span>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="section-header">
          <div>
            <h3>📚 Tiến độ 3 bộ giáo trình</h3>
            <p class="muted-sm">Kiến thức căn bản 基础知识 (38 bài chính thức)</p>
          </div>
          <a href="#basics" class="btn btn-sm btn-outline">Xem tất cả →</a>
        </div>
        ${stats.bookProgress.map((bp) => `
          <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:4px;">
              <strong>${escapeHtml(bp.name)}</strong>
              <span class="muted-sm">${bp.done}/${bp.total} bài (${bp.pct}%)</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${bp.pct}%"></div></div>
          </div>
        `).join("")}

        <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-weight:700; font-size:0.88rem; color:var(--green-700);">✨ Truy cập nhanh bài học</div>
            <a href="#basics" class="muted-sm" style="color:var(--green-600); font-weight:600;">Xem đủ ${loadedLessons.length} bài →</a>
          </div>
          ${(() => {
            const activeIdx = Math.max(0, loadedLessons.findIndex((x) => x.id === activeLesson?.id));
            const previewList = loadedLessons.slice(activeIdx, activeIdx + 6);
            return previewList.map((l) => {
              const st = store.getLessonStatus(l.id);
              return `
                <a href="#lesson/${l.id}" class="lesson-list-item" style="margin-bottom:8px; padding:10px 12px;">
                  <div>
                    <span class="badge badge-mint">${escapeHtml(l.textbook)} · Bài ${l.lesson_number}</span>
                    <strong class="zh" style="margin-left:6px;">${escapeHtml(l.title_zh)}</strong>
                    <div class="muted-sm">${escapeHtml(l.title_vi)} · ${(l.vocabulary || []).length} từ mới</div>
                  </div>
                  <span class="badge status-${st}">${LESSON_STATUS_LABELS[st]}</span>
                </a>
              `;
            }).join("");
          })()}
        </div>
      </div>

      <div class="card">
        <div class="section-header">
          <div>
            <h3>🚀 7 Trạm Kiến thức Nâng cao</h3>
            <p class="muted-sm">Học song song với HSK 4–5, không cần chờ học xong giáo trình</p>
          </div>
          <a href="#advanced" class="btn btn-sm btn-outline">Mở 7 trạm →</a>
        </div>
        ${store.stations.map((st) => {
          const done = st.packages.filter((p) => store.getPackageStatus(p.id) === "completed").length;
          const pct = st.packages.length ? Math.round((done / st.packages.length) * 100) : 0;
          return `
            <a href="#station/${st.id}" style="display:block; padding:8px 10px; border-radius:12px; margin-bottom:6px; border:1px solid var(--border); background:var(--bg-soft);">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <strong style="font-size:0.9rem; color:var(--green-700);">${st.icon} ${escapeHtml(st.shortTitle)}</strong>
                <span class="badge badge-mint">${done}/${st.packages.length} gói</span>
              </div>
              <div class="progress-track" style="height:6px; margin-top:5px;"><div class="progress-fill" style="width:${pct}%"></div></div>
            </a>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

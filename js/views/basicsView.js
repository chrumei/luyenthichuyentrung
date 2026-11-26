// Khu vực KIẾN THỨC CĂN BẢN 基础知识 + Luyện tập theo cụm 5 bài & 10 bài

import { store } from "../store.js";
import { renderExerciseSet } from "../exerciseEngine.js";
import { escapeHtml, LESSON_STATUS_LABELS, showToast } from "../mascots.js";

let selectedBookId = "hsk4shang";
let activeClusterId = null;

export function renderBasicsView(container) {
  const books = store.textbooks?.books || [];
  if (!books.find((b) => b.id === selectedBookId) && books[0]) {
    selectedBookId = books[0].id;
  }
  const book = store.getBookById(selectedBookId);

  container.innerHTML = `
    <div class="card card-mint">
      <div class="section-header" style="margin-bottom:8px;">
        <div>
          <h2>📚 KIẾN THỨC CĂN BẢN <span class="zh">基础知识</span></h2>
          <p class="muted-sm">Trọn bộ 3 giáo trình chính thức: <strong>HSK 4 上 (10 bài)</strong> · <strong>HSK 4 下 (10 bài)</strong> · <strong>HSK 5 上 (18 bài)</strong>.</p>
        </div>
      </div>

      <div class="tabs-bar" style="border-bottom:none; padding-bottom:0; margin-bottom:0;">
        ${books.map((b) => {
          const done = b.lessons.filter((l) => store.getLessonStatus(l.id) === "completed").length;
          return `
            <button type="button" class="tab-btn ${b.id === selectedBookId ? "active" : ""}" data-select-book="${b.id}">
              ${escapeHtml(b.name)} <span style="opacity:0.85; font-size:0.82rem; pointer-events:none;">(${done}/${b.lessons.length})</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>

    ${book ? renderBookSection(book) : ""}
  `;

  container.querySelectorAll("[data-select-book]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedBookId = btn.dataset.selectBook;
      activeClusterId = null;
      renderBasicsView(container);
    });
  });

  container.querySelectorAll("[data-status-select]").forEach((sel) => {
    sel.addEventListener("click", (e) => e.stopPropagation());
    sel.addEventListener("change", (e) => {
      e.stopPropagation();
      store.setLessonStatus(sel.dataset.statusSelect, sel.value);
      showToast(`Đã cập nhật trạng thái: ${LESSON_STATUS_LABELS[sel.value]}`);
      renderBasicsView(container);
    });
  });

  container.querySelectorAll("[data-open-lesson]").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.dataset.openLesson;
      const hasData = row.dataset.hasData === "true";
      if (hasData) {
        location.hash = `#lesson/${id}`;
      } else {
        showToast("Bài này đã có đủ khung mục lục từ PDF gốc và sẵn sàng nạp chi tiết ở đợt số hóa tiếp theo (hoặc qua nút Gia sư).");
      }
    });
  });

  container.querySelectorAll("[data-open-cluster]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeClusterId = btn.dataset.openCluster;
      renderClusterRunner(container);
    });
  });

  if (activeClusterId) {
    renderClusterRunner(container);
  }
}

function renderBookSection(book) {
  const clusters5 = (book.clusters || []).filter((c) => c.group_type === "5_lessons");
  const clusters10 = (book.clusters || []).filter((c) => c.group_type === "10_lessons");

  return `
    <div class="card">
      <div class="section-header">
        <div>
          <h3>${escapeHtml(book.full_title)}</h3>
          <p class="muted-sm">${book.lessons.length} bài học chính thức · Đầy đủ từ vựng, ngữ pháp, bài khóa và luyện tập</p>
        </div>
      </div>

      <div>
        ${book.lessons.map((l) => {
          const st = store.getLessonStatus(l.id);
          const hasData = Boolean(l.dataFile || store.state.customLessons[l.id]);
          return `
            <div class="lesson-list-item" data-open-lesson="${l.id}" data-has-data="${hasData}">
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="badge badge-mint">Bài ${l.number}</span>
                  <strong class="zh" style="font-size:1.08rem; color:var(--green-700);">${escapeHtml(l.title_zh)}</strong>
                  <span class="muted-sm">— ${escapeHtml(l.title_vi)}</span>
                </div>
                ${l.grammar_preview?.length ? `
                  <div class="muted-sm" style="margin-top:4px;">
                    <strong>Ngữ pháp (注释):</strong> <span class="zh">${escapeHtml(l.grammar_preview.join(" · "))}</span>
                    ${l.compare_preview ? ` &nbsp;|&nbsp; <strong>So sánh:</strong> <span class="zh">${escapeHtml(l.compare_preview)}</span>` : ""}
                  </div>
                ` : ""}
              </div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <select class="select-input btn-sm status-${st}" data-status-select="${l.id}" aria-label="Trạng thái bài ${l.number}">
                  ${Object.entries(LESSON_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${st === k ? "selected" : ""}>${v}</option>`).join("")}
                </select>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <div class="card card-cream">
      <h3>📝 Luyện tập tổng hợp theo cụm bài – ${escapeHtml(book.name)}</h3>
      <p class="muted-sm" style="margin-bottom:12px;">Cụm bài được chia chính xác theo số bài thực tế của ${escapeHtml(book.name)} (${book.lessons.length} bài), kết hợp từ vựng, ngữ pháp, cận nghĩa, sắp xếp câu, sửa lỗi, đọc hiểu và dịch thuật.</p>

      <div class="grid-2">
        <div>
          <h4 style="font-size:0.95rem;">🔹 Cụm 5 bài</h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${clusters5.map((c) => {
              const hasTest = Boolean(store.clusterTests?.tests?.[c.id]);
              return `<button class="btn ${activeClusterId === c.id ? "btn-primary" : "btn-outline"} btn-sm" data-open-cluster="${c.id}">
                ${escapeHtml(c.label)} ${hasTest ? "✓" : "(mẫu khung)"}
              </button>`;
            }).join("")}
          </div>
        </div>
        <div>
          <h4 style="font-size:0.95rem;">🔸 Cụm 10 bài / Tổng hợp nửa quyển</h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${clusters10.map((c) => {
              const hasTest = Boolean(store.clusterTests?.tests?.[c.id]);
              return `<button class="btn ${activeClusterId === c.id ? "btn-primary" : "btn-outline"} btn-sm" data-open-cluster="${c.id}">
                ${escapeHtml(c.label)} ${hasTest ? "✓" : "(mẫu khung)"}
              </button>`;
            }).join("")}
          </div>
        </div>
      </div>

      <div id="clusterTestContainer" style="margin-top:16px;"></div>
    </div>
  `;
}

function renderClusterRunner(container) {
  const box = container.querySelector("#clusterTestContainer");
  if (!box || !activeClusterId) return;
  const test = store.clusterTests?.tests?.[activeClusterId];
  if (!test) {
    box.innerHTML = `
      <div class="card card-yellow" style="margin-bottom:0;">
        <h4>📋 Cụm kiểm tra này sẽ mở khóa đầy đủ khi các bài học trong cụm được nạp chi tiết từ PDF gốc</h4>
        <p class="muted-sm">Hiện tại bạn có thể làm ngay các đề kiểm tra cụm mẫu đã sẵn sàng: <strong>HSK 4 上 (Bài 1–5 & Bài 1–10)</strong>, <strong>HSK 4 下 (Bài 11–15)</strong> và <strong>HSK 5 上 (Bài 1–5)</strong>!</p>
      </div>
    `;
    return;
  }

  renderExerciseSet(box, test.questions, {
    title: test.title,
    category: "Kiểm tra cụm bài",
    sourceRef: test.title,
    testType: "cluster_test"
  });
}

// Bộ máy luyện tập đa dạng (12 dạng bài) + chấm điểm + giải thích + tự động lưu Sổ lỗi sai

import { store } from "./store.js";
import { escapeHtml, makeClickableHanzi, showToast } from "./mascots.js";

const LEVEL_BADGE = {
  "Nhận biết": "badge-mint",
  "Phân biệt": "badge-yellow",
  "Vận dụng": "badge-blue"
};

const TYPE_LABEL = {
  meaning_mc: "Chọn nghĩa đúng",
  fill_blank: "Điền từ vào chỗ trống",
  context_mc: "Chọn từ theo ngữ cảnh",
  synonym_mc: "Phân biệt từ gần nghĩa",
  grammar_mc: "Chọn cấu trúc ngữ pháp",
  complete_sentence: "Hoàn thành câu",
  reorder: "Sắp xếp từ thành câu",
  error_fix: "Tìm và sửa lỗi sai",
  reading_mc: "Đọc hiểu",
  translate_zh_vi: "Dịch Trung – Việt",
  translate_vi_zh: "Dịch Việt – Trung",
  make_sentence: "Đặt câu vận dụng"
};

/**
 * Hiển thị một bộ bài tập tương tác trong container
 * @param {HTMLElement} container
 * @param {Array} exercises
 * @param {{ title?: string, category?: string, sourceRef?: string, onFinish?: Function }} meta
 */
export function renderExerciseSet(container, exercises = [], meta = {}) {
  if (!container) return;
  if (!exercises.length) {
    container.innerHTML = `<div class="card muted">Chưa có bài tập cho mục này.</div>`;
    return;
  }

  const userAnswers = {};
  const reorderState = {}; // { [exId]: { picked: [], bank: [] } }
  let submitted = false;

  exercises.forEach((ex) => {
    if (ex.type === "reorder") {
      reorderState[ex.id] = { picked: [], bank: [...(ex.tokens || [])] };
    }
  });

  function render() {
    container.innerHTML = `
      <div class="section-header">
        <div>
          <h3>${escapeHtml(meta.title || "Hệ thống bài tập luyện tập")}</h3>
          <p class="muted-sm">Tổng cộng ${exercises.length} câu · Đủ 3 mức: Nhận biết – Phân biệt – Vận dụng. Câu sai sẽ tự động lưu vào Sổ lỗi sai.</p>
        </div>
        ${submitted ? `<button class="btn btn-outline btn-sm" id="btnRetryEx">↻ Làm lại</button>` : ""}
      </div>

      <div id="exResultSummary"></div>

      ${exercises.map((ex, idx) => renderOneExercise(ex, idx)).join("")}

      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:16px;">
        ${!submitted
          ? `<button class="btn btn-primary" id="btnSubmitEx">✓ Nộp bài & Xem giải thích chi tiết</button>`
          : `<button class="btn btn-outline" id="btnRetryExBottom">↻ Luyện lại bộ câu hỏi này</button>`
        }
      </div>
    `;

    bindEvents();
    if (submitted) renderSummary();
  }

  function renderOneExercise(ex, idx) {
    const levelCls = LEVEL_BADGE[ex.level] || "badge-gray";
    const typeText = TYPE_LABEL[ex.type] || ex.type;
    const isMC = Array.isArray(ex.options) && ex.options.length > 0;
    const isReorder = ex.type === "reorder";
    const isOpen = !isMC && !isReorder;
    const ans = userAnswers[ex.id];

    let inputHtml = "";
    if (isMC) {
      inputHtml = ex.options.map((opt, oIdx) => {
        let cls = "option-btn";
        if (ans === opt) cls += " selected";
        if (submitted) {
          if (opt === ex.answer) cls += " correct";
          else if (ans === opt && opt !== ex.answer) cls += " wrong";
        }
        return `<button type="button" class="${cls}" data-ex-mc="${ex.id}" data-opt="${escapeHtml(opt)}" ${submitted ? "disabled" : ""}>
          <strong>${String.fromCharCode(65 + oIdx)}.</strong> <span class="zh">${escapeHtml(opt)}</span>
        </button>`;
      }).join("");
    } else if (isReorder) {
      const st = reorderState[ex.id];
      inputHtml = `
        <div class="muted-sm">Nhấp vào từng từ bên dưới theo đúng thứ tự câu:</div>
        <div class="token-answer" data-reorder-ans="${ex.id}">
          ${st.picked.length
            ? st.picked.map((t, i) => `<button type="button" class="token-chip zh" data-unpick="${ex.id}" data-idx="${i}" ${submitted ? "disabled" : ""}>${escapeHtml(t)}</button>`).join("")
            : `<span class="muted-sm">Câu bạn sắp xếp sẽ hiện ở đây...</span>`
          }
        </div>
        <div class="token-bank">
          ${st.bank.map((t, i) => `<button type="button" class="token-chip zh" data-pick="${ex.id}" data-idx="${i}" ${submitted ? "disabled" : ""}>${escapeHtml(t)}</button>`).join("")}
        </div>
      `;
    } else if (isOpen) {
      inputHtml = `
        <textarea class="text-input" rows="2" style="width:100%; margin-top:8px;" placeholder="Nhập câu trả lời của bạn..." data-ex-text="${ex.id}" ${submitted ? "disabled" : ""}>${escapeHtml(ans || "")}</textarea>
        ${ex.hint ? `<div class="muted-sm" style="margin-top:4px;">💡 Gợi ý: ${escapeHtml(ex.hint)}</div>` : ""}
      `;
    }

    let feedbackHtml = "";
    if (submitted) {
      const evalRes = evaluateOne(ex);
      feedbackHtml = `
        <div class="feedback-box ${evalRes.ok ? "feedback-ok" : "feedback-err"}">
          <div style="font-weight:700; margin-bottom:4px;">
            ${evalRes.ok ? "✓ Chính xác!" : (evalRes.selfCheck ? "📝 Đã đối chiếu đáp án mẫu (tự kiểm tra)" : "✗ Chưa chính xác")}
          </div>
          <div><strong>Đáp án chuẩn:</strong> <span class="zh">${escapeHtml(ex.answer)}</span></div>
          ${ex.explanation ? `<div style="margin-top:4px;"><strong>Giải thích:</strong> ${escapeHtml(ex.explanation)}</div>` : ""}
          ${ex.review_tip && !evalRes.ok ? `<div style="margin-top:4px;"><strong>📌 Cần ôn lại:</strong> ${escapeHtml(ex.review_tip)}</div>` : ""}
        </div>
      `;
    }

    return `
      <div class="exercise-card">
        <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <span class="badge badge-gray">Câu ${idx + 1}</span>
            <span class="badge ${levelCls}">${escapeHtml(ex.level || "Nhận biết")}</span>
            <span class="badge badge-mint">${escapeHtml(typeText)}</span>
            ${ex.origin_tag ? `<span class="badge badge-gray">${escapeHtml(ex.origin_tag)}</span>` : ""}
          </div>
        </div>
        ${ex.passage ? `<div class="card card-mint" style="padding:12px; margin:6px 0 10px; font-size:0.95rem;"><div class="zh">${makeClickableHanzi(ex.passage)}</div></div>` : ""}
        <div style="font-weight:600; font-size:0.98rem;" class="zh">${makeClickableHanzi(ex.prompt)}</div>
        ${inputHtml}
        ${feedbackHtml}
      </div>
    `;
  }

  function normalizeText(s = "") {
    return String(s).trim().replace(/[。！？，、.,!?\s]/g, "").toLowerCase();
  }

  function evaluateOne(ex) {
    if (Array.isArray(ex.options) && ex.options.length) {
      const ua = userAnswers[ex.id] || "(Chưa chọn)";
      return { ok: ua === ex.answer, userAnswer: ua, selfCheck: false };
    }
    if (ex.type === "reorder") {
      const ua = (reorderState[ex.id]?.picked || []).join("");
      const ok = normalizeText(ua) === normalizeText(ex.answer);
      return { ok, userAnswer: ua || "(Chưa sắp xếp)", selfCheck: false };
    }
    const ua = (userAnswers[ex.id] || "").trim();
    if (ex.acceptable_answers && ex.acceptable_answers.length) {
      const ok = ex.acceptable_answers.some((a) => normalizeText(ua) === normalizeText(a));
      return { ok, userAnswer: ua || "(Bỏ trống)", selfCheck: false };
    }
    if (ex.keywords && ex.keywords.length) {
      const ok = ua.length > 0 && ex.keywords.every((kw) => ua.includes(kw));
      return { ok, userAnswer: ua || "(Bỏ trống)", selfCheck: true };
    }
    const ok = normalizeText(ua) === normalizeText(ex.answer);
    return { ok, userAnswer: ua || "(Bỏ trống)", selfCheck: ex.type === "make_sentence" || ex.type.startsWith("translate") };
  }

  function renderSummary() {
    const box = container.querySelector("#exResultSummary");
    if (!box) return;
    let correctCount = 0;
    const wrongTips = [];
    exercises.forEach((ex) => {
      const r = evaluateOne(ex);
      if (r.ok) correctCount += 1;
      else if (ex.review_tip) wrongTips.push(ex.review_tip);
    });
    const pct = Math.round((correctCount / exercises.length) * 100);
    const uniqueTips = [...new Set(wrongTips)];

    box.innerHTML = `
      <div class="card ${pct >= 80 ? "card-mint" : "card-yellow"}" style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="margin-bottom:4px;">🎯 Kết quả: ${correctCount}/${exercises.length} câu đạt (${pct}%)</h4>
            <p class="muted-sm">${pct >= 80 ? "Rất tốt! Bạn nắm kiến thức chắc lắm rồi đó!" : "Cố lên nhé! Xem kỹ giải thích từng câu sai bên dưới — hệ thống đã tự lưu vào Sổ lỗi sai."}</p>
          </div>
          <div style="font-size:1.7rem; font-weight:700; color:var(--green-700);">${pct} điểm</div>
        </div>
        ${uniqueTips.length ? `
          <div style="margin-top:10px; padding-top:8px; border-top:1px solid var(--border); font-size:0.88rem;">
            <strong>📌 Gợi ý nội dung cần ôn lại:</strong>
            <ul style="margin:4px 0 0 18px;">${uniqueTips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
          </div>
        ` : ""}
      </div>
    `;
  }

  function bindEvents() {
    container.querySelectorAll("[data-ex-mc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (submitted) return;
        userAnswers[btn.dataset.exMc] = btn.dataset.opt;
        render();
      });
    });

    container.querySelectorAll("[data-ex-text]").forEach((ta) => {
      ta.addEventListener("input", () => {
        userAnswers[ta.dataset.exText] = ta.value;
      });
    });

    container.querySelectorAll("[data-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (submitted) return;
        const st = reorderState[btn.dataset.pick];
        const i = Number(btn.dataset.idx);
        const [item] = st.bank.splice(i, 1);
        st.picked.push(item);
        render();
      });
    });

    container.querySelectorAll("[data-unpick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (submitted) return;
        const st = reorderState[btn.dataset.unpick];
        const i = Number(btn.dataset.idx);
        const [item] = st.picked.splice(i, 1);
        st.bank.push(item);
        render();
      });
    });

    const submitBtn = container.querySelector("#btnSubmitEx");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        submitted = true;
        let correct = 0;
        let mistakeCount = 0;
        exercises.forEach((ex) => {
          const res = evaluateOne(ex);
          if (res.ok) {
            correct += 1;
          } else {
            mistakeCount += 1;
            store.recordMistake({
              question: ex.prompt,
              userAnswer: res.userAnswer,
              correctAnswer: ex.answer,
              explanation: ex.explanation || "",
              category: ex.mistake_category || meta.category || "Từ vựng",
              sourceRef: meta.sourceRef || meta.title || ""
            });
          }
        });

        store.recordTestResult({
          type: meta.testType || "exercise",
          title: meta.title || "Luyện tập",
          score: correct,
          total: exercises.length
        });

        if (mistakeCount > 0) {
          showToast(`Đã chấm bài! ${mistakeCount} câu sai đã tự lưu vào Sổ lỗi sai.`);
        } else {
          showToast("Tuyệt vời! Bạn trả lời chính xác 100%!");
        }
        render();
        if (meta.onFinish) meta.onFinish({ correct, total: exercises.length });
      });
    }

    const retry = () => {
      submitted = false;
      Object.keys(userAnswers).forEach((k) => delete userAnswers[k]);
      exercises.forEach((ex) => {
        if (ex.type === "reorder") {
          reorderState[ex.id] = { picked: [], bank: [...(ex.tokens || [])] };
        }
      });
      render();
    };
    container.querySelector("#btnRetryEx")?.addEventListener("click", retry);
    container.querySelector("#btnRetryExBottom")?.addEventListener("click", retry);
  }

  render();
}

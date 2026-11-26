// Trợ lý hỏi bài nhanh đa dạng (Từ vựng · Ngữ pháp · Cận nghĩa · Thành ngữ · Chữ đa âm/Dễ nhầm · Sửa lỗi sai)
// Ưu tiên rút câu hỏi từ các bài/gói học sinh đã học hoặc đang học, luôn có dự phòng thông minh.

import { store } from "./store.js";
import { audioManager } from "./audio.js";
import { escapeHtml } from "./mascots.js";

export const QUICK_QUIZ_CATEGORIES = [
  { id: "all", label: "🎲 Ngẫu nhiên" },
  { id: "vocab", label: "🔤 Từ vựng" },
  { id: "grammar", label: "🧩 Ngữ pháp" },
  { id: "synonym", label: "⚖️ Cận nghĩa" },
  { id: "hanzi_idiom", label: "🔊 Đa âm · Thành ngữ · Chữ" },
  { id: "error_fix", label: "🩺 Sửa lỗi" }
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getStudiedOrFallbackLessons() {
  const all = store.getAllLoadedLessons();
  const studiedIds = new Set(store.getStudiedLessonIds());
  const studied = all.filter((l) => studiedIds.has(l.id));
  return studied.length ? studied : all.slice(0, 6);
}

function getStudiedStationExercises(stationIds) {
  const preferred = [];
  const fallback = [];
  for (const st of store.stations || []) {
    if (!stationIds.includes(st.id)) continue;
    for (const pkg of st.packages || []) {
      const pSt = store.getPackageStatus(pkg.id);
      const isStudied = pSt === "completed" || pSt === "in_progress" || pSt === "needs_review";
      for (const ex of pkg.exercises || []) {
        if (!ex.options || !ex.options.length || !ex.answer) continue;
        const item = {
          badge: `${st.icon} ${st.shortTitle}`,
          sourceLabel: `${st.shortTitle} · ${pkg.title.split(":")[0]}`,
          prompt: ex.prompt,
          options: shuffle(ex.options),
          answer: ex.answer,
          explanation: ex.explanation || "",
          speakText: ""
        };
        if (isStudied) preferred.push(item);
        else fallback.push(item);
      }
    }
  }
  return preferred.length >= 3 ? preferred : [...preferred, ...fallback];
}

function buildVocabQuestion() {
  const lessons = getStudiedOrFallbackLessons();
  const pool = [];
  for (const l of lessons) {
    for (const w of l.vocabulary || []) {
      if (w.hanzi && w.lesson_usage?.meaning) {
        pool.push({
          ...w,
          _label: `${l.textbook} · Bài ${l.lesson_number}`
        });
      }
    }
  }
  // Bổ sung thêm các từ đã học/cần ôn từ QUYỂN 4 nếu có
  for (const w of store.getHsk30L4Vocab()) {
    const st = store.getVocabStatus(w.id);
    if (st === "needs_review" || st === "learning" || st === "mastered") {
      pool.push({ ...w, _label: `QUYỂN 4 · Bài ${w.lesson}` });
    }
  }
  if (pool.length < 4) return null;

  const target = pool[Math.floor(Math.random() * pool.length)];
  const others = shuffle(pool.filter((x) => x.hanzi !== target.hanzi && x.lesson_usage?.meaning !== target.lesson_usage?.meaning)).slice(0, 3);
  if (others.length < 3) return null;

  const askZhToVi = Math.random() < 0.55;
  if (askZhToVi) {
    const opts = shuffle([target, ...others]).map((x) => x.lesson_usage.meaning);
    return {
      category: "vocab",
      badge: "🔤 Hỏi nhanh Từ vựng",
      sourceLabel: target._label,
      prompt: `Từ “${target.hanzi}” (${target.pinyin}) có nghĩa là gì?`,
      options: opts,
      answer: target.lesson_usage.meaning,
      explanation: `${target.hanzi} (${target.pinyin}) [${target.lesson_usage.part_of_speech || ""}] = ${target.lesson_usage.meaning}.`,
      speakText: target.hanzi
    };
  }
  const opts = shuffle([target, ...others]).map((x) => `${x.hanzi} (${x.pinyin})`);
  const ans = `${target.hanzi} (${target.pinyin})`;
  return {
    category: "vocab",
    badge: "🔤 Hỏi nhanh Từ vựng",
    sourceLabel: target._label,
    prompt: `Nghĩa “${target.lesson_usage.meaning}” ứng với từ tiếng Trung nào?`,
    options: opts,
    answer: ans,
    explanation: `Đáp án đúng là ${target.hanzi} (${target.pinyin}).`,
    speakText: target.hanzi
  };
}

function buildGrammarQuestion() {
  const candidates = [];
  for (const l of getStudiedOrFallbackLessons()) {
    for (const ex of l.exercises || []) {
      if (!ex.options || !ex.options.length || !ex.answer) continue;
      candidates.push({
        category: "grammar",
        badge: "🧩 Hỏi nhanh Ngữ pháp",
        sourceLabel: `${l.textbook} · Bài ${l.lesson_number}`,
        prompt: ex.prompt,
        options: shuffle(ex.options),
        answer: ex.answer,
        explanation: ex.explanation || "",
        speakText: ""
      });
    }
  }
  const st2 = getStudiedStationExercises(["station2"]).map((x) => ({ ...x, category: "grammar" }));
  const all = [...candidates, ...st2];
  if (!all.length) return null;
  return all[Math.floor(Math.random() * all.length)];
}

export function generateQuickQuestion(category = "all") {
  const builders = {
    vocab: () => buildVocabQuestion(),
    grammar: () => buildGrammarQuestion(),
    synonym: () => {
      const list = getStudiedStationExercises(["station1"]);
      return list.length ? { ...list[Math.floor(Math.random() * list.length)], category: "synonym" } : null;
    },
    hanzi_idiom: () => {
      const list = getStudiedStationExercises(["station3", "station4", "station5"]);
      return list.length ? { ...list[Math.floor(Math.random() * list.length)], category: "hanzi_idiom" } : null;
    },
    error_fix: () => {
      const list = getStudiedStationExercises(["station6"]);
      return list.length ? { ...list[Math.floor(Math.random() * list.length)], category: "error_fix" } : null;
    }
  };

  if (category !== "all" && builders[category]) {
    return builders[category]() || buildVocabQuestion();
  }

  const order = shuffle(Object.keys(builders));
  for (const k of order) {
    const q = builders[k]();
    if (q) return q;
  }
  return null;
}

/**
 * Gắn hộp Trợ lý hỏi nhanh tương tác trực tiếp vào một phần tử DOM (dùng cho Bảng phụ & Thẻ nhắc nhanh)
 */
export function mountQuickQuizWidget(hostEl, { compact = false, initialCategory = "all", onClose = null } = {}) {
  if (!hostEl) return;
  let activeCat = initialCategory;
  let q = generateQuickQuestion(activeCat);
  let answered = false;
  let chosen = null;

  function handleClick(e) {
    const speakBtn = e.target.closest("[data-qq-speak]");
    if (speakBtn) {
      e.stopPropagation();
      audioManager.speak(speakBtn.dataset.qqSpeak);
      return;
    }
    const nextBtn = e.target.closest("[data-qq-next]");
    if (nextBtn) {
      e.stopPropagation();
      q = generateQuickQuestion(activeCat);
      answered = false;
      chosen = null;
      render();
      return;
    }
    const closeBtn = e.target.closest("[data-qq-close]");
    if (closeBtn) {
      e.stopPropagation();
      onClose?.();
      return;
    }
    const catBtn = e.target.closest("[data-qq-cat]");
    if (catBtn) {
      e.stopPropagation();
      activeCat = catBtn.dataset.qqCat;
      q = generateQuickQuestion(activeCat);
      answered = false;
      chosen = null;
      render();
      return;
    }
    const optBtn = e.target.closest("[data-qq-opt]");
    if (optBtn) {
      e.stopPropagation();
      if (answered) return;
      const optVal = q.options[Number(optBtn.dataset.qqOpt)];
      answered = true;
      chosen = optVal;
      if (optVal !== q.answer) {
        store.recordMistake({
          question: q.prompt,
          userAnswer: optVal,
          correctAnswer: q.answer,
          explanation: q.explanation || "",
          category: "Hỏi nhanh Trợ lý",
          sourceRef: q.sourceLabel
        });
      }
      render();
    }
  }

  hostEl.onclick = handleClick;

  function render() {
    if (!q) {
      hostEl.innerHTML = `<div class="muted-sm">Chưa có câu hỏi nhanh nào.</div>`;
      return;
    }
    const isCorrect = answered && chosen === q.answer;
    hostEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
        <span class="badge badge-mint" style="font-size:0.74rem;">${escapeHtml(q.badge)}</span>
        <div style="display:flex; gap:4px; align-items:center;">
          ${q.speakText ? `<button type="button" class="icon-btn" style="width:26px; height:26px; font-size:0.78rem;" data-qq-speak="${escapeHtml(q.speakText)}" title="Nghe phát âm">🔊</button>` : ""}
          <button type="button" class="btn-chip" style="padding:3px 9px; font-size:0.74rem;" data-qq-next>↻ Câu khác</button>
          ${onClose ? `<button type="button" class="icon-btn" style="width:24px; height:24px; font-size:0.75rem;" data-qq-close title="Đóng">✕</button>` : ""}
        </div>
      </div>

      ${!compact ? `
        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:8px;">
          ${QUICK_QUIZ_CATEGORIES.map((c) => `
            <button type="button" class="btn-chip ${activeCat === c.id ? "active" : ""}" data-qq-cat="${c.id}" style="padding:2px 8px; font-size:0.72rem;">${c.label}</button>
          `).join("")}
        </div>
      ` : ""}

      <div class="muted-sm" style="font-size:0.76rem; margin-bottom:4px;">${escapeHtml(q.sourceLabel)}</div>
      <div class="zh" style="font-weight:600; font-size:${compact ? "0.9rem" : "0.93rem"}; color:var(--ink-primary); margin-bottom:8px; line-height:1.45;">
        ${escapeHtml(q.prompt)}
      </div>

      <div style="display:flex; flex-direction:column; gap:6px;">
        ${q.options.map((opt, idx) => {
          let cls = "option-btn";
          if (answered) {
            if (opt === q.answer) cls += " correct";
            else if (opt === chosen) cls += " wrong";
          }
          return `
            <button type="button" class="${cls}" data-qq-opt="${idx}" ${answered ? "disabled" : ""} style="padding:7px 10px; font-size:0.84rem; text-align:left; line-height:1.35;">
              <strong style="pointer-events:none;">${String.fromCharCode(65 + idx)}.</strong> <span class="zh" style="pointer-events:none;">${escapeHtml(opt)}</span>
            </button>
          `;
        }).join("")}
      </div>

      ${answered ? `
        <div class="feedback-box ${isCorrect ? "feedback-ok" : "feedback-err"}" style="margin-top:8px; padding:8px 10px; font-size:0.82rem;">
          <strong>${isCorrect ? "✅ Chính xác!" : "❌ Chưa đúng!"}</strong>
          ${q.explanation ? `<div style="margin-top:3px;">${escapeHtml(q.explanation)}</div>` : ""}
        </div>
      ` : ""}
    `;
  }

  render();
}

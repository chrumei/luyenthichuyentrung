// Thuật toán tính thời gian linh hoạt theo độ khó cho từng câu hỏi Speed Test
// Không dùng một mốc thời gian cố định; không chỉ dựa vào số nét chữ Hán.

import { store } from "./store.js";
import { isChineseChar } from "./mascots.js";

/**
 * Ước lượng số nét của một từ từ hanzi_db (hoặc giá trị trung bình hợp lý nếu chữ chưa có trong kho)
 */
function estimateStrokeStats(hanzi = "") {
  const chars = Array.from(hanzi).filter(isChineseChar);
  let totalStrokes = 0;
  let maxCharStrokes = 0;
  for (const ch of chars) {
    const info = store.hanziDb?.[ch];
    const s = info?.strokes || 9; // trung bình 9 nét nếu chưa có dữ liệu chính xác
    totalStrokes += s;
    if (s > maxCharStrokes) maxCharStrokes = s;
  }
  return {
    charCount: Math.max(1, chars.length),
    totalStrokes,
    maxCharStrokes
  };
}

/**
 * Tính thời gian trả lời riêng cho từng từ & dạng kiểm tra
 * @param {object} word - Đối tượng từ vựng
 * @param {'vi_to_zh'|'py_to_zh'|'zh_to_py_vi'} mode - Hình thức kiểm tra
 * @param {{ paceMultiplier?: number, manualOffset?: number }} tutorConfig
 * @returns {{ seconds: number, breakdown: Array<{label: string, delta: string}> }}
 */
export function calculateWordTime(word, mode, tutorConfig = {}) {
  const pace = Number(tutorConfig.paceMultiplier ?? 1.0);
  const manualOffset = Number(tutorConfig.manualOffset ?? 0);
  const { charCount, totalStrokes, maxCharStrokes } = estimateStrokeStats(word.hanzi);

  const breakdown = [];

  // 1. Thời gian nền theo hình thức kiểm tra (yêu cầu thao tác viết khác nhau)
  let base = 6.0;
  if (mode === "vi_to_zh") {
    base = 6.5;
    breakdown.push({ label: "Dạng Nghĩa Việt → Viết Hán", delta: "+6.5s" });
  } else if (mode === "py_to_zh") {
    base = 5.5;
    breakdown.push({ label: "Dạng Pinyin/Audio → Viết Hán", delta: "+5.5s" });
  } else {
    // Dạng 3 đòi hỏi nhớ mặt chữ VÀ viết cả Pinyin có dấu + Nghĩa tiếng Việt
    base = 7.5;
    breakdown.push({ label: "Dạng Chữ Hán → Viết Pinyin & Nghĩa", delta: "+7.5s" });
  }

  // 2. Số lượng chữ Hán trong từ
  let charBonus = 0;
  if (charCount === 2) charBonus = 2.4;
  else if (charCount === 3) charBonus = 4.6;
  else if (charCount >= 4) charBonus = 6.8;
  if (charBonus > 0) {
    breakdown.push({ label: `Độ dài từ (${charCount} chữ)`, delta: `+${charBonus.toFixed(1)}s` });
  }

  // 3. Độ phức tạp nét viết (trọng số cao hơn khi phải viết chữ Hán, giảm ở dạng 3)
  let strokeBonus = 0;
  if (mode === "zh_to_py_vi") {
    strokeBonus = totalStrokes >= 24 ? 1.5 : totalStrokes >= 16 ? 0.8 : 0;
  } else {
    strokeBonus = Math.min(5.5, (totalStrokes / 10) * 1.4 + (maxCharStrokes >= 13 ? 1.2 : 0));
  }
  if (strokeBonus > 0.2) {
    breakdown.push({ label: `Độ phức tạp chữ (~${totalStrokes} nét)`, delta: `+${strokeBonus.toFixed(1)}s` });
  }

  // 4. Độ khó ghi nhớ (đa nghĩa / nhiều chức năng / có lỗi dễ nhầm / cấp HSK 5)
  let memBonus = 0;
  const extraUsagesCount = (word.additional_usages || []).length;
  if (extraUsagesCount >= 1) memBonus += 1.0;
  if (word.common_errors) memBonus += 0.9;
  if (word.bookId === "hsk5shang" || word.textbook === "HSK5上") memBonus += 1.1;
  if (word.is_out_of_syllabus) memBonus += 1.0;
  if (memBonus > 0) {
    breakdown.push({ label: "Độ khó ghi nhớ & ngữ nghĩa", delta: `+${memBonus.toFixed(1)}s` });
  }

  // 5. Mức độ quen thuộc dựa trên lịch sử học tập thực tế của học sinh
  const status = store.getVocabStatus(word.id);
  let famDelta = 0;
  if (status === "needs_review") {
    famDelta = 2.5;
    breakdown.push({ label: "Từ đang cần ôn lại", delta: "+2.5s" });
  } else if (status === "mastered") {
    famDelta = -1.5;
    breakdown.push({ label: "Từ đã nhớ vững", delta: "-1.5s" });
  } else if (status === "learning") {
    famDelta = 0.8;
    breakdown.push({ label: "Từ đang học", delta: "+0.8s" });
  }

  let raw = (base + charBonus + strokeBonus + memBonus + famDelta) * pace + manualOffset;

  if (pace !== 1.0) {
    breakdown.push({ label: `Tốc độ gia sư (×${pace})`, delta: `×${pace}` });
  }
  if (manualOffset !== 0) {
    breakdown.push({ label: "Gia sư cộng/trừ thủ công", delta: `${manualOffset > 0 ? "+" : ""}${manualOffset}s` });
  }

  // Trần tối thiểu & tối đa hợp lý
  const minBound = 6;
  const maxBound = 32;
  const seconds = Math.round(Math.max(minBound, Math.min(maxBound, raw)));

  return { seconds, breakdown };
}

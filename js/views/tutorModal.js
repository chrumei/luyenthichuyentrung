// Cửa sổ Góc quản lý nội dung dành cho Gia sư (Thêm từ bổ sung, Nhập/Xuất JSON & CSV tương thích Google Sheets)

import { store } from "../store.js";
import { escapeHtml, showToast } from "../mascots.js";

export function openTutorModal(onDataChanged) {
  const modal = document.getElementById("tutorModal");
  const body = document.getElementById("tutorModalBody");
  if (!modal || !body) return;

  const loadedLessons = store.getAllLoadedLessons();
  modal.hidden = false;

  body.innerHTML = `
    <div class="card card-mint" style="margin-bottom:14px;">
      <h4 style="margin-bottom:4px;">📤 Xuất dữ liệu tương thích Google Sheets / Excel</h4>
      <p class="muted-sm" style="margin-bottom:10px;">Lưu ý: Website hiện dùng hệ thống tệp JSON cục bộ (chưa kết nối API Google Sheets trực tiếp). Bạn có thể xuất CSV dưới đây để mở ngay trong Google Sheets hoặc Excel.</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" id="btnExportVocabCsv">⬇ Xuất toàn bộ từ vựng (.CSV)</button>
        <button class="btn btn-outline btn-sm" id="btnExportProgressTutor">⬇ Xuất tiến độ học (.JSON)</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h4>➕ Thêm Từ bổ sung vào một bài học (tách riêng khỏi từ mới chính thức)</h4>
      <form id="tutorAddWordForm" style="display:grid; gap:10px; margin-top:8px;">
        <div class="grid-2">
          <div>
            <label class="muted-sm">Chọn bài học</label>
            <select class="select-input" name="lessonId" style="width:100%;">
              ${loadedLessons.map((l) => `<option value="${l.id}">${escapeHtml(l.textbook)} – Bài ${l.lesson_number}: ${escapeHtml(l.title_zh)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="muted-sm">Chữ Hán *</label>
            <input class="text-input" name="hanzi" required placeholder="VD: 坚持" style="width:100%;" />
          </div>
        </div>
        <div class="grid-2">
          <div>
            <label class="muted-sm">Pinyin có dấu thanh *</label>
            <input class="text-input" name="pinyin" required placeholder="VD: jiānchí" style="width:100%;" />
          </div>
          <div>
            <label class="muted-sm">A. Từ loại trong bài *</label>
            <input class="text-input" name="lessonPos" required placeholder="VD: 动词 (Động từ)" style="width:100%;" />
          </div>
        </div>
        <div>
          <label class="muted-sm">A. Nghĩa tiếng Việt trong bài *</label>
          <input class="text-input" name="lessonMeaning" required placeholder="VD: kiên trì, bền bỉ" style="width:100%;" />
        </div>
        <div class="grid-2">
          <div>
            <label class="muted-sm">Ví dụ tiếng Trung (trong bài)</label>
            <input class="text-input" name="exZh" placeholder="VD: 他每天坚持学习汉语。" style="width:100%;" />
          </div>
          <div>
            <label class="muted-sm">Dịch ví dụ tiếng Việt</label>
            <input class="text-input" name="exVi" placeholder="VD: Cậu ấy mỗi ngày đều kiên trì học tiếng Trung." style="width:100%;" />
          </div>
        </div>
        <div class="grid-2">
          <div>
            <label class="muted-sm">B. Chức năng bổ sung (Từ loại khác – nếu có)</label>
            <input class="text-input" name="extraPos" placeholder="VD: 形容词 / 名词..." style="width:100%;" />
          </div>
          <div>
            <label class="muted-sm">B. Nghĩa của chức năng bổ sung</label>
            <input class="text-input" name="extraMeaning" placeholder="Để trống nếu không có" style="width:100%;" />
          </div>
        </div>
        <div>
          <button type="submit" class="btn btn-primary btn-sm">✓ Lưu từ bổ sung vào bài</button>
        </div>
      </form>
    </div>

    <div class="card card-cream" style="margin-bottom:0;">
      <h4>📥 Nhập nhanh một bài học mới (tệp JSON chuẩn)</h4>
      <p class="muted-sm" style="margin-bottom:8px;">Bạn có thể tải tệp JSON theo cấu trúc trong <code>data/lessons/</code> để nạp trực tiếp lên trình duyệt mà không cần chỉnh sửa mã nguồn.</p>
      <label class="btn btn-outline btn-sm" style="cursor:pointer;">
        📂 Chọn tệp bài học (.json)
        <input type="file" id="inpImportLessonJson" accept=".json" hidden />
      </label>
    </div>
  `;

  body.querySelector("#btnExportVocabCsv")?.addEventListener("click", () => {
    const csv = store.exportVocabCsv(store.getAllVocab());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tu-vung-hsk4-5-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast("Đã xuất tệp CSV từ vựng (tương thích Google Sheets)!");
  });

  body.querySelector("#btnExportProgressTutor")?.addEventListener("click", () => {
    const blob = new Blob([store.exportProgressJson()], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tien-do-gia-han-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast("Đã xuất tệp JSON tiến độ!");
  });

  body.querySelector("#tutorAddWordForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const lessonId = fd.get("lessonId");
    const meta = store.getLessonMeta(lessonId);
    const extraPos = String(fd.get("extraPos") || "").trim();
    const extraMeaning = String(fd.get("extraMeaning") || "").trim();

    const newWord = {
      id: `tutor_${lessonId}_${Date.now()}`,
      lessonId,
      textbook: meta?.book?.name || "",
      lesson: meta?.lesson?.number || "",
      hanzi: String(fd.get("hanzi")).trim(),
      pinyin: String(fd.get("pinyin")).trim(),
      lesson_usage: {
        part_of_speech: String(fd.get("lessonPos")).trim(),
        meaning: String(fd.get("lessonMeaning")).trim(),
        examples: fd.get("exZh") ? [{
          chinese: String(fd.get("exZh")).trim(),
          pinyin: "",
          vietnamese: String(fd.get("exVi") || "").trim()
        }] : []
      },
      additional_usages: extraPos && extraMeaning ? [{
        part_of_speech: extraPos,
        meanings: [extraMeaning],
        examples: []
      }] : [],
      chinese_explanation: "",
      collocations: [],
      audio: null,
      source_status: "authored_linguistics",
      source_ids: ["tutor_custom"]
    };

    store.addTutorWord(newWord);
    showToast(`Đã thêm từ bổ sung “${newWord.hanzi}” thành công!`);
    e.target.reset();
    if (onDataChanged) onDataChanged();
  });

  body.querySelector("#inpImportLessonJson")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      store.importCustomLesson(parsed);
      showToast(`Đã nhập bài học “${parsed.title_zh || parsed.id}” thành công!`);
      modal.hidden = true;
      if (onDataChanged) onDataChanged();
    } catch (err) {
      showToast(`Lỗi đọc JSON: ${err.message}`);
    }
  });
}

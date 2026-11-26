// Quản lý phát âm tiếng Trung phổ thông (Web Speech API - TTS & audio gốc nếu có)

class AudioManager {
  constructor() {
    this.rate = 0.9;
    this.currentAudio = null;
    this.isSpeaking = false;
    this.zhVoice = null;
    this.initVoices();
  }

  initVoices() {
    if (!("speechSynthesis" in window)) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      this.zhVoice =
        voices.find((v) => v.lang === "zh-CN" && /Xiaoxiao|Yunxi|Google|Microsoft/i.test(v.name)) ||
        voices.find((v) => v.lang === "zh-CN") ||
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("zh")) ||
        null;
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  setRate(rate) {
    this.rate = Number(rate) || 0.9;
  }

  stop() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isSpeaking = false;
  }

  /**
   * Phát âm thanh: ưu tiên audio file gốc nếu có đường dẫn, nếu không dùng TTS tiếng Phổ thông
   * Trả về { mode: 'official' | 'tts' | 'unsupported' }
   */
  speak(text, { audioUrl = null, rate = this.rate, onEnd = null } = {}) {
    this.stop();

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;
      this.currentAudio = audio;
      this.isSpeaking = true;
      audio.onended = () => {
        this.isSpeaking = false;
        if (onEnd) onEnd();
      };
      audio.play().catch(() => {
        // fallback sang TTS nếu file âm thanh chưa tồn tại
        this._speakTTS(text, rate, onEnd);
      });
      return { mode: "official" };
    }

    return this._speakTTS(text, rate, onEnd);
  }

  _speakTTS(text, rate, onEnd) {
    if (!("speechSynthesis" in window)) {
      return { mode: "unsupported" };
    }
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return { mode: "tts" };

    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = "zh-CN";
    if (this.zhVoice) utter.voice = this.zhVoice;
    utter.rate = rate;
    utter.pitch = 1.0;

    this.isSpeaking = true;
    utter.onend = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };
    utter.onerror = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utter);
    return { mode: "tts" };
  }

  speakSequence(sentences = [], { rate = this.rate, onSentenceStart = null, onComplete = null } = {}) {
    this.stop();
    if (!sentences.length) return;
    let idx = 0;
    const next = () => {
      if (idx >= sentences.length) {
        if (onComplete) onComplete();
        return;
      }
      if (onSentenceStart) onSentenceStart(idx);
      const current = sentences[idx];
      idx += 1;
      this._speakTTS(current, rate, () => {
        if (this.isSpeaking === false && idx <= sentences.length) {
          setTimeout(next, 240);
        }
      });
    };
    next();
  }
}

export const audioManager = new AudioManager();

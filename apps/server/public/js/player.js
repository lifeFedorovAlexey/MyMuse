import { refs } from "./dom.js";
import { formatTime, showToast } from "./helpers.js";
import { setCurrentTrack, state } from "./state.js";

const EQ_BAR_COUNT = 12;
let audioContext = null;
let analyser = null;
let sourceNode = null;
let frequencyData = null;
let eqFrameId = 0;
let smoothedEqLevels = Array.from({ length: EQ_BAR_COUNT }, () => 10);
let eqTrailLevels = Array.from({ length: EQ_BAR_COUNT }, () => 10);
let eqBandRanges = [];
let lastVolumeBeforeMute = 0.9;
const EQ_WEIGHTS = [1.16, 1.14, 1.1, 1.06, 1.02, 1, 0.99, 1.02, 1.06, 1.12, 1.18, 1.24];
const EQ_FLOOR = 8;
const EQ_CEILING = 94;

const buildEqBandRanges = () => {
  if (!analyser || !audioContext) {
    return [];
  }

  const maxFrequency = audioContext.sampleRate / 2;
  const minFrequency = 32;
  const usableMaxFrequency = Math.min(maxFrequency, 10500);
  const edges = [];

  for (let index = 0; index <= EQ_BAR_COUNT; index += 1) {
    const ratio = index / EQ_BAR_COUNT;
    const frequency = minFrequency * ((usableMaxFrequency / minFrequency) ** ratio);
    edges.push(frequency);
  }

  return Array.from({ length: EQ_BAR_COUNT }, (_, index) => {
    const start = Math.max(1, Math.floor((edges[index] / maxFrequency) * analyser.frequencyBinCount));
    const end = Math.max(start + 2, Math.ceil((edges[index + 1] / maxFrequency) * analyser.frequencyBinCount));
    return [start, Math.min(end, analyser.frequencyBinCount)];
  });
};

const setEqBars = (levels) => {
  for (let index = 0; index < EQ_BAR_COUNT; index += 1) {
    refs.playScreenGlyph.style.setProperty(`--eq-${index + 1}`, `${levels[index]}%`);
    refs.playScreenGlyph.style.setProperty(`--eq-trail-${index + 1}`, `${eqTrailLevels[index]}%`);
  }
};

const resetEqBars = () => {
  smoothedEqLevels = [8, 14, 20, 12, 24, 10, 18, 26, 14, 22, 16, 10];
  eqTrailLevels = [...smoothedEqLevels];
  setEqBars(smoothedEqLevels);
};

const ensureAnalyser = () => {
  if (analyser) {
    return analyser;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  audioContext = audioContext || new AudioContextCtor();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.minDecibels = -96;
  analyser.maxDecibels = -24;
  analyser.smoothingTimeConstant = 0.56;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  eqBandRanges = buildEqBandRanges();

  if (!sourceNode) {
    sourceNode = audioContext.createMediaElementSource(refs.player);
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
  }

  return analyser;
};

const tickEqualizer = () => {
  if (!analyser || !frequencyData) {
    return;
  }

  analyser.getByteFrequencyData(frequencyData);
  const rawLevels = eqBandRanges.map(([rawStart, rawEnd], index) => {
    const start = Math.min(rawStart, frequencyData.length - 1);
    const end = Math.min(rawEnd, frequencyData.length);
    let total = 0;
    let squaredTotal = 0;
    let peak = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      const value = frequencyData[cursor];
      total += value;
      squaredTotal += value * value;
      peak = Math.max(peak, value);
    }
    const sampleCount = Math.max(1, end - start);
    const average = total / sampleCount;
    const rms = Math.sqrt(squaredTotal / sampleCount);

    // RMS keeps sustained energy readable, while peak lets kick/snare hits snap through.
    const mixed = rms * 0.7 + peak * 0.2 + average * 0.1;
    const normalized = (mixed / 255) ** 0.84;
    const weighted = normalized * 76 * EQ_WEIGHTS[index];
    return Math.max(EQ_FLOOR, Math.min(EQ_CEILING, weighted));
  });

  const levels = rawLevels.map((target, index) => {
    const current = smoothedEqLevels[index] ?? EQ_FLOOR;
    const eased = target > current
      ? current + (target - current) * 0.64
      : current + (target - current) * 0.18;
    return Number(Math.max(EQ_FLOOR, Math.min(EQ_CEILING, eased)).toFixed(2));
  });

  eqTrailLevels = levels.map((level, index) => {
    const currentTrail = eqTrailLevels[index] ?? level;
    if (level >= currentTrail) {
      return Number(Math.min(EQ_CEILING, level + 10).toFixed(2));
    }

    const faded = currentTrail - Math.max(0.4, (currentTrail - level) * 0.05);
    return Number(Math.max(level + 6, faded).toFixed(2));
  });

  smoothedEqLevels = levels;
  setEqBars(levels);
  eqFrameId = window.requestAnimationFrame(tickEqualizer);
};

const startEqualizer = async () => {
  const activeAnalyser = ensureAnalyser();
  if (!activeAnalyser) {
    return;
  }

  if (audioContext?.state === "suspended") {
    await audioContext.resume();
  }

  window.cancelAnimationFrame(eqFrameId);
  tickEqualizer();
};

const stopEqualizer = () => {
  window.cancelAnimationFrame(eqFrameId);
  eqFrameId = 0;
  resetEqBars();
};

const syncVolumeUi = (volume) => {
  const clamped = Math.max(0, Math.min(1, volume));
  refs.player.volume = clamped;
  refs.player.muted = clamped === 0;
  refs.playerVolume.value = String(Math.round(clamped * 100));
  refs.playerVolumeToggle.dataset.volumeState = clamped === 0 ? "muted" : clamped < 0.5 ? "low" : "high";
  refs.playerVolumeToggle.setAttribute("aria-label", clamped === 0 ? "Включить звук" : "Отключить звук");
};

const openVolumePopover = () => {
  refs.playerVolumePopover.classList.add("is-open");
};

const closeVolumePopover = () => {
  refs.playerVolumePopover.classList.remove("is-open");
};

const toggleMute = () => {
  const currentVolume = Number(refs.playerVolume.value) / 100;
  if (currentVolume <= 0.001 || refs.player.muted) {
    syncVolumeUi(lastVolumeBeforeMute || 0.9);
    return;
  }

  lastVolumeBeforeMute = currentVolume;
  syncVolumeUi(0);
};

const updateBufferedProgress = () => {
  const duration = refs.player.duration || 0;
  if (!duration || refs.player.buffered.length === 0) {
    refs.playerBuffered.style.width = "0%";
    refs.playerStreamStatus.textContent = state.currentTrack ? "Буферизация потока..." : "Ожидание трека";
    return;
  }

  const bufferedEnd = refs.player.buffered.end(refs.player.buffered.length - 1);
  const percent = Math.max(0, Math.min(100, (bufferedEnd / duration) * 100));
  refs.playerBuffered.style.width = `${percent}%`;
  refs.playerStreamStatus.textContent = percent >= 99 ? "Поток загружен" : `Буфер ${Math.round(percent)}%`;
};

const updateTransportState = () => {
  const hasTrack = Boolean(state.currentTrack || state.tracks[0]);
  refs.playerPrev.disabled = !hasTrack || state.tracks.length < 2;
  refs.playerNext.disabled = !hasTrack || state.tracks.length < 2;
  refs.playerLyrics.disabled = !hasTrack;
};

const stepTrack = async (direction) => {
  const list = state.tracks;
  if (!list.length) {
    return;
  }

  const currentId = state.currentTrack?.id || list[0]?.id;
  const currentIndex = Math.max(
    0,
    list.findIndex((track) => track.id === currentId)
  );
  const nextIndex = (currentIndex + direction + list.length) % list.length;
  await playTrack(list[nextIndex]);
};

export const syncPlayerMeta = () => {
  const track = state.currentTrack;
  if (!track) {
    refs.nowPlayingTitle.textContent = "Ничего не выбрано";
    refs.nowPlayingSubtitle.textContent = "Выбери трек в библиотеке или по shared link.";
    refs.playerToggle.textContent = "▶";
    refs.playerProgress.value = "0";
    refs.playerBuffered.style.width = "0%";
    refs.currentTime.textContent = "0:00";
    refs.durationTime.textContent = "0:00";
    refs.playerStreamStatus.textContent = "Ожидание трека";
    updateTransportState();
    return;
  }

  refs.nowPlayingTitle.textContent = track.title;
  refs.nowPlayingSubtitle.textContent = `${track.artist} • ${track.album}`;
  refs.playerStreamStatus.textContent = "Подключение к потоку...";
  updateTransportState();
};

export const resetPlayer = () => {
  refs.player.pause();
  refs.player.removeAttribute("src");
  refs.player.load();
  setCurrentTrack(null);
  stopEqualizer();
  syncPlayerMeta();
};

export const playTrack = async (track) => {
  const source = state.shareToken ? `/api/shares/${state.shareToken}/stream` : `/api/tracks/${track.id}/stream`;
  const resolvedSource = new URL(source, window.location.origin).toString();

  if (refs.player.src !== resolvedSource) {
    refs.player.src = source;
  }

  setCurrentTrack(track);
  syncPlayerMeta();

  try {
    await refs.player.play();
  } catch {
    showToast("Браузер заблокировал автозапуск, нажми Play.");
  }
};

export const togglePlayback = async () => {
  if (!state.currentTrack && state.tracks[0]) {
    await playTrack(state.tracks[0]);
    return;
  }

  if (refs.player.paused) {
    await refs.player.play();
  } else {
    refs.player.pause();
  }
};

export const initPlayerControls = ({ onPlaybackStateChange }) => {
  refs.playerPrev.addEventListener("click", async () => {
    await stepTrack(-1);
    onPlaybackStateChange();
  });

  refs.playerToggle.addEventListener("click", async () => {
    await togglePlayback();
    onPlaybackStateChange();
  });

  refs.playerNext.addEventListener("click", async () => {
    await stepTrack(1);
    onPlaybackStateChange();
  });

  refs.playerVolumeToggle.addEventListener("click", () => {
    openVolumePopover();
    toggleMute();
  });

  refs.playerLyrics.addEventListener("click", () => {
    showToast("Экран текста трека подготовим отдельно.");
  });

  refs.player.addEventListener("play", () => {
    refs.playerToggle.textContent = "❚❚";
    startEqualizer().catch(() => undefined);
    onPlaybackStateChange();
  });

  refs.player.addEventListener("pause", () => {
    refs.playerToggle.textContent = "▶";
    stopEqualizer();
    onPlaybackStateChange();
  });

  refs.player.addEventListener("loadedmetadata", () => {
    refs.durationTime.textContent = formatTime(refs.player.duration);
    updateBufferedProgress();
  });

  refs.player.addEventListener("progress", () => {
    updateBufferedProgress();
  });

  refs.player.addEventListener("timeupdate", () => {
    const duration = refs.player.duration || 0;
    const current = refs.player.currentTime || 0;
    refs.currentTime.textContent = formatTime(current);
    refs.durationTime.textContent = formatTime(duration);
    refs.playerProgress.value = duration ? String((current / duration) * 100) : "0";
    updateBufferedProgress();
  });

  refs.playerProgress.addEventListener("input", () => {
    if (!refs.player.duration) {
      return;
    }
    refs.player.currentTime = (Number(refs.playerProgress.value) / 100) * refs.player.duration;
  });

  refs.playerVolume.addEventListener("input", () => {
    const nextVolume = Number(refs.playerVolume.value) / 100;
    if (nextVolume > 0) {
      lastVolumeBeforeMute = nextVolume;
    }
    syncVolumeUi(nextVolume);
    openVolumePopover();
  });

  refs.playerVolumePopover.addEventListener("pointerdown", () => {
    openVolumePopover();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!refs.playerVolumePopover.contains(event.target) && !refs.playerVolumeToggle.contains(event.target)) {
      closeVolumePopover();
    }
  });

  syncVolumeUi(Number(refs.playerVolume.value) / 100);
  resetEqBars();
  updateTransportState();
};

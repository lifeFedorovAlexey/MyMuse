import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeControl {
  listeners = new Map<string, Array<(event?: Event) => void>>();
  textContent = "";
  value = "";
  disabled = false;
  dataset: Record<string, string> = {};
  className = "";
  attributes = new Map<string, string>();

  private classSet = new Set<string>();

  classList = {
    add: (...tokens: string[]) => tokens.forEach((token) => this.classSet.add(token)),
    remove: (...tokens: string[]) => tokens.forEach((token) => this.classSet.delete(token)),
    contains: (token: string) => this.classSet.has(token)
  };

  addEventListener(type: string, handler: (event?: Event) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  dispatch(type: string) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({ target: this } as Event);
    }
  }

  click() {
    this.dispatch("click");
  }

  contains(target: unknown) {
    return target === this;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  reset() {
    this.listeners.clear();
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    this.dataset = {};
    this.attributes.clear();
    this.classSet.clear();
  }
}

class FakeAudio extends FakeControl {
  paused = true;
  src = "";
  duration = 225;
  currentTime = 0;
  volume = 0.9;
  muted = false;
  buffered = {
    length: 1,
    end: () => 180
  };

  async play() {
    this.paused = false;
  }

  pause() {
    this.paused = true;
  }

  load() {}

  removeAttribute(name: string) {
    if (name === "src") {
      this.src = "";
    }
  }
}

const toastSpy = vi.fn();
const state = {
  tracks: [] as Array<{ id: string; title: string; artist: string; album: string }>,
  playlists: [],
  shares: [],
  search: "",
  appView: "play",
  shareToken: null as string | null,
  inviteToken: null as string | null,
  currentTrack: null as { id: string; title: string; artist: string; album: string } | null,
  accessToken: null,
  user: null,
  ownerExists: false
};

const refs = {
  player: new FakeAudio(),
  playerPrev: new FakeControl(),
  playerToggle: new FakeControl(),
  playerNext: new FakeControl(),
  playerProgress: new FakeControl(),
  playerBuffered: { style: { width: "0%" } },
  playerVolume: new FakeControl(),
  playerVolumeToggle: new FakeControl(),
  playerVolumeIcon: new FakeControl(),
  playerVolumePopover: new FakeControl(),
  playerLyrics: new FakeControl(),
  playerStreamStatus: new FakeControl(),
  currentTime: new FakeControl(),
  durationTime: new FakeControl(),
  playScreenGlyph: { style: { setProperty: vi.fn() }, textContent: "" },
  nowPlayingTitle: new FakeControl(),
  nowPlayingSubtitle: new FakeControl()
};

const documentListeners = new Map<string, Array<(event?: Event) => void>>();

vi.mock("../public/js/dom.js", () => ({
  refs
}));

vi.mock("../public/js/helpers.js", () => ({
  formatTime: (value: number) => {
    if (!Number.isFinite(value)) return "0:00";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  },
  showToast: toastSpy
}));

vi.mock("../public/js/state.js", () => ({
  state,
  setCurrentTrack: (track: typeof state.currentTrack) => {
    state.currentTrack = track;
  }
}));

describe("F-0008 Player Controls UI", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    documentListeners.clear();

    globalThis.document = {
      addEventListener: (type: string, handler: (event?: Event) => void) => {
        const list = documentListeners.get(type) ?? [];
        list.push(handler);
        documentListeners.set(type, list);
      }
    } as unknown as Document;

    globalThis.window = {
      location: { origin: "http://localhost:8080" },
      cancelAnimationFrame: vi.fn(),
      requestAnimationFrame: vi.fn(() => 1),
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 1)
    } as unknown as Window & typeof globalThis;

    state.tracks = [];
    state.currentTrack = null;
    state.shareToken = null;

    refs.player.reset();
    refs.playerPrev.reset();
    refs.playerToggle.reset();
    refs.playerNext.reset();
    refs.playerProgress.reset();
    refs.playerVolume.reset();
    refs.playerVolumeToggle.reset();
    refs.playerVolumeIcon.reset();
    refs.playerVolumePopover.reset();
    refs.playerLyrics.reset();
    refs.playerStreamStatus.reset();
    refs.currentTime.reset();
    refs.durationTime.reset();
    refs.nowPlayingTitle.reset();
    refs.nowPlayingSubtitle.reset();

    refs.player.paused = true;
    refs.player.src = "";
    refs.player.currentTime = 0;
    refs.player.volume = 0.9;
    refs.player.muted = false;
    refs.playerProgress.value = "0";
    refs.playerVolume.value = "90";
    refs.playerToggle.textContent = "▶";
    refs.playerVolumeToggle.dataset = {};
    refs.playerVolumePopover.classList.remove("is-open");
    refs.playerPrev.disabled = false;
    refs.playerNext.disabled = false;
    refs.playerLyrics.disabled = false;
  });

  it("wires prev, play/pause and next buttons to track navigation", async () => {
    const { initPlayerControls } = await import("../public/js/player.js");
    const onPlaybackStateChange = vi.fn();
    state.tracks = [
      { id: "1", title: "One", artist: "A", album: "X" },
      { id: "2", title: "Two", artist: "B", album: "Y" },
      { id: "3", title: "Three", artist: "C", album: "Z" }
    ];
    state.currentTrack = state.tracks[1];

    initPlayerControls({ onPlaybackStateChange });

    await refs.playerPrev.click();
    await Promise.resolve();
    expect(state.currentTrack?.id).toBe("1");
    expect(refs.player.src).toContain("/api/tracks/1/stream");

    await refs.playerNext.click();
    await Promise.resolve();
    expect(state.currentTrack?.id).toBe("2");

    refs.player.paused = true;
    await refs.playerToggle.click();
    await Promise.resolve();
    expect(refs.player.paused).toBe(false);

    refs.playerToggle.click();
    expect(refs.player.paused).toBe(true);
  });

  it("starts first track from play button when nothing is selected", async () => {
    const { initPlayerControls } = await import("../public/js/player.js");
    state.tracks = [{ id: "a1", title: "Alpha", artist: "Demo", album: "Set" }];

    initPlayerControls({ onPlaybackStateChange: vi.fn() });

    await refs.playerToggle.click();
    await Promise.resolve();

    expect(state.currentTrack?.id).toBe("a1");
    expect(refs.player.src).toContain("/api/tracks/a1/stream");
    expect(refs.nowPlayingTitle.textContent).toBe("Alpha");
  });

  it("shows lyrics placeholder toast from text button", async () => {
    const { initPlayerControls } = await import("../public/js/player.js");
    state.tracks = [{ id: "a1", title: "Alpha", artist: "Demo", album: "Set" }];

    initPlayerControls({ onPlaybackStateChange: vi.fn() });
    refs.playerLyrics.click();

    expect(toastSpy).toHaveBeenCalledWith("Экран текста трека подготовим отдельно.");
  });

  it("toggles mute and opens the volume popover from the volume button", async () => {
    const { initPlayerControls } = await import("../public/js/player.js");
    state.tracks = [{ id: "a1", title: "Alpha", artist: "Demo", album: "Set" }];

    initPlayerControls({ onPlaybackStateChange: vi.fn() });

    refs.playerVolumeToggle.click();
    expect(refs.playerVolumePopover.classList.contains("is-open")).toBe(true);
    expect(refs.player.volume).toBe(0);
    expect(refs.playerVolume.value).toBe("0");
    expect(refs.playerVolumeToggle.dataset.volumeState).toBe("muted");

    refs.playerVolumeToggle.click();
    expect(refs.player.volume).toBeCloseTo(0.9, 5);
    expect(refs.playerVolume.value).toBe("90");
    expect(refs.playerVolumeToggle.dataset.volumeState).toBe("high");
  });

  it("updates volume level from the slider and keeps transport disabled state correct", async () => {
    const { initPlayerControls } = await import("../public/js/player.js");

    initPlayerControls({ onPlaybackStateChange: vi.fn() });
    expect(refs.playerPrev.disabled).toBe(true);
    expect(refs.playerNext.disabled).toBe(true);
    expect(refs.playerLyrics.disabled).toBe(true);

    state.tracks = [
      { id: "1", title: "One", artist: "A", album: "X" },
      { id: "2", title: "Two", artist: "B", album: "Y" }
    ];

    refs.playerVolume.value = "35";
    refs.playerVolume.dispatch("input");

    expect(refs.player.volume).toBeCloseTo(0.35, 5);
    expect(refs.playerVolumeToggle.dataset.volumeState).toBe("low");
    expect(refs.playerVolumePopover.classList.contains("is-open")).toBe(true);
  });
});

const accessToken = localStorage.getItem("mymuse_access_token");

export const state = {
  tracks: [],
  playlists: [],
  shares: [],
  search: "",
  appView: "play",
  shareToken: null,
  inviteToken: null,
  currentTrack: null,
  accessToken,
  user: null,
  ownerExists: false
};

export const setAccessToken = (token) => {
  state.accessToken = token;
  if (token) {
    localStorage.setItem("mymuse_access_token", token);
  } else {
    localStorage.removeItem("mymuse_access_token");
  }
};

export const setCurrentTrack = (track) => {
  state.currentTrack = track;
};

export const resetSessionState = () => {
  state.tracks = [];
  state.playlists = [];
  state.shares = [];
  state.appView = "play";
  state.currentTrack = null;
  state.shareToken = null;
  state.user = null;
};

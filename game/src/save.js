// localStorage save / load. Progress only — no account, no network.

const KEY = 'solmarbay-save-v2';

export function saveGame(G) {
  try {
    const data = {
      cash: Math.round(G.cash),
      missionIndex: G.missionIndex,
      completed: G.missionsDone.slice(),
      px: Math.round(G.player.x),
      py: Math.round(G.player.y),
      health: Math.round(G.player.hp),
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.missionIndex !== 'number') return null;
    return d;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
}

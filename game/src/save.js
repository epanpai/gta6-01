// Save / load. One job: persist money, mission progress and the player's
// spot in the city to localStorage, and read it back.
const KEY = 'solmar-bay-save-v1';

export function saveGame(world) {
  try {
    const p = world.player;
    const data = {
      money: Math.floor(world.money),
      missionIndex: world.missions.index,
      completed: world.missions.completed,
      totalEarned: world.missions.totalEarned,
      x: Math.round(p.x),
      y: Math.round(p.y),
      health: Math.round(p.health),
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
    if (typeof d.money !== 'number' || typeof d.missionIndex !== 'number') return null;
    return d;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}

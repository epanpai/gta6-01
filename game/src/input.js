// Keyboard + mouse state. One shared object the game loop reads each frame.

export function createInput(canvas) {
  const input = {
    keys: Object.create(null),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    // Edge-triggered presses, consumed by the loop each frame.
    pressed: Object.create(null),
    clicked: false,
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!input.keys[e.code]) input.pressed[e.code] = true;
    input.keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(input.keys)) input.keys[k] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
      const r = canvas.getBoundingClientRect();
      input.mouseX = e.clientX - r.left;
      input.mouseY = e.clientY - r.top;
    }
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}

export function down(input, ...codes) {
  return codes.some((c) => !!input.keys[c]);
}

// True once on the frame the key went down; call after reading to clear.
export function wasPressed(input, code) {
  return !!input.pressed[code];
}

export function endFrame(input) {
  for (const k of Object.keys(input.pressed)) input.pressed[k] = false;
  input.clicked = false;
}

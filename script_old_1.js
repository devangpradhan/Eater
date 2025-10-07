// --- Config ---
const BLOCK_SIZE = 28;
const GRID_COLS = Math.floor(window.innerWidth / BLOCK_SIZE);
const GRID_ROWS = Math.floor(window.innerHeight / BLOCK_SIZE);

// --- PixiJS Setup ---
const app = new PIXI.Application({
  width: GRID_COLS * BLOCK_SIZE,
  height: GRID_ROWS * BLOCK_SIZE,
  backgroundColor: 0xffffff,
  antialias: false,
  resolution: window.devicePixelRatio || 1,
});
document.body.appendChild(app.view);

// --- State ---
let snake = [{ col: 5, row: 5 }]; // Snake body: head is first element
let snakeDir = { x: 1, y: 0 };
let snakeMovingToBet = false;
let snakePausedUntil = 0;
let cursor = { col: 0, row: 0 };
let betModeMultiple = true;
let bets = []; // Array of {col, row, color}
let eatenBetsCount = 0; // Track the number of eaten bets

// --- Graphics Containers ---
const gridGfx = new PIXI.Graphics();
const snakeGfx = new PIXI.Graphics();
const betGfx = new PIXI.Graphics();
const cursorGfx = new PIXI.Graphics();

// Add graphics directly to the stage
app.stage.addChild(gridGfx, betGfx, snakeGfx, cursorGfx);

// --- Draw Grid ---
function drawGrid() {
  gridGfx.clear();
  gridGfx.lineStyle(1, 0xeeeeee, 0.5);

  // Draw horizontal lines
  for (let r = 0; r <= GRID_ROWS; r++) {
    gridGfx.moveTo(0, r * BLOCK_SIZE);
    gridGfx.lineTo(GRID_COLS * BLOCK_SIZE, r * BLOCK_SIZE);
  }

  // Draw vertical lines
  for (let c = 0; c <= GRID_COLS; c++) {
    gridGfx.moveTo(c * BLOCK_SIZE, 0);
    gridGfx.lineTo(c * BLOCK_SIZE, GRID_ROWS * BLOCK_SIZE);
  }
}

// --- Draw Snake ---
// Helper: Generate a pixelated scale texture for the snake segment
function generatePixelScaleTexture(color1, color2) {
  const size = 16; // Small for pixel effect
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Fill base color
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, size, size);

  // Draw pixel "scales" in a staggered pattern
  ctx.fillStyle = color2;
  for (let y = 0; y < size; y += 4) {
    for (let x = (y % 8 === 0 ? 0 : 2); x < size; x += 4) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
  return canvas;
}

function drawSnake() {
  snakeGfx.clear();
  for (const [i, part] of snake.entries()) {
    // Alternate colors for a pattern
    const baseColor = i % 2 === 0 ? '#3f3f3f' : '#171a14ff'; // Olive/dark green
    const scaleColor = i % 2 === 0 ? '#f8f8f8ff' : '#c2c2c2ff'; // Lighter green

    // Draw shadow for 3D effect
    snakeGfx.beginFill(0x000000, 0.18);
    snakeGfx.drawRoundedRect(
      part.col * BLOCK_SIZE + 4,
      part.row * BLOCK_SIZE + 6,
      BLOCK_SIZE - 8,
      BLOCK_SIZE - 8,
      BLOCK_SIZE / 1.8
    );
    snakeGfx.endFill();

    // Draw main body with pixelated scale texture
    const texture = PIXI.Texture.from(generatePixelScaleTexture(baseColor, scaleColor));
    snakeGfx.beginTextureFill({
      texture: texture,
      matrix: new PIXI.Matrix().translate(part.col * BLOCK_SIZE, part.row * BLOCK_SIZE)
    });
    snakeGfx.drawRoundedRect(
      part.col * BLOCK_SIZE,
      part.row * BLOCK_SIZE,
      BLOCK_SIZE - 2,
      BLOCK_SIZE - 2,
      BLOCK_SIZE / 5.5 // More rounded for curvy look
    );
    snakeGfx.endFill();

    // Draw eyes on head
    if (i === 0) {
      const eyeW = 2, eyeH = 5;
      const offsetX = BLOCK_SIZE / 4;
      const offsetY = BLOCK_SIZE / 3;
      // Left eye
      snakeGfx.beginFill(0xffffff);
      snakeGfx.drawEllipse(
        part.col * BLOCK_SIZE + offsetX + 2,
        part.row * BLOCK_SIZE + offsetY + 2,
        eyeW, eyeH
      );
      snakeGfx.endFill();
      // Right eye
      snakeGfx.beginFill(0xffffff);
      snakeGfx.drawEllipse(
        part.col * BLOCK_SIZE + BLOCK_SIZE - offsetX - eyeW + 2,
        part.row * BLOCK_SIZE + offsetY + 2,
        eyeW, eyeH
      );
      snakeGfx.endFill();
    }
  }
}

// Helper: Generate a vertical gradient texture for the snake segment
function generateGradientTexture(color1, color2) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = BLOCK_SIZE;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, BLOCK_SIZE);
  grad.addColorStop(0, '#' + color1.toString(16).padStart(6, '0'));
  grad.addColorStop(1, '#' + color2.toString(16).padStart(6, '0'));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, BLOCK_SIZE);
  return canvas;
}

// --- Draw Bets ---
function drawBets() {
  betGfx.clear();
  bets.forEach((bet) => {
    betGfx.beginFill(PIXI.utils.string2hex(bet.color));
    betGfx.drawRect(bet.col * BLOCK_SIZE, bet.row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    betGfx.endFill();
  });
}

// --- Draw Cursor ---
function drawCursor() {
  cursorGfx.clear();
  cursorGfx.lineStyle(2, 0xffffff, 1);
  cursorGfx.drawRect(cursor.col * BLOCK_SIZE, cursor.row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// --- Mouse Cursor ---
app.view.addEventListener('mousemove', e => {
  const rect = app.view.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  cursor.col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / BLOCK_SIZE)));
  cursor.row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / BLOCK_SIZE)));
});

// --- Place Bet ---
app.view.addEventListener('click', () => {
  if (betModeMultiple) {
    // Add bet if not already present at this cell
    if (!bets.some(b => b.col === cursor.col && b.row === cursor.row)) {
      bets.push({
        col: cursor.col,
        row: cursor.row,
        color: getRandomColor()
      });
    }
  } else {
    bets = [{
      col: cursor.col,
      row: cursor.row,
      color: getRandomColor()
    }];
  }
  snakeMovingToBet = true;
});

// --- Place Bet (Touch Support) ---
app.view.addEventListener('touchstart', function (e) {
  e.preventDefault();
  const rect = app.view.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  cursor.col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / BLOCK_SIZE)));
  cursor.row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / BLOCK_SIZE)));

  if (betModeMultiple) {
    if (!bets.some(b => b.col === cursor.col && b.row === cursor.row)) {
      bets.push({
        col: cursor.col,
        row: cursor.row,
        color: getRandomColor()
      });
    }
  } else {
    bets = [{
      col: cursor.col,
      row: cursor.row,
      color: getRandomColor()
    }];
  }
  snakeMovingToBet = true;
}, { passive: false });

// --- Cursor Movement (Touch Support) ---
app.view.addEventListener('touchmove', function (e) {
  e.preventDefault();
  const rect = app.view.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  cursor.col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / BLOCK_SIZE)));
  cursor.row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / BLOCK_SIZE)));
}, { passive: false });

// --- Snake Movement ---
function moveSnake() {
  if (Date.now() < snakePausedUntil) return; // Pause after eating

  let head = snake[0];
  let next = { col: head.col, row: head.row };

  if (snakeMovingToBet && bets.length > 0) {
    // Move towards first bet in sequence
    const bet = bets[0];
    if (head.col < bet.col) next.col++;
    else if (head.col > bet.col) next.col--;
    else if (head.row < bet.row) next.row++;
    else if (head.row > bet.row) next.row--;
    // If reached bet
    if (next.col === bet.col && next.row === bet.row) {
      // Grow snake by adding a new segment at the tail
      const tail = snake[snake.length - 1];
      snake.push({ col: tail.col, row: tail.row });
      bets.shift(); // Remove eaten bet
      eatenBetsCount++; // Increment eaten bets count
      snakeMovingToBet = bets.length > 0;
      snakePausedUntil = Date.now() + 50; // Pause 0.5s
    }
  } else {
    // Random roam (no reverse, no self-collision)
    const dirs = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
    ];
    // Prevent reversing into itself
    const last = snake[1] || head;
    let validDirs = dirs.filter(d => head.col + d.x !== last.col || head.row + d.y !== last.row);
    // Prevent moving into own body
    validDirs = validDirs.filter(d => {
      const newCol = head.col + d.x;
      const newRow = head.row + d.y;
      return !snake.some(part => part.col === newCol && part.row === newRow);
    });
    // If no valid dirs, stay in place
    const dir = validDirs.length ? validDirs[Math.floor(Math.random() * validDirs.length)] : { x: 0, y: 0 };
    next.col += dir.x;
    next.row += dir.y;
    // Stay in bounds
    next.col = Math.max(0, Math.min(GRID_COLS - 1, next.col));
    next.row = Math.max(0, Math.min(GRID_ROWS - 1, next.row));
  }

  // Move snake body
  for (let i = snake.length - 1; i > 0; i--) {
    snake[i] = { ...snake[i - 1] };
  }
  snake[0] = next;
}

// --- Random Color Generator ---
function getRandomColor() {
  // Returns a random hex color string
  return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
}

// --- Game Loop ---
let lastMove = 0;
app.ticker.add((delta) => {
  const now = performance.now();
  // Snake speed increases with bet count (min 60ms, max 200ms)
  let baseSpeed = 200;
  let speed = Math.max(60, baseSpeed - bets.length * 25);
  if (now - lastMove > speed) {
    moveSnake();
    lastMove = now;
  }
  drawGrid();
  drawBets();
  drawSnake();
  drawCursor();
  // Update eaten bet count display
  document.getElementById('betCountDisplay').textContent = 'Eaten Bets: ' + eatenBetsCount;
});

// --- Responsive Resize ---
function resize() {
  const cols = Math.floor(window.innerWidth / BLOCK_SIZE);
  const rows = Math.floor(window.innerHeight / BLOCK_SIZE);
  app.renderer.resize(cols * BLOCK_SIZE, rows * BLOCK_SIZE);
}
window.addEventListener('resize', resize);

// Toggle bet mode button
document.getElementById('toggleBetMode').onclick = function () {
  betModeMultiple = !betModeMultiple;
  this.textContent = betModeMultiple ? 'Multiple Bet: ON' : 'Multiple Bet: OFF';
  if (!betModeMultiple && bets.length > 1) {
    bets = bets.length ? [bets[0]] : [];
  }
};

// Initial draw
resize();
drawGrid();
drawSnake();
drawBets();
drawCursor();
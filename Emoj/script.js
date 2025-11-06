// --- Config ---
const BLOCK_SIZE = 28;
let GRID_COLS = Math.floor(window.innerWidth / BLOCK_SIZE);
let GRID_ROWS = Math.floor(window.innerHeight / BLOCK_SIZE);

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
let bets = []; // Array of {col, row, color, shape}
let eatenBetsCount = 0; // Track the number of eaten bets

// --- Graphics Containers ---
const gridGfx = new PIXI.Graphics();
const snakeGfx = new PIXI.Graphics();
const betGfx = new PIXI.Graphics();
const cursorGfx = new PIXI.Graphics();

app.stage.addChild(gridGfx, betGfx, snakeGfx, cursorGfx);

// --- Helper: Generate a pixelated scale texture for the snake segment
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

// --- Food & Drink Emojis ---
const FOOD_EMOJIS = [
  '🍄','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🥜','🫘','🌰','🫛','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍘','🍠','🍤','🍥','🥟','🦀','🦞','🦐','🦑','🦪','🍨','🍩','🍪','🎂','🍰','🧁','🥧'
];

// --- Helper: Randomly pick a Food & Drink emoji
function getRandomFoodEmoji() {
  return FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
}

// --- Create a random bet object (Food emoji)
function createRandomBet(col, row) {
  return {
    col,
    row,
    emoji: getRandomFoodEmoji()
  };
}

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
function drawSnake() {
  snakeGfx.clear();
  if (snakeGfx.children) {
    snakeGfx.removeChildren();
  }
  for (let i = 0; i < snake.length; i++) {
    const part = snake[i];
    let emojiChar, fontSize, offsetX, offsetY;
    if (i === 0) {
      // Head: 👾, largest and in front
      emojiChar = '👾';
      fontSize = BLOCK_SIZE * 1.7;
      offsetX = BLOCK_SIZE * 0.35;
      offsetY = BLOCK_SIZE * 0.35;
    } else {
      // Body: 👁‍🗨, even larger and overlapping
      emojiChar = '👁‍🗨';
      fontSize = BLOCK_SIZE * 1.45;
      offsetX = BLOCK_SIZE * 0.28;
      offsetY = BLOCK_SIZE * 0.28;
    }
    const emoji = new PIXI.Text(emojiChar, {
      fontSize: fontSize,
      align: 'center',
      fontWeight: 'bold',
    });
    // Center and overlap segments for a smooth tube effect
    emoji.x = part.col * BLOCK_SIZE - offsetX;
    emoji.y = part.row * BLOCK_SIZE - offsetY;
    emoji.resolution = 2;
    snakeGfx.addChild(emoji);
  }
}

// --- Draw Bets ---

// --- Draw Bets (with modern geometric shapes) ---
function drawBets() {
  betGfx.clear();
  if (betGfx.children) {
    betGfx.removeChildren();
  }
  bets.forEach((bet) => {
    const emoji = new PIXI.Text(bet.emoji, {
      fontSize: BLOCK_SIZE * 1.1,
      align: 'center',
    });
    emoji.x = bet.col * BLOCK_SIZE;
    emoji.y = bet.row * BLOCK_SIZE;
    emoji.resolution = 2;
    betGfx.addChild(emoji);
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

// --- Place Bet (Mouse) ---
app.view.addEventListener('click', () => {
  if (betModeMultiple) {
    if (!bets.some(b => b.col === cursor.col && b.row === cursor.row)) {
      bets.push(createRandomBet(cursor.col, cursor.row));
    }
  } else {
    bets = [createRandomBet(cursor.col, cursor.row)];
  }
  snakeMovingToBet = true;
});

// --- Place Bet (Touch Support) ---
app.view.addEventListener('touchstart', function (e) {
  e.preventDefault();
  // Recalculate grid size in case of orientation change
  GRID_COLS = Math.floor(window.innerWidth / BLOCK_SIZE);
  GRID_ROWS = Math.floor(window.innerHeight / BLOCK_SIZE);

  const rect = app.view.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  cursor.col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / BLOCK_SIZE)));
  cursor.row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / BLOCK_SIZE)));

  if (betModeMultiple) {
    if (!bets.some(b => b.col === cursor.col && b.row === cursor.row)) {
      bets.push(createRandomBet(cursor.col, cursor.row));
    }
  } else {
    bets = [createRandomBet(cursor.col, cursor.row)];
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
  GRID_COLS = Math.floor(window.innerWidth / BLOCK_SIZE);
  GRID_ROWS = Math.floor(window.innerHeight / BLOCK_SIZE);
  app.renderer.resize(GRID_COLS * BLOCK_SIZE, GRID_ROWS * BLOCK_SIZE);

  // Keep snake and bets in bounds
  snake.forEach(part => {
    part.col = Math.max(0, Math.min(GRID_COLS - 1, part.col));
    part.row = Math.max(0, Math.min(GRID_ROWS - 1, part.row));
  });
  bets = bets.filter(bet =>
    bet.col >= 0 && bet.col < GRID_COLS &&
    bet.row >= 0 && bet.row < GRID_ROWS
  );
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
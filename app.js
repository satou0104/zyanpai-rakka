// Mahjong Drop - Main Game Logic
// Tile image paths
const TILE_IMAGES = {
    // Man (1m-9m)
    man: ['manzu/1man.png','manzu/2man.png','manzu/3man.png','manzu/4man.png','manzu/5man.png','manzu/6man.png','manzu/7man.png','manzu/8man.png','manzu/9man.png'],
    // Pin (1p-9p)
    pin: ['pinzu/1pin.png','pinzu/2pin.png','pinzu/3pin.png','pinzu/4pin.png','pinzu/5pin.png','pinzu/6pin.png','pinzu/7pin.png','pinzu/8pin.png','pinzu/9pin.png'],
    // Sou (1s-9s)
    sou: ['so-zu/1so.png','so-zu/2so.png','so-zu/3so.png','so-zu/4so.png','so-zu/5so.png','so-zu/6so.png','so-zu/7so.png','so-zu/8so.png','so-zu/9so.png'],
    // Honors (East/South/West/North/Haku/Hatsu/Chun)
    jihai: ['zihai/ton.png','zihai/nan.png','zihai/sya.png','zihai/pei.png','zihai/haku.png','zihai/hatu.png','zihai/tyun.png']
};

// Tile ID system: suit*9 + number(0-8), honors: suit=3, number=0-6
// man: 0-8, pin: 9-17, sou: 18-26, jihai: 27-33
function tileIdToInfo(id) {
    if (id < 9) return { suit: 'man', num: id + 1, isJihai: false };
    if (id < 18) return { suit: 'pin', num: id - 9 + 1, isJihai: false };
    if (id < 27) return { suit: 'sou', num: id - 18 + 1, isJihai: false };
    return { suit: 'jihai', num: id - 27 + 1, isJihai: true };
}

// Get image path from tile ID
function tileIdToImage(id) {
    if (id < 9) return TILE_IMAGES.man[id];
    if (id < 18) return TILE_IMAGES.pin[id - 9];
    if (id < 27) return TILE_IMAGES.sou[id - 18];
    return TILE_IMAGES.jihai[id - 27];
}

// Generate tile pool (4 copies of each tile = 34 types x 4 = 136 tiles)
function createTilePool() {
    const pool = [];
    for (let id = 0; id < 34; id++) {
        for (let i = 0; i < 4; i++) {
            pool.push(id);
        }
    }
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
}

// ===== Yaku (Winning Hand) Evaluation =====

// Evaluate hand (receives array of 14 tile IDs)
function judgeHand(hand) {
    // Build count array
    const counts = new Array(34).fill(0);
    hand.forEach(id => counts[id]++);

    const results = [];

    // Seven Pairs check
    if (isChitoitsu(counts)) {
        results.push({ name: 'Seven Pairs', han: 2 });
        // Extra yaku for Seven Pairs
        const extra = checkChitoitsuExtra(hand, counts);
        extra.forEach(y => results.push(y));
    }

    // Thirteen Orphans check
    if (isKokushi(counts)) {
        results.push({ name: 'Thirteen Orphans', han: 13 });
        return { yaku: results, score: calculateScore(13) };
    }

    // Standard form (4 melds + 1 pair) decomposition
    const decompositions = decompose(counts);

    if (decompositions.length > 0) {
        // Check yaku for each decomposition, pick the highest scoring
        let bestYaku = [];
        let bestHan = 0;

        for (const decomp of decompositions) {
            const yaku = checkYaku(hand, counts, decomp);
            const totalHan = yaku.reduce((sum, y) => sum + y.han, 0);
            if (totalHan > bestHan) {
                bestHan = totalHan;
                bestYaku = yaku;
            }
        }

        if (bestHan > 0) {
            return { yaku: bestYaku, score: calculateScore(bestHan) };
        }
    }

    // Return Seven Pairs result if available
    if (results.length > 0) {
        const totalHan = results.reduce((sum, y) => sum + y.han, 0);
        return { yaku: results, score: calculateScore(totalHan) };
    }

    // No yaku
    return { yaku: [], score: 0 };
}

// Seven Pairs check
function isChitoitsu(counts) {
    let pairs = 0;
    for (let i = 0; i < 34; i++) {
        if (counts[i] === 2) pairs++;
        else if (counts[i] !== 0) return false;
    }
    return pairs === 7;
}

// Extra yaku for Seven Pairs
function checkChitoitsuExtra(hand, counts) {
    const extra = [];
    if (isTanyao(hand)) extra.push({ name: 'All Simples', han: 1 });
    if (isHonitsu(counts)) extra.push({ name: 'Half Flush', han: 3 });
    if (isChinitsu(counts)) extra.push({ name: 'Full Flush', han: 6 });
    if (isTsuiisou(counts)) extra.push({ name: 'All Honors', han: 13 });
    return extra;
}

// Thirteen Orphans check
function isKokushi(counts) {
    const kokushiTiles = [0,8,9,17,18,26,27,28,29,30,31,32,33];
    let pairFound = false;
    for (const t of kokushiTiles) {
        if (counts[t] === 0) return false;
        if (counts[t] === 2) pairFound = true;
    }
    return pairFound;
}

// Meld decomposition (4 melds + 1 pair)
function decompose(counts) {
    const results = [];
    const c = counts.slice();

    // Select pair
    for (let head = 0; head < 34; head++) {
        if (c[head] < 2) continue;
        c[head] -= 2;
        const mentsu = [];
        if (extractMentsu(c, 0, mentsu)) {
            results.push({ head, mentsu: mentsu.slice() });
        }
        c[head] += 2;
    }
    return results;
}

// Extract melds (recursive)
function extractMentsu(counts, startIdx, mentsu) {
    if (mentsu.length === 4) {
        // Check if all tiles are used
        return counts.every(c => c === 0);
    }

    for (let i = startIdx; i < 34; i++) {
        if (counts[i] === 0) continue;

        // Try triplet
        if (counts[i] >= 3) {
            counts[i] -= 3;
            mentsu.push({ type: 'kou', tile: i });
            if (extractMentsu(counts, i, mentsu)) return true;
            mentsu.pop();
            counts[i] += 3;
        }

        // Try sequence (numbered tiles only, up to 6)
        if (i < 27 && (i % 9) <= 6) {
            if (counts[i] >= 1 && counts[i+1] >= 1 && counts[i+2] >= 1) {
                counts[i]--;
                counts[i+1]--;
                counts[i+2]--;
                mentsu.push({ type: 'shun', tile: i });
                if (extractMentsu(counts, i, mentsu)) return true;
                mentsu.pop();
                counts[i]++;
                counts[i+1]++;
                counts[i+2]++;
            }
        }

        // Cannot make meld with this tile = fail
        break;
    }
    return false;
}

// Standard form yaku evaluation
function checkYaku(hand, counts, decomp) {
    const yaku = [];
    const { head, mentsu } = decomp;
    const headInfo = tileIdToInfo(head);
    const shunCount = mentsu.filter(m => m.type === 'shun').length;
    const kouCount = mentsu.filter(m => m.type === 'kou').length;

    // All Simples
    if (isTanyao(hand)) yaku.push({ name: 'All Simples', han: 1 });

    // Pinfu (4 sequences + non-value pair)
    if (shunCount === 4 && !headInfo.isJihai) {
        yaku.push({ name: 'Pinfu', han: 1 });
    }

    // Pure Double Sequence
    if (hasIipeiko(mentsu)) yaku.push({ name: 'Pure Double Sequence', han: 1 });

    // Twice Pure Double Sequence
    if (hasRyanpeiko(mentsu)) {
        const idx = yaku.findIndex(y => y.name === 'Pure Double Sequence');
        if (idx >= 0) yaku.splice(idx, 1);
        yaku.push({ name: 'Twice Pure Double Sequence', han: 3 });
    }

    // Value Tiles (Dragons: Haku/Hatsu/Chun)
    for (const m of mentsu) {
        if (m.type === 'kou') {
            if (m.tile === 31) yaku.push({ name: 'Value Tile (Haku)', han: 1 });
            if (m.tile === 32) yaku.push({ name: 'Value Tile (Hatsu)', han: 1 });
            if (m.tile === 33) yaku.push({ name: 'Value Tile (Chun)', han: 1 });
            if (m.tile === 27) yaku.push({ name: 'Value Tile (East)', han: 1 });
        }
    }

    // All Triplets
    if (kouCount === 4) yaku.push({ name: 'All Triplets', han: 2 });

    // Three Concealed Triplets
    if (kouCount === 3) yaku.push({ name: 'Three Concealed Triplets', han: 2 });

    // Half Flush
    if (isHonitsu(counts)) yaku.push({ name: 'Half Flush', han: 3 });

    // Full Flush
    if (isChinitsu(counts)) yaku.push({ name: 'Full Flush', han: 6 });

    // Mixed Terminals
    if (isHonroutou(hand)) yaku.push({ name: 'Mixed Terminals', han: 2 });

    // Little Three Dragons
    if (isShousangen(mentsu, head)) yaku.push({ name: 'Little Three Dragons', han: 2 });

    // Big Three Dragons
    if (isDaisangen(mentsu)) yaku.push({ name: 'Big Three Dragons', han: 13 });

    // All Honors
    if (isTsuiisou(counts)) yaku.push({ name: 'All Honors', han: 13 });

    // Four Concealed Triplets
    if (kouCount === 4) yaku.push({ name: 'Four Concealed Triplets', han: 13 });

    // Pure Terminals
    if (isChinroutou(hand)) yaku.push({ name: 'Pure Terminals', han: 13 });

    // Straight
    if (isIkkitsukan(mentsu)) yaku.push({ name: 'Straight', han: 2 });

    // Mixed Triple Sequence
    if (isSanshokuDoujun(mentsu)) yaku.push({ name: 'Mixed Triple Sequence', han: 2 });

    // Triple Triplets
    if (isSanshokuDoukou(mentsu)) yaku.push({ name: 'Triple Triplets', han: 2 });

    return yaku;
}

// All Simples (2-8 only)
function isTanyao(hand) {
    return hand.every(id => {
        const info = tileIdToInfo(id);
        if (info.isJihai) return false;
        return info.num >= 2 && info.num <= 8;
    });
}

// Half Flush (one suit + honors only)
function isHonitsu(counts) {
    const hasSuit = [false, false, false];
    let hasJihai = false;
    for (let i = 0; i < 9; i++) if (counts[i] > 0) hasSuit[0] = true;
    for (let i = 9; i < 18; i++) if (counts[i] > 0) hasSuit[1] = true;
    for (let i = 18; i < 27; i++) if (counts[i] > 0) hasSuit[2] = true;
    for (let i = 27; i < 34; i++) if (counts[i] > 0) hasJihai = true;

    const suitCount = hasSuit.filter(Boolean).length;
    return suitCount === 1 && hasJihai;
}

// Full Flush (one suit only)
function isChinitsu(counts) {
    const hasSuit = [false, false, false];
    let hasJihai = false;
    for (let i = 0; i < 9; i++) if (counts[i] > 0) hasSuit[0] = true;
    for (let i = 9; i < 18; i++) if (counts[i] > 0) hasSuit[1] = true;
    for (let i = 18; i < 27; i++) if (counts[i] > 0) hasSuit[2] = true;
    for (let i = 27; i < 34; i++) if (counts[i] > 0) hasJihai = true;

    const suitCount = hasSuit.filter(Boolean).length;
    return suitCount === 1 && !hasJihai;
}

// All Honors (honors only)
function isTsuiisou(counts) {
    for (let i = 0; i < 27; i++) {
        if (counts[i] > 0) return false;
    }
    return true;
}

// Mixed Terminals (1, 9, honors only)
function isHonroutou(hand) {
    return hand.every(id => {
        const info = tileIdToInfo(id);
        if (info.isJihai) return true;
        return info.num === 1 || info.num === 9;
    });
}

// Pure Terminals check (only 1s and 9s, no honors)
function isChinroutou(hand) {
    return hand.every(id => {
        const info = tileIdToInfo(id);
        if (info.isJihai) return false;
        return info.num === 1 || info.num === 9;
    });
}

// Little Three Dragons (2 dragon triplets + dragon pair)
function isShousangen(mentsu, head) {
    const sangenKou = mentsu.filter(m => m.type === 'kou' && m.tile >= 31 && m.tile <= 33).length;
    const sangenHead = head >= 31 && head <= 33;
    return sangenKou === 2 && sangenHead;
}

// Big Three Dragons (3 dragon triplets)
function isDaisangen(mentsu) {
    const sangenKou = mentsu.filter(m => m.type === 'kou' && m.tile >= 31 && m.tile <= 33).length;
    return sangenKou === 3;
}

// Pure Double Sequence (2 identical sequences)
function hasIipeiko(mentsu) {
    const shuns = mentsu.filter(m => m.type === 'shun');
    for (let i = 0; i < shuns.length; i++) {
        for (let j = i + 1; j < shuns.length; j++) {
            if (shuns[i].tile === shuns[j].tile) return true;
        }
    }
    return false;
}

// Twice Pure Double Sequence (2 pairs of identical sequences)
function hasRyanpeiko(mentsu) {
    const shuns = mentsu.filter(m => m.type === 'shun');
    if (shuns.length < 4) return false;
    const sorted = shuns.map(s => s.tile).sort((a,b) => a-b);
    return sorted[0] === sorted[1] && sorted[2] === sorted[3];
}

// Straight (same suit 123, 456, 789 sequences)
function isIkkitsukan(mentsu) {
    const shuns = mentsu.filter(m => m.type === 'shun');
    for (let suit = 0; suit < 3; suit++) {
        const base = suit * 9;
        const has123 = shuns.some(s => s.tile === base);
        const has456 = shuns.some(s => s.tile === base + 3);
        const has789 = shuns.some(s => s.tile === base + 6);
        if (has123 && has456 && has789) return true;
    }
    return false;
}

// Mixed Triple Sequence (3 suits, same number sequences)
function isSanshokuDoujun(mentsu) {
    const shuns = mentsu.filter(m => m.type === 'shun');
    for (let num = 0; num <= 6; num++) {
        const hasMan = shuns.some(s => s.tile === num);
        const hasPin = shuns.some(s => s.tile === 9 + num);
        const hasSou = shuns.some(s => s.tile === 18 + num);
        if (hasMan && hasPin && hasSou) return true;
    }
    return false;
}

// Triple Triplets (3 suits, same number triplets)
function isSanshokuDoukou(mentsu) {
    const kous = mentsu.filter(m => m.type === 'kou' && m.tile < 27);
    for (let num = 0; num < 9; num++) {
        const hasMan = kous.some(k => k.tile === num);
        const hasPin = kous.some(k => k.tile === 9 + num);
        const hasSou = kous.some(k => k.tile === 18 + num);
        if (hasMan && hasPin && hasSou) return true;
    }
    return false;
}

// Score calculation (simplified: based on han count)
function calculateScore(han) {
    if (han >= 13) return 32000; // Yakuman
    if (han >= 11) return 24000; // Triple mangan
    if (han >= 8)  return 16000; // Double mangan
    if (han >= 6)  return 12000; // Haneman
    if (han >= 5)  return 8000;  // Mangan
    if (han === 4) return 8000;  // Mangan
    if (han === 3) return 4000;
    if (han === 2) return 2000;
    if (han === 1) return 1000;
    return 0;
}

// ===== Game Class =====
class MahjongFallGame {
    constructor() {
        this.gameArea = document.getElementById('game-area');
        this.timerElement = document.getElementById('timer-value');
        this.handCountElement = document.getElementById('hand-count-value');
        this.handTilesElement = document.getElementById('hand-tiles');

        this.gameRunning = false;
        this.fallingTiles = [];
        this.hand = []; // Selected tile IDs
        this.tilePool = [];
        this.poolIndex = 0;
        this.timeLeft = 60;
        this.timerInterval = null;
        this.spawnInterval = null;
        this.gameSpeed = 1.5;
        this.spawnDelay = 800;
        this.audioContext = null;
        this.mode = 'normal'; // normal, hard, superhard
        this.currentScoreTab = 'normal';

        this.init();
    }

    init() {
        this.initScreenNavigation();
    }

    // Web Audio API
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    getSoundEnabled() {
        const enabled = localStorage.getItem('jantama_soundEnabled');
        return enabled === null ? true : enabled === 'true';
    }

    setSoundEnabled(enabled) {
        localStorage.setItem('jantama_soundEnabled', enabled);
    }

    playSelectSound() {
        if (!this.getSoundEnabled()) return;
        this.initAudio();
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + 0.1);
    }

    playCompleteSound() {
        if (!this.getSoundEnabled()) return;
        this.initAudio();
        const freqs = [523, 659, 784, 1047];
        freqs.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            const t = this.audioContext.currentTime + i * 0.1;
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            osc.start(t);
            osc.stop(t + 0.15);
        });
    }

    playTimeUpSound() {
        if (!this.getSoundEnabled()) return;
        this.initAudio();
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.frequency.value = 200;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + 0.5);
    }

    // Screen navigation
    showScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
    }

    initScreenNavigation() {
        // Title -> Menu
        const titleBtn = document.getElementById('title-start-btn');
        titleBtn.addEventListener('click', () => this.showScreen('main-menu'));
        titleBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('main-menu');
        });

        // Menu buttons
        document.getElementById('start-menu-btn').addEventListener('click', () => {
            this.mode = 'normal';
            this.showScreen('game-screen');
            this.startGame();
        });
        document.getElementById('start-menu-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.mode = 'normal';
            this.showScreen('game-screen');
            this.startGame();
        });

        document.getElementById('start-hard-btn').addEventListener('click', () => {
            this.mode = 'hard';
            this.showScreen('game-screen');
            this.startGame();
        });
        document.getElementById('start-hard-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.mode = 'hard';
            this.showScreen('game-screen');
            this.startGame();
        });

        document.getElementById('start-superhard-btn').addEventListener('click', () => {
            this.mode = 'superhard';
            this.showScreen('game-screen');
            this.startGame();
        });
        document.getElementById('start-superhard-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.mode = 'superhard';
            this.showScreen('game-screen');
            this.startGame();
        });

        document.getElementById('highscore-btn').addEventListener('click', () => {
            this.showScreen('highscore-screen');
            this.displayHighScores();
        });
        document.getElementById('highscore-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('highscore-screen');
            this.displayHighScores();
        });

        // High score tabs
        document.getElementById('normal-tab').addEventListener('click', () => {
            this.switchScoreTab('normal');
        });
        document.getElementById('hard-tab').addEventListener('click', () => {
            this.switchScoreTab('hard');
        });
        document.getElementById('superhard-tab').addEventListener('click', () => {
            this.switchScoreTab('superhard');
        });

        document.getElementById('instructions-btn').addEventListener('click', () => {
            this.showScreen('instructions-screen');
        });
        document.getElementById('instructions-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('instructions-screen');
        });

        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showScreen('settings-screen');
            this.loadSettings();
        });
        document.getElementById('settings-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('settings-screen');
            this.loadSettings();
        });

        // Back buttons
        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            this.stopGame();
            this.showScreen('main-menu');
        });
        document.getElementById('back-to-menu-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopGame();
            this.showScreen('main-menu');
        });

        document.getElementById('back-from-instructions-btn').addEventListener('click', () => {
            this.showScreen('main-menu');
        });
        document.getElementById('back-from-instructions-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('main-menu');
        });

        document.getElementById('back-from-settings-btn').addEventListener('click', () => {
            this.showScreen('main-menu');
        });
        document.getElementById('back-from-settings-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('main-menu');
        });

        document.getElementById('back-from-highscore-btn').addEventListener('click', () => {
            this.showScreen('main-menu');
        });
        document.getElementById('back-from-highscore-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('main-menu');
        });

        // Result screen
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.showScreen('game-screen');
            this.startGame();
        });
        document.getElementById('retry-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('game-screen');
            this.startGame();
        });

        document.getElementById('result-menu-btn').addEventListener('click', () => {
            this.showScreen('main-menu');
        });
        document.getElementById('result-menu-btn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('main-menu');
        });

        // Settings toggle
        document.getElementById('sound-toggle').addEventListener('change', (e) => {
            this.setSoundEnabled(e.target.checked);
        });
    }

    loadSettings() {
        document.getElementById('sound-toggle').checked = this.getSoundEnabled();
    }

    // ===== Game Core =====
    startGame() {
        this.gameRunning = true;
        this.hand = [];
        this.fallingTiles = [];
        this.tilePool = createTilePool();
        this.poolIndex = 0;

        // Set speed by mode
        if (this.mode === 'superhard') {
            this.gameSpeed = 3.5;
            this.spawnDelay = 400;
            this.timeLeft = 30;
        } else if (this.mode === 'hard') {
            this.gameSpeed = 2.5;
            this.spawnDelay = 600;
            this.timeLeft = 45;
        } else {
            this.gameSpeed = 1.5;
            this.spawnDelay = 800;
            this.timeLeft = 60;
        }

        this.gameArea.innerHTML = '';
        this.handTilesElement.innerHTML = '';
        this.updateHandCount();
        this.updateTimer();

        // Start timer
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimer();
            // Time is up
        if (this.timeLeft <= 0) {
                this.timeUp();
            }
        }, 1000);

        // Start spawning tiles
        this.startSpawning();
        this.gameLoop();
    }

    stopGame() {
        this.gameRunning = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
            this.spawnInterval = null;
        }
    }

    startSpawning() {
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        this.spawnInterval = setInterval(() => {
            if (this.gameRunning) {
                this.spawnTile();
            }
        }, this.spawnDelay);
    }

    getNextTileId() {
        if (this.poolIndex >= this.tilePool.length) {
            // Reshuffle when pool is exhausted
            this.tilePool = createTilePool();
            this.poolIndex = 0;
        }
        return this.tilePool[this.poolIndex++];
    }

    spawnTile() {
        const tileId = this.getNextTileId();
        const imgSrc = tileIdToImage(tileId);

        const gameAreaWidth = this.gameArea.offsetWidth;
        // Random X position with margin
        const margin = 30;
        const x = margin + Math.random() * (gameAreaWidth - margin * 2);

        const el = document.createElement('div');
        el.className = 'falling-tile';
        el.style.left = x + 'px';
        el.style.top = '0px';

        // Tile image
        const img = document.createElement('img');
        img.src = imgSrc;
        img.className = 'tile-img';
        img.draggable = false;
        el.appendChild(img);

        // Tap event (prevent duplicate taps)
        let tapped = false;
        const onTap = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (tapped) return;
            if (!this.gameRunning) return;
            if (this.hand.length >= 14) return;
            tapped = true;
            this.selectTile(tileId, el);
        };
        el.addEventListener('click', onTap);
        el.addEventListener('touchend', onTap, { passive: false });

        this.gameArea.appendChild(el);
        this.fallingTiles.push({
            element: el,
            tileId: tileId,
            x: x,
            y: 0,
            selected: false
        });
    }

    selectTile(tileId, element) {
        // Add to hand
        this.hand.push(tileId);
        this.playSelectSound();

        // Selection animation
        element.classList.add('selected');

        // Mark as selected in fallingTiles
        const idx = this.fallingTiles.findIndex(t => t.element === element);
        if (idx >= 0) this.fallingTiles[idx].selected = true;

        // Remove after 0.3s
        setTimeout(() => {
            if (this.gameArea.contains(element)) {
                this.gameArea.removeChild(element);
            }
            const i = this.fallingTiles.findIndex(t => t.element === element);
            if (i >= 0) this.fallingTiles.splice(i, 1);
        }, 300);

        // Update hand display
        this.updateHandDisplay();
        this.updateHandCount();

        // Evaluate when 14 tiles collected
        if (this.hand.length >= 14) {
            this.completeHand();
        }
    }

    gameLoop() {
        if (!this.gameRunning) return;

        // Move tiles downward
        for (let i = this.fallingTiles.length - 1; i >= 0; i--) {
            const tile = this.fallingTiles[i];
            if (tile.selected) continue;
            tile.y += this.gameSpeed;
            tile.element.style.top = tile.y + 'px';

            // Remove tile when it reaches bottom (no penalty)
            if (tile.y > this.gameArea.offsetHeight) {
                if (this.gameArea.contains(tile.element)) {
                    this.gameArea.removeChild(tile.element);
                }
                this.fallingTiles.splice(i, 1);
            }
        }

        requestAnimationFrame(() => this.gameLoop());
    }

    updateTimer() {
        this.timerElement.textContent = this.timeLeft;
        if (this.timeLeft <= 10) {
            this.timerElement.style.color = '#ff6b6b';
        } else {
            this.timerElement.style.color = '';
        }
    }

    updateHandCount() {
        this.handCountElement.textContent = this.hand.length;
    }

    updateHandDisplay() {
        this.handTilesElement.innerHTML = '';
        // Sort and display hand
        const sorted = [...this.hand].sort((a, b) => a - b);
        sorted.forEach(id => {
            const div = document.createElement('div');
            div.className = 'hand-tile';
            const img = document.createElement('img');
            img.src = tileIdToImage(id);
            img.className = 'tile-img';
            img.draggable = false;
            div.appendChild(img);
            this.handTilesElement.appendChild(div);
        });
    }

    completeHand() {
        this.playCompleteSound();
        this.stopGame();

        // Show result after brief delay
        setTimeout(() => {
            this.showResult();
        }, 500);
    }

    timeUp() {
        this.playTimeUpSound();
        this.stopGame();

        // 14枚未満の場合
        if (this.hand.length < 14) {
            this.showResult();
        }
    }

    showResult() {
        this.showScreen('result-screen');

        const resultHand = document.getElementById('result-hand');
        const resultYaku = document.getElementById('result-yaku');
        const resultScore = document.getElementById('result-score');
        const resultTitle = document.getElementById('result-title');

        // 手牌表示
        resultHand.innerHTML = '';
        const sorted = [...this.hand].sort((a, b) => a - b);
        sorted.forEach(id => {
            const div = document.createElement('div');
            div.className = 'result-tile';
            const img = document.createElement('img');
            img.src = tileIdToImage(id);
            img.className = 'tile-img';
            img.draggable = false;
            div.appendChild(img);
            resultHand.appendChild(div);
        });

        // Less than 14 tiles
        if (this.hand.length < 14) {
            resultTitle.textContent = 'Time\'s Up';
            resultTitle.style.color = '#ff6b6b';
            resultYaku.innerHTML = '<div class="no-yaku">Could not collect 14 tiles (' + this.hand.length + ' tiles)</div>';
            resultScore.textContent = '0 pts';
            this.saveHighScore(0, []);
            return;
        }

        // Evaluate yaku
        const result = judgeHand(this.hand);

        if (result.yaku.length === 0) {
            resultTitle.textContent = 'Result';
            resultTitle.style.color = '#00ff88';
            resultYaku.innerHTML = '<div class="no-yaku">No Yaku</div>';
            resultScore.textContent = '0 pts';
            this.saveHighScore(0, []);
        } else {
            resultTitle.textContent = 'Win!';
            resultTitle.style.color = '#ffd700';
            let yakuHtml = '';
            result.yaku.forEach(y => {
                yakuHtml += `<div class="yaku-item"><span class="yaku-name">${y.name}</span><span class="yaku-han">${y.han} han</span></div>`;
            });
            const totalHan = result.yaku.reduce((s, y) => s + y.han, 0);
            yakuHtml += `<div class="yaku-item" style="border-top:2px solid rgba(255,215,0,0.5);margin-top:8px;padding-top:12px;"><span class="yaku-name" style="color:#ffd700;">Total</span><span class="yaku-han" style="color:#ffd700;">${totalHan} han</span></div>`;
            resultYaku.innerHTML = yakuHtml;
            resultScore.textContent = result.score.toLocaleString() + ' pts';
            this.saveHighScore(result.score, result.yaku);
        }
    }

    // High score management
    saveHighScore(score, yaku) {
        const key = `jantama_highscores_${this.mode}`;
        let highscores = JSON.parse(localStorage.getItem(key) || '[]');
        highscores.push({
            score: score,
            yaku: yaku.map(y => y.name).join(', ') || 'None',
            date: new Date().toISOString()
        });
        highscores.sort((a, b) => b.score - a.score);
        highscores = highscores.slice(0, 10);
        localStorage.setItem(key, JSON.stringify(highscores));
    }

    // Switch score tab
    switchScoreTab(tab) {
        this.currentScoreTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tab === 'normal' ? 'normal-tab' : tab === 'hard' ? 'hard-tab' : 'superhard-tab').classList.add('active');
        this.displayHighScores();
    }

    displayHighScores() {
        const list = document.getElementById('highscore-list');
        const key = `jantama_highscores_${this.currentScoreTab}`;
        const scores = JSON.parse(localStorage.getItem(key) || '[]');

        if (scores.length === 0) {
            list.innerHTML = '<p class="no-scores">No scores yet</p>';
            return;
        }

        let html = '<ol class="score-list">';
        scores.forEach((item, index) => {
            html += `
                <li class="score-item">
                    <span class="rank">${index + 1}</span>
                    <span class="score-value">${item.score.toLocaleString()} pts</span>
                    <span class="score-yaku">${item.yaku}</span>
                </li>
            `;
        });
        html += '</ol>';
        list.innerHTML = html;
    }

    // Toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

// Start game
window.addEventListener('DOMContentLoaded', () => {
    new MahjongFallGame();
});

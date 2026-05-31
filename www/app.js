// 雀牌落下 - メインゲームロジック
// 麻雀牌の画像パス定義
const TILE_IMAGES = {
    // 萬子 (1m-9m)
    man: ['manzu/1man.png','manzu/2man.png','manzu/3man.png','manzu/4man.png','manzu/5man.png','manzu/6man.png','manzu/7man.png','manzu/8man.png','manzu/9man.png'],
    // 筒子 (1p-9p)
    pin: ['pinzu/1pin.png','pinzu/2pin.png','pinzu/3pin.png','pinzu/4pin.png','pinzu/5pin.png','pinzu/6pin.png','pinzu/7pin.png','pinzu/8pin.png','pinzu/9pin.png'],
    // 索子 (1s-9s)
    sou: ['so-zu/1so.png','so-zu/2so.png','so-zu/3so.png','so-zu/4so.png','so-zu/5so.png','so-zu/6so.png','so-zu/7so.png','so-zu/8so.png','so-zu/9so.png'],
    // 字牌 (東南西北白發中)
    jihai: ['zihai/ton.png','zihai/nan.png','zihai/sya.png','zihai/pei.png','zihai/haku.png','zihai/hatu.png','zihai/tyun.png']
};

// 牌のID体系: suit(0-3) * 9 + number(0-8), 字牌は suit=3, number=0-6
// man: 0-8, pin: 9-17, sou: 18-26, jihai: 27-33
function tileIdToInfo(id) {
    if (id < 9) return { suit: 'man', num: id + 1, isJihai: false };
    if (id < 18) return { suit: 'pin', num: id - 9 + 1, isJihai: false };
    if (id < 27) return { suit: 'sou', num: id - 18 + 1, isJihai: false };
    return { suit: 'jihai', num: id - 27 + 1, isJihai: true };
}

// 牌IDから画像パスを取得
function tileIdToImage(id) {
    if (id < 9) return TILE_IMAGES.man[id];
    if (id < 18) return TILE_IMAGES.pin[id - 9];
    if (id < 27) return TILE_IMAGES.sou[id - 18];
    return TILE_IMAGES.jihai[id - 27];
}

// 全牌の山を生成（各牌4枚ずつ = 34種 x 4 = 136枚）
function createTilePool() {
    const pool = [];
    for (let id = 0; id < 34; id++) {
        for (let i = 0; i < 4; i++) {
            pool.push(id);
        }
    }
    // シャッフル
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
}

// ===== 役判定ロジック =====

// 手牌を牌IDの配列(14枚)として受け取り、役を判定する
function judgeHand(hand) {
    // handは牌IDの配列(14枚)
    // カウント配列を作成
    const counts = new Array(34).fill(0);
    hand.forEach(id => counts[id]++);

    const results = [];

    // 七対子チェック
    if (isChitoitsu(counts)) {
        results.push({ name: '七対子', han: 2 });
        // 七対子の追加役チェック
        const extra = checkChitoitsuExtra(hand, counts);
        extra.forEach(y => results.push(y));
    }

    // 国士無双チェック
    if (isKokushi(counts)) {
        results.push({ name: '国士無双', han: 13 });
        return { yaku: results, score: calculateScore(13) };
    }

    // 通常形（4面子1雀頭）の分解を試みる
    const decompositions = decompose(counts);

    if (decompositions.length > 0) {
        // 各分解パターンで役を判定し、最高得点を選ぶ
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

    // 七対子の結果があればそれを返す
    if (results.length > 0) {
        const totalHan = results.reduce((sum, y) => sum + y.han, 0);
        return { yaku: results, score: calculateScore(totalHan) };
    }

    // 役なし
    return { yaku: [], score: 0 };
}

// 七対子判定
function isChitoitsu(counts) {
    let pairs = 0;
    for (let i = 0; i < 34; i++) {
        if (counts[i] === 2) pairs++;
        else if (counts[i] !== 0) return false;
    }
    return pairs === 7;
}

// 七対子の追加役
function checkChitoitsuExtra(hand, counts) {
    const extra = [];
    // タンヤオ
    if (isTanyao(hand)) extra.push({ name: 'タンヤオ', han: 1 });
    // 混一色
    if (isHonitsu(counts)) extra.push({ name: '混一色', han: 3 });
    // 清一色
    if (isChinitsu(counts)) extra.push({ name: '清一色', han: 6 });
    // 字一色
    if (isTsuiisou(counts)) extra.push({ name: '字一色', han: 13 });
    return extra;
}

// 国士無双判定
function isKokushi(counts) {
    const kokushiTiles = [0,8,9,17,18,26,27,28,29,30,31,32,33];
    let pairFound = false;
    for (const t of kokushiTiles) {
        if (counts[t] === 0) return false;
        if (counts[t] === 2) pairFound = true;
    }
    return pairFound;
}

// 面子分解（4面子1雀頭）
function decompose(counts) {
    const results = [];
    const c = counts.slice();

    // 雀頭を選ぶ
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

// 面子を抽出（再帰）
function extractMentsu(counts, startIdx, mentsu) {
    if (mentsu.length === 4) {
        // 全て使い切ったか確認
        return counts.every(c => c === 0);
    }

    for (let i = startIdx; i < 34; i++) {
        if (counts[i] === 0) continue;

        // 刻子を試す
        if (counts[i] >= 3) {
            counts[i] -= 3;
            mentsu.push({ type: 'kou', tile: i });
            if (extractMentsu(counts, i, mentsu)) return true;
            mentsu.pop();
            counts[i] += 3;
        }

        // 順子を試す（数牌のみ、8以下）
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

        // この牌で面子が作れなければ失敗
        break;
    }
    return false;
}

// 通常形の役判定
function checkYaku(hand, counts, decomp) {
    const yaku = [];
    const { head, mentsu } = decomp;
    const headInfo = tileIdToInfo(head);
    const shunCount = mentsu.filter(m => m.type === 'shun').length;
    const kouCount = mentsu.filter(m => m.type === 'kou').length;

    // タンヤオ
    if (isTanyao(hand)) yaku.push({ name: 'タンヤオ', han: 1 });

    // 平和（4順子 + 数牌雀頭 + 役牌でない雀頭）
    if (shunCount === 4 && !headInfo.isJihai) {
        yaku.push({ name: '平和', han: 1 });
    }

    // 一盃口（同じ順子が2つ）
    if (hasIipeiko(mentsu)) yaku.push({ name: '一盃口', han: 1 });

    // 二盃口（同じ順子が2組）
    if (hasRyanpeiko(mentsu)) {
        // 一盃口を削除して二盃口に
        const idx = yaku.findIndex(y => y.name === '一盃口');
        if (idx >= 0) yaku.splice(idx, 1);
        yaku.push({ name: '二盃口', han: 3 });
    }

    // 役牌（三元牌: 白發中）
    for (const m of mentsu) {
        if (m.type === 'kou') {
            if (m.tile === 31) yaku.push({ name: '役牌（白）', han: 1 });
            if (m.tile === 32) yaku.push({ name: '役牌（發）', han: 1 });
            if (m.tile === 33) yaku.push({ name: '役牌（中）', han: 1 });
            // 風牌（東）も役牌扱い
            if (m.tile === 27) yaku.push({ name: '役牌（東）', han: 1 });
        }
    }

    // 対々和（4刻子）
    if (kouCount === 4) yaku.push({ name: '対々和', han: 2 });

    // 三暗刻
    if (kouCount === 3) yaku.push({ name: '三暗刻', han: 2 });

    // 混一色
    if (isHonitsu(counts)) yaku.push({ name: '混一色', han: 3 });

    // 清一色
    if (isChinitsu(counts)) yaku.push({ name: '清一色', han: 6 });

    // 混老頭（1,9,字牌のみ）
    if (isHonroutou(hand)) yaku.push({ name: '混老頭', han: 2 });

    // 小三元（三元牌2刻子+三元牌雀頭）
    if (isShousangen(mentsu, head)) yaku.push({ name: '小三元', han: 2 });

    // 大三元（三元牌3刻子）
    if (isDaisangen(mentsu)) yaku.push({ name: '大三元', han: 13 });

    // 字一色
    if (isTsuiisou(counts)) yaku.push({ name: '字一色', han: 13 });

    // 四暗刻
    if (kouCount === 4) yaku.push({ name: '四暗刻', han: 13 });

    // 清老頭（1,9のみ）
    if (isChinroutou(hand)) yaku.push({ name: '清老頭', han: 13 });

    // 一気通貫
    if (isIkkitsukan(mentsu)) yaku.push({ name: '一気通貫', han: 2 });

    // 三色同順
    if (isSanshokuDoujun(mentsu)) yaku.push({ name: '三色同順', han: 2 });

    // 三色同刻
    if (isSanshokuDoukou(mentsu)) yaku.push({ name: '三色同刻', han: 2 });

    return yaku;
}

// タンヤオ（2-8のみ）
function isTanyao(hand) {
    return hand.every(id => {
        const info = tileIdToInfo(id);
        if (info.isJihai) return false;
        return info.num >= 2 && info.num <= 8;
    });
}

// 混一色（1種の数牌+字牌のみ）
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

// 清一色（1種の数牌のみ）
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

// 字一色（字牌のみ）
function isTsuiisou(counts) {
    for (let i = 0; i < 27; i++) {
        if (counts[i] > 0) return false;
    }
    return true;
}

// 混老頭（1,9,字牌のみ）
function isHonroutou(hand) {
    return hand.every(id => {
        const info = tileIdToInfo(id);
        if (info.isJihai) return true;
        return info.num === 1 || info.num === 9;
    });
}

// 清老頭（1,9のみ、字牌なし）
function isChinroutou(hand) {
    return hand.every(id => {
        const info = tileIdToInfo(id);
        if (info.isJihai) return false;
        return info.num === 1 || info.num === 9;
    });
}

// 小三元（三元牌2刻子+三元牌雀頭）
function isShousangen(mentsu, head) {
    const sangenKou = mentsu.filter(m => m.type === 'kou' && m.tile >= 31 && m.tile <= 33).length;
    const sangenHead = head >= 31 && head <= 33;
    return sangenKou === 2 && sangenHead;
}

// 大三元（三元牌3刻子）
function isDaisangen(mentsu) {
    const sangenKou = mentsu.filter(m => m.type === 'kou' && m.tile >= 31 && m.tile <= 33).length;
    return sangenKou === 3;
}

// 一盃口（同じ順子が2つ）
function hasIipeiko(mentsu) {
    const shuns = mentsu.filter(m => m.type === 'shun');
    for (let i = 0; i < shuns.length; i++) {
        for (let j = i + 1; j < shuns.length; j++) {
            if (shuns[i].tile === shuns[j].tile) return true;
        }
    }
    return false;
}

// 二盃口（同じ順子が2組）
function hasRyanpeiko(mentsu) {
    const shuns = mentsu.filter(m => m.type === 'shun');
    if (shuns.length < 4) return false;
    const sorted = shuns.map(s => s.tile).sort((a,b) => a-b);
    return sorted[0] === sorted[1] && sorted[2] === sorted[3];
}

// 一気通貫（同じ色で123,456,789の順子）
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

// 三色同順（3色で同じ数字の順子）
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

// 三色同刻（3色で同じ数字の刻子）
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

// 得点計算（簡易版: 翻数ベース）
function calculateScore(han) {
    if (han >= 13) return 32000; // 役満
    if (han >= 11) return 24000; // 三倍満
    if (han >= 8) return 16000;  // 倍満
    if (han >= 6) return 12000;  // 跳満
    if (han >= 5) return 8000;   // 満貫
    if (han === 4) return 8000;  // 満貫
    if (han === 3) return 4000;
    if (han === 2) return 2000;
    if (han === 1) return 1000;
    return 0;
}

// ===== ゲームクラス =====
class MahjongFallGame {
    constructor() {
        this.gameArea = document.getElementById('game-area');
        this.timerElement = document.getElementById('timer-value');
        this.handCountElement = document.getElementById('hand-count-value');
        this.handTilesElement = document.getElementById('hand-tiles');

        this.gameRunning = false;
        this.fallingTiles = [];
        this.hand = []; // 選択した牌ID
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

    // 画面遷移
    showScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
    }

    initScreenNavigation() {
        // タイトル→メニュー
        const titleBtn = document.getElementById('title-start-btn');
        titleBtn.addEventListener('click', () => this.showScreen('main-menu'));
        titleBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.showScreen('main-menu');
        });

        // メニューボタン
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

        // ハイスコアタブ
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

        // 戻るボタン
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

        // 結果画面
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

        // 設定トグル
        document.getElementById('sound-toggle').addEventListener('change', (e) => {
            this.setSoundEnabled(e.target.checked);
        });
    }

    loadSettings() {
        document.getElementById('sound-toggle').checked = this.getSoundEnabled();
    }

    // ===== ゲーム本体 =====
    startGame() {
        this.gameRunning = true;
        this.hand = [];
        this.fallingTiles = [];
        this.tilePool = createTilePool();
        this.poolIndex = 0;

        // モードに応じて速度設定
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

        // タイマー開始
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimer();
            if (this.timeLeft <= 0) {
                this.timeUp();
            }
        }, 1000);

        // 牌の生成開始
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
            // 山が尽きたら再シャッフル
            this.tilePool = createTilePool();
            this.poolIndex = 0;
        }
        return this.tilePool[this.poolIndex++];
    }

    spawnTile() {
        const tileId = this.getNextTileId();
        const imgSrc = tileIdToImage(tileId);

        const gameAreaWidth = this.gameArea.offsetWidth;
        // ランダムな横位置（端から少し余白を取る）
        const margin = 30;
        const x = margin + Math.random() * (gameAreaWidth - margin * 2);

        const el = document.createElement('div');
        el.className = 'falling-tile';
        el.style.left = x + 'px';
        el.style.top = '0px';

        // 牌画像
        const img = document.createElement('img');
        img.src = imgSrc;
        img.className = 'tile-img';
        img.draggable = false;
        el.appendChild(img);

        // タップイベント（重複防止フラグ）
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
        // 手牌に追加
        this.hand.push(tileId);
        this.playSelectSound();

        // 選択アニメーション
        element.classList.add('selected');

        // 対応するfallingTilesのフラグを立てる
        const idx = this.fallingTiles.findIndex(t => t.element === element);
        if (idx >= 0) this.fallingTiles[idx].selected = true;

        // 0.3秒後に削除
        setTimeout(() => {
            if (this.gameArea.contains(element)) {
                this.gameArea.removeChild(element);
            }
            const i = this.fallingTiles.findIndex(t => t.element === element);
            if (i >= 0) this.fallingTiles.splice(i, 1);
        }, 300);

        // 手牌表示を更新
        this.updateHandDisplay();
        this.updateHandCount();

        // 14枚揃ったら判定
        if (this.hand.length >= 14) {
            this.completeHand();
        }
    }

    gameLoop() {
        if (!this.gameRunning) return;

        // 牌を落下させる
        for (let i = this.fallingTiles.length - 1; i >= 0; i--) {
            const tile = this.fallingTiles[i];
            if (tile.selected) continue;
            tile.y += this.gameSpeed;
            tile.element.style.top = tile.y + 'px';

            // 画面下に到達したら削除（ペナルティなし）
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
        // 手牌をソートして表示
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

        // 少し待ってから結果表示
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

        // 14枚未満の場合
        if (this.hand.length < 14) {
            resultTitle.textContent = '時間切れ';
            resultTitle.style.color = '#ff6b6b';
            resultYaku.innerHTML = '<div class="no-yaku">14枚集められませんでした（' + this.hand.length + '枚）</div>';
            resultScore.textContent = '0点';
            this.saveHighScore(0, []);
            return;
        }

        // 役判定
        const result = judgeHand(this.hand);

        if (result.yaku.length === 0) {
            resultTitle.textContent = '結果発表';
            resultTitle.style.color = '#00ff88';
            resultYaku.innerHTML = '<div class="no-yaku">役なし</div>';
            resultScore.textContent = '0点';
            this.saveHighScore(0, []);
        } else {
            resultTitle.textContent = '和了！';
            resultTitle.style.color = '#ffd700';
            let yakuHtml = '';
            result.yaku.forEach(y => {
                yakuHtml += `<div class="yaku-item"><span class="yaku-name">${y.name}</span><span class="yaku-han">${y.han}翻</span></div>`;
            });
            const totalHan = result.yaku.reduce((s, y) => s + y.han, 0);
            yakuHtml += `<div class="yaku-item" style="border-top:2px solid rgba(255,215,0,0.5);margin-top:8px;padding-top:12px;"><span class="yaku-name" style="color:#ffd700;">合計</span><span class="yaku-han" style="color:#ffd700;">${totalHan}翻</span></div>`;
            resultYaku.innerHTML = yakuHtml;
            resultScore.textContent = result.score.toLocaleString() + '点';
            this.saveHighScore(result.score, result.yaku);
        }
    }

    // ハイスコア管理
    saveHighScore(score, yaku) {
        const key = `jantama_highscores_${this.mode}`;
        let highscores = JSON.parse(localStorage.getItem(key) || '[]');
        highscores.push({
            score: score,
            yaku: yaku.map(y => y.name).join(', ') || 'なし',
            date: new Date().toISOString()
        });
        highscores.sort((a, b) => b.score - a.score);
        highscores = highscores.slice(0, 10);
        localStorage.setItem(key, JSON.stringify(highscores));
    }

    // タブ切り替え
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
            list.innerHTML = '<p class="no-scores">まだスコアがありません</p>';
            return;
        }

        let html = '<ol class="score-list">';
        scores.forEach((item, index) => {
            html += `
                <li class="score-item">
                    <span class="rank">${index + 1}</span>
                    <span class="score-value">${item.score.toLocaleString()}点</span>
                    <span class="score-yaku">${item.yaku}</span>
                </li>
            `;
        });
        html += '</ol>';
        list.innerHTML = html;
    }

    // トースト
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

// ゲーム開始
window.addEventListener('DOMContentLoaded', () => {
    new MahjongFallGame();
});

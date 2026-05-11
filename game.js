const i18n = {
    ko: {
        score_label: "카피바라 가족",
        dps_label: "초당 자동 생산량",
        tab_upgrades: "강화",
        tab_settings: "설정",
        setting_lang: "언어 설정",
        setting_reset: "게임 초기화",
        reset_btn: "초기화",
        evolution_title: "진화 가이드",
        footer_hint: "카피바라를 터치하여 가족을 늘리세요!",
        upgrade_1_name: "바쁜 손가락",
        upgrade_1_desc: "클릭할 때마다 더 많은 카피바라를 데려옵니다.",
        upgrade_2_name: "평화로운 들판",
        upgrade_2_desc: "초당 1마리의 카피바라가 자동으로 합류합니다.",
        upgrade_3_name: "맛있는 귤",
        upgrade_3_desc: "카피바라들이 기분이 좋아져 자동 생산량이 늘어납니다.",
        upgrade_4_name: "카피바라 온천",
        upgrade_4_desc: "힐링되는 온천 덕분에 자동 생산량이 크게 늘어납니다.",
    },
    en: {
        score_label: "Capybaras",
        dps_label: "Auto per sec",
        tab_upgrades: "Upgrades",
        tab_settings: "Settings",
        setting_lang: "Language",
        setting_reset: "Game Reset",
        reset_btn: "Reset",
        evolution_title: "Evolution Guide",
        footer_hint: "Tap the capybara to grow your family!",
        upgrade_1_name: "Busy Fingers",
        upgrade_1_desc: "Bring more capybaras per click.",
        upgrade_2_name: "Peaceful Field",
        upgrade_2_desc: "1 capybara joins every second.",
        upgrade_3_name: "Yummy Yuzu",
        upgrade_3_desc: "Happy capybaras produce more automatically.",
        upgrade_4_name: "Capy Hot Spring",
        upgrade_4_desc: "Relaxing atmosphere boosts auto production rate.",
    }
};

class CapybaraGame {
    constructor() {
        this.state = {
            score: 0,
            clickPower: 1,
            dps: 0,
            lang: 'ko',
            currentSkin: 1,
            unlockedSkins: [1],
            upgrades: {
                click: { level: 0, basePrice: 15, baseValue: 0.5, icon: '👆' },
                auto1: { level: 0, basePrice: 100, baseValue: 1, icon: '🌾' },
                auto2: { level: 0, basePrice: 1100, baseValue: 8, icon: '🍋' },
                auto3: { level: 0, basePrice: 12000, baseValue: 47, icon: '♨️' }
            }
        };

        this.skins = [
            { id: 1, name: "Normal", milestone: 0, src: "assets/capy-1.png" },
            { id: 2, name: "Evolved", milestone: 15000, src: "assets/capy-2.png" },
            { id: 3, name: "Ultimate", milestone: 100000, src: "assets/capy-3.png" },
            { id: 4, name: "Supreme", milestone: 1000000, src: "assets/capy-4.png" }
        ];

        this.bgm = new Audio('assets/capy-bgm.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.25;
        this.isBgmPlaying = false;

        // Pre-allocated SFX pool to prevent rapid-tap memory spikes
        this.sfxPool = Array.from({ length: 5 }, () => {
            const a = new Audio('assets/capy-po.mp3');
            a.volume = 0.8;
            return a;
        });
        this.sfxPoolIndex = 0;

        this.init();
    }

    init() {
        this.loadGame();
        this.bindEvents();
        this.renderShop();
        this.renderEvolutionGuide();
        this.updateUI();
        this.startAutoProduce();
        this.applyLanguage();
        this.checkSkins();
        this.startPeriodicTasks(); // Decouple UI/save from tap events for smooth rapid touch
    }

    bindEvents() {
        const clickArea = document.getElementById('capybara-wrapper');
        const img = document.getElementById('capybara-main');

        // touchstart: instant response, preventDefault blocks double-tap zoom
        clickArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            img.classList.add('tapped');
            // Handle all simultaneous touch points for multi-finger rapid tap
            for (let i = 0; i < e.changedTouches.length; i++) {
                this.handleClick(e.changedTouches[i]);
            }
        }, { passive: false });

        clickArea.addEventListener('touchend', () => {
            img.classList.remove('tapped');
        }, { passive: true });

        // Desktop click fallback
        clickArea.addEventListener('click', (e) => {
            if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
            this.handleClick(e);
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Resume BGM when returning from background (iOS suspend)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isBgmPlaying && this.bgm.paused) {
                this.bgm.play().catch(() => {});
            }
        });
    }

    handleClick(e) {
        if (!this.isBgmPlaying) {
            this.bgm.play().catch(() => {});
            this.isBgmPlaying = true;
            this.startBgmWatchdog();
        }

        // SFX pool round-robin
        const sfx = this.sfxPool[this.sfxPoolIndex];
        this.sfxPoolIndex = (this.sfxPoolIndex + 1) % this.sfxPool.length;
        sfx.currentTime = 0;
        sfx.play().catch(() => {});

        // Score only — UI/save are handled by periodic tasks (no main thread block)
        this.state.score += this.state.clickPower;

        // Throttle floating text: max 1 per 80ms to avoid DOM flooding
        const now = Date.now();
        if (!this._lastFloatTime || now - this._lastFloatTime >= 80) {
            this._lastFloatTime = now;
            this.createFloatingText(e.clientX, e.clientY, `+${this.formatNumber(this.state.clickPower)}`);
        }
    }

    startBgmWatchdog() {
        // Mobile browsers sometimes silently stop looping audio — restart if detected
        if (this._bgmWatchdog) return;
        this._bgmWatchdog = setInterval(() => {
            if (!this.isBgmPlaying) return;
            if (this.bgm.paused || this.bgm.ended) {
                this.bgm.play().catch(() => {});
            }
        }, 3000);
    }

    createFloatingText(x, y, text) {
        const div = document.createElement('div');
        div.className = 'floating-text';
        div.style.left = `${x}px`;
        div.style.top = `${y}px`;
        div.innerText = text;
        document.body.appendChild(div);

        setTimeout(() => div.remove(), 800);
    }

    formatNumber(num) {
        return Math.floor(num).toLocaleString();
    }

    getPrice(type) {
        const upgrade = this.state.upgrades[type];
        return Math.floor(upgrade.basePrice * Math.pow(1.15, upgrade.level));
    }

    buyUpgrade(type) {
        const price = this.getPrice(type);
        const upgrade = this.state.upgrades[type];

        if (this.state.score >= price) {
            this.state.score -= price;
            upgrade.level++;
            
            if (type === 'click') {
                this.state.clickPower += upgrade.baseValue;
            } else {
                this.calculateDPS();
            }

            this.updateUI();
            this.saveGame();
        }
    }

    calculateDPS() {
        let total = 0;
        for (let key in this.state.upgrades) {
            if (key !== 'click') {
                total += this.state.upgrades[key].level * this.state.upgrades[key].baseValue;
            }
        }
        this.state.dps = total;
    }

    checkSkins() {
        this.skins.forEach(skin => {
            if (this.state.score >= skin.milestone && !this.state.unlockedSkins.includes(skin.id)) {
                this.state.unlockedSkins.push(skin.id);
                this.state.currentSkin = skin.id;
                this.showEvolutionMessage(skin.name);
            }
        });
        
        const currentSkinData = this.skins.find(s => s.id === this.state.currentSkin);
        if (currentSkinData) {
            document.getElementById('capybara-main').src = currentSkinData.src;
        }
    }

    showEvolutionMessage(skinName) {
        const msg = document.createElement('div');
        msg.className = 'evolution-toast';
        msg.innerText = this.state.lang === 'ko' ? `진화 완료: ${skinName}!` : `Evolved: ${skinName}!`;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    updateUI() {
        document.getElementById('score').innerText = this.formatNumber(this.state.score);
        document.getElementById('dps').innerText = this.formatNumber(this.state.dps);
        this.updateShopStatus();
        this.updateEvolutionGuideStatus();
    }

    renderShop() {
        const shopList = document.getElementById('shop-list');
        shopList.innerHTML = '';

        const upgradeKeys = [
            { id: 'click', i18n: 'upgrade_1' },
            { id: 'auto1', i18n: 'upgrade_2' },
            { id: 'auto2', i18n: 'upgrade_3' },
            { id: 'auto3', i18n: 'upgrade_4' }
        ];

        upgradeKeys.forEach(item => {
            const up = this.state.upgrades[item.id];
            
            const div = document.createElement('div');
            div.className = `upgrade-item`;
            div.id = `up-item-${item.id}`;
            div.onclick = () => this.buyUpgrade(item.id);
            
            div.innerHTML = `
                <div class="upgrade-icon">${up.icon}</div>
                <div class="upgrade-info">
                    <div class="upgrade-name">${i18n[this.state.lang][item.i18n + '_name']}</div>
                    <div class="upgrade-desc">${i18n[this.state.lang][item.i18n + '_desc']}</div>
                </div>
                <div class="upgrade-cost">
                    <div class="cost-value" id="up-cost-${item.id}"></div>
                    <div class="upgrade-level" id="up-lvl-${item.id}"></div>
                </div>
            `;
            shopList.appendChild(div);
        });
    }

    updateShopStatus() {
        const upgradeKeys = ['click', 'auto1', 'auto2', 'auto3'];
        upgradeKeys.forEach(id => {
            const up = this.state.upgrades[id];
            const price = this.getPrice(id);
            const canBuy = this.state.score >= price;
            
            const itemEl = document.getElementById(`up-item-${id}`);
            if (itemEl) {
                if (canBuy) itemEl.classList.remove('locked');
                else itemEl.classList.add('locked');
            }
            
            const costEl = document.getElementById(`up-cost-${id}`);
            if (costEl) costEl.innerText = `🐾 ${this.formatNumber(price)}`;
            
            const lvlEl = document.getElementById(`up-lvl-${id}`);
            if (lvlEl) lvlEl.innerText = `Lv. ${up.level}`;
        });
    }

    renderEvolutionGuide() {
        const guideContainer = document.getElementById('evolution-guide');
        if (!guideContainer) return;
        guideContainer.innerHTML = '';

        this.skins.forEach(skin => {
            const isUnlocked = this.state.score >= skin.milestone;

            const div = document.createElement('div');
            div.className = `skin-item ${!isUnlocked ? 'skin-locked' : 'skin-active'}`;
            div.id = `guide-item-${skin.id}`;

            div.innerHTML = `
                <img src="${skin.src}" class="skin-preview">
                <div class="skin-name">${skin.name}</div>
                <div class="upgrade-level">🐾 ${this.formatNumber(skin.milestone)}</div>
            `;
            guideContainer.appendChild(div);
        });
    }

    updateEvolutionGuideStatus() {
        this.skins.forEach(skin => {
            const isUnlocked = this.state.score >= skin.milestone;
            const el = document.getElementById(`guide-item-${skin.id}`);
            if (el) {
                el.className = `skin-item ${!isUnlocked ? 'skin-locked' : 'skin-active'}`;
            }
        });
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(`${tabId}-tab`).classList.remove('hidden');
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    }

    toggleLanguage(lng) {
        this.state.lang = lng;
        this.applyLanguage();
        this.renderShop();
        this.renderEvolutionGuide();
        this.updateUI();
        this.saveGame();
    }

    applyLanguage() {
        const texts = i18n[this.state.lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (texts[key]) el.innerText = texts[key];
        });

        // Toggle active class in settings
        document.getElementById('lang-ko').className = this.state.lang === 'ko' ? 'active' : '';
        document.getElementById('lang-en').className = this.state.lang === 'en' ? 'active' : '';
    }

    startAutoProduce() {
        setInterval(() => {
            if (this.state.dps > 0) {
                this.state.score += (this.state.dps / 10);
            }
        }, 100);
    }

    // UI refresh and save run on their own timers — completely decoupled from tap events
    startPeriodicTasks() {
        // UI update: 100ms feels instant to the user, but doesn't block rapid taps
        setInterval(() => {
            this.updateUI();
            this.checkSkins();
        }, 100);

        // Autosave every 3 seconds — localStorage writes are expensive
        setInterval(() => {
            this.saveGame();
        }, 3000);
    }



    saveGame() {
        localStorage.setItem('capybara_save', JSON.stringify(this.state));
    }

    loadGame() {
        const saved = localStorage.getItem('capybara_save');
        if (saved) {
            this.state = JSON.parse(saved);
            this.calculateDPS();
        }
    }

    resetGame() {
        if (confirm(this.state.lang === 'ko' ? "정말 초기화하시겠습니까?" : "Are you sure you want to reset?")) {
            localStorage.removeItem('capybara_save');
            location.reload();
        }
    }
}

const game = new CapybaraGame();
window.game = game; // Expose for HTML buttons

class SlackHuddleVoiceDetector {
  constructor() {
    this.isInHuddle = false;
    this.participantStates = new Map();
    this.lastNotification = 0;
    this.notificationCooldown = 3000;
    this.settings = {
      enabled: true,
      soundEnabled: true,
      showParticipantName: true,
    };

    this.debugCounter = 0;
    this.lastDebugTime = 0;

    this.init();
  }

  async init() {
    console.log("🚀 SlackHuddleVoiceDetector: 初期化開始...");

    await this.loadSettings();
    console.log("⚙️ 設定読み込み完了:", this.settings);

    this.observeHuddleChanges();
    console.log("👁️ DOM監視開始");

    setInterval(() => {
      this.periodicDebugInfo();
    }, 10000);

    console.log("✅ Slack Huddle Voice Detector: 初期化完了");
  }

  periodicDebugInfo() {
    console.log(`📊 [${new Date().toLocaleTimeString()}] デバッグ情報:`, {
      isInHuddle: this.isInHuddle,
      participantCount: this.participantStates.size,
      settingsEnabled: this.settings.enabled,
      lastNotification: this.lastNotification
        ? new Date(this.lastNotification).toLocaleTimeString()
        : "なし",
      pageURL: window.location.href,
      documentTitle: document.title,
    });

    const huddleElements = document.querySelectorAll(
      '[data-qa*="huddle"], [class*="huddle"]'
    );
    console.log(`🔍 ハドル関連要素: ${huddleElements.length}個`);

    // if (huddleElements.length > 0) {
    //   Array.from(huddleElements).forEach((el, index) => {
    //     console.log(
    //       `  ${index}: ${el.tagName} class="${el.className}" data-qa="${el.dataset.qa}"`
    //     );
    //   });
    // }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(["huddleSettings"]);
      if (result.huddleSettings) {
        this.settings = { ...this.settings, ...result.huddleSettings };
        console.log("📁 設定を読み込みました:", result.huddleSettings);
      } else {
        console.log("📁 デフォルト設定を使用します");
      }
    } catch (error) {
      console.error("❌ 設定の読み込みに失敗:", error);
    }
  }

  observeHuddleChanges() {
    console.log("👀 MutationObserver開始");
    // DOM変更監視: MutationObserverでリアルタイムにDOM変更を検知
    const observer = new MutationObserver((mutations) => {
      this.debugCounter++;
      const now = Date.now();

      if (now - this.lastDebugTime > 5000) {
        console.log(`🔄 DOM変更検知 (過去5秒で${this.debugCounter}回)`);
        this.lastDebugTime = now;
        this.debugCounter = 0;
      }

      // DOM変更が発生するたびにこのコールバックが実行される
      this.checkHuddleStatus();
      if (this.isInHuddle) {
        this.monitorVoiceActivity();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-qa", "aria-label"],
    });

    console.log("🔍 初回ハドルステータスチェック");
    this.checkHuddleStatus();
  }

  checkHuddleStatus() {
    const huddleSelectors = [
      '[data-qa*="huddle"]',
      ".c-huddle_sidebar",
      ".c-huddle-sidebar",
    ];

    let huddleWindow = null;
    let matchedSelector = "";

    for (const selector of huddleSelectors) {
      huddleWindow = document.querySelector(selector);
      if (huddleWindow) {
        matchedSelector = selector;
        break;
      }
    }

    const wasInHuddle = this.isInHuddle;
    this.isInHuddle = !!huddleWindow;

    if (wasInHuddle !== this.isInHuddle) {
      if (this.isInHuddle) {
        console.log("🎉 ハドルに参加しました!", {
          selector: matchedSelector,
          element: huddleWindow,
          className: huddleWindow?.className,
          dataQa: huddleWindow?.dataset?.qa,
        });
        this.participantStates.clear();

        setTimeout(() => {
          this.debugHuddleStructure();
        }, 1000);
      } else {
        console.log("👋 ハドルから退出しました");
        this.participantStates.clear();
      }
    }
  }

  debugHuddleStructure() {
    console.log("🏗️ ハドル構造をデバッグ中...");

    const huddleContainer =
      document.querySelector('[data-qa*="huddle"]') ||
      document.querySelector('[class*="huddle"]');

    if (huddleContainer) {
      console.log("📦 ハドルコンテナ:", huddleContainer);

      const possibleParticipants = huddleContainer.querySelectorAll("*");
      const participantElements = Array.from(possibleParticipants).filter(
        (el) => {
          const className = this.getElementClassName(el);
          return (
            className.includes("participant") ||
            className.includes("peer") ||
            className.includes("avatar") ||
            el.dataset.qa?.includes("participant") ||
            el.dataset.qa?.includes("peer")
          );
        }
      );

      console.log(`👥 参加者らしき要素: ${participantElements.length}個`);
      participantElements.forEach((el, index) => {
        console.log(
          `  ${index}: ${el.tagName} class="${this.getElementClassName(
            el
          ).slice(0, 100)}" data-qa="${el.dataset.qa}"`
        );
      });

      const micElements = huddleContainer.querySelectorAll(
        '[class*="mic"], [data-qa*="mic"]'
      );
      console.log(`🎤 マイク関連要素: ${micElements.length}個`);
      micElements.forEach((el, index) => {
        console.log(
          `  ${index}: ${el.tagName} class="${this.getElementClassName(
            el
          ).slice(0, 100)}" data-qa="${el.dataset.qa}"`
        );
      });
    }
  }

  monitorVoiceActivity() {
    if (!this.settings.enabled) {
      console.log("⏸️ 音声監視は無効化されています");
      return;
    }

    // aria-labelベースの新しい音声検知アプローチ
    this.monitorVoiceActivityFromAriaLabel();
  }

  // 新しいアプローチ：aria-labelから音声状態を監視
  monitorVoiceActivityFromAriaLabel() {
    console.log("🎯 aria-labelベースの音声監視を開始...");

    const participantContainers = document.querySelectorAll(
      ".p-peer_tile__container"
    );
    console.log(
      `👥 発見された参加者コンテナ: ${participantContainers.length}個`
    );

    participantContainers.forEach((container, index) => {
      const ariaLabel = container.getAttribute("aria-label");
      if (!ariaLabel) {
        console.log(`❌ 参加者${index}: aria-labelが見つかりません`);
        return;
      }

      console.log(`🔍 参加者${index} aria-label: "${ariaLabel}"`);

      const isCurrentlyActive = this.isAudioOnFromAriaLabel(ariaLabel);
      const participantId = this.getParticipantIdFromContainer(
        container,
        index
      );
      const wasActive = this.participantStates.get(participantId) || false;

      console.log(`📊 参加者${index} (${participantId}) 状態:`, {
        isCurrentlyActive,
        wasActive,
        willTrigger: isCurrentlyActive && !wasActive,
        ariaLabel: ariaLabel.slice(0, 100),
      });

      if (isCurrentlyActive && !wasActive) {
        const participantName =
          this.extractParticipantNameFromAriaLabel(ariaLabel);
        console.log(`🎤 aria-labelベース音声検知成功: ${participantName}`);
        this.handleVoiceStart(participantName);
      }

      this.participantStates.set(participantId, isCurrentlyActive);
    });
  }

  // aria-labelから音声がオンかどうかを判定
  isAudioOnFromAriaLabel(ariaLabel) {
    // 日本語パターン: "音声はオン"
    // 英語パターン: "audio is on"
    const audioOnPatterns = [/音声はオン/, /audio is on/i];

    const hasAudioOn = audioOnPatterns.some((pattern) =>
      pattern.test(ariaLabel)
    );
    console.log(`🔬 音声状態判定: ${hasAudioOn ? "オン" : "オフ"}`);

    return hasAudioOn;
  }

  // aria-labelから参加者名を抽出
  extractParticipantNameFromAriaLabel(ariaLabel) {
    // 日本語パターン: "natsmy.1211さん、ビデオはオフ、音声はオン、ステータスは "
    const japaneseMatch = ariaLabel.match(/^([^さ]+)さん、/);
    if (japaneseMatch) {
      return japaneseMatch[1];
    }

    // 英語パターン: "堀菜摘, video is off, audio is on, status is "
    const englishMatch = ariaLabel.match(/^([^,]+),/);
    if (englishMatch) {
      return englishMatch[1];
    }

    console.log(
      `❌ aria-labelから参加者名を抽出できませんでした: "${ariaLabel}"`
    );
    return "参加者";
  }

  // 参加者コンテナからIDを取得
  getParticipantIdFromContainer(container, index) {
    return (
      container.id ||
      container.dataset.memberId ||
      container.dataset.userId ||
      `peer_container_${index}`
    );
  }

  // SlackHuddleVoiceDetectorクラス内のisMicIconActive関数を修正
  isMicIconActive(micIcon) {
    const className = this.getElementClassName(micIcon);
    const dataQa = micIcon.dataset.qa || "";

    console.log(`🔬 micIcon判定:`, {
      className: className,
      dataQa: dataQa,
    });

    // 1. data-qaでミュート状態を最優先でチェック
    // `huddle_mic_icon_mute`が存在する場合は確実に非アクティブ
    if (dataQa === "huddle_mic_icon_mute") {
      console.log("  → data-qaがhuddle_mic_icon_muteのため非アクティブ");
      return false;
    }

    // 2. data-qaでアクティブ状態をチェック
    // `huddle_mic_icon_active`や`speaking`など、話していることを示すデータ属性をチェック
    if (dataQa.includes("active") || dataQa.includes("speaking")) {
      console.log("  → data-qaにactive/speaking検出");
      return true;
    }

    // 3. クラス名でアクティブ状態をチェック
    // スクリーンショットの構造から、ランダムな文字列の後に「speaking」のような
    // キーワードが付加される可能性を考慮
    const classList = micIcon.classList;
    const hasActiveClasses = Array.from(classList).some(
      (c) =>
        c.includes("active_speaker") ||
        c.includes("speaking") ||
        c.includes("active")
    );

    if (hasActiveClasses) {
      console.log("  → クラス名にactive/speaking検出");
      return true;
    }

    // 4. SVGの子要素の状態をチェック
    // マイクアイコンがSVG要素の場合、その中の要素の色やクラスが変わる可能性
    const svgPath = micIcon.querySelector("path");
    if (
      svgPath &&
      svgPath.style.fill &&
      svgPath.style.fill !== "rgb(255, 255, 255)"
    ) {
      // 例：話しているときに色が変化する場合
      console.log("  → SVG要素の色変化を検出");
      return true;
    }

    // 上記のいずれにも該当しない場合は非アクティブと判断
    console.log("  → 非アクティブ状態");
    return false;
  }

  // micIconのIDを取得
  getMicIconId(micIcon, index) {
    return (
      micIcon.id ||
      micIcon.dataset.qa ||
      micIcon.dataset.memberId ||
      `mic_${index}`
    );
  }

  // micIconから参加者名を取得
  getParticipantNameFromMicIcon(micIcon, index) {
    // micIconの親要素や兄弟要素から参加者名を探す
    let current = micIcon.parentElement;
    let depth = 0;

    while (current && depth < 5) {
      // aria-labelや title から名前を取得
      if (current.getAttribute("aria-label")) {
        const ariaLabel = current.getAttribute("aria-label");
        if (
          ariaLabel &&
          !ariaLabel.includes("mic") &&
          !ariaLabel.includes("mute")
        ) {
          console.log(`👤 参加者名取得(aria-label): "${ariaLabel}"`);
          return ariaLabel;
        }
      }

      if (current.title && !current.title.includes("mic")) {
        console.log(`👤 参加者名取得(title): "${current.title}"`);
        return current.title;
      }

      // テキストコンテンツから名前を探す
      const textElements = current.querySelectorAll("span, div");
      for (const textEl of textElements) {
        const text = textEl.textContent?.trim();
        if (
          text &&
          text.length > 0 &&
          text.length < 50 &&
          !text.includes("mic") &&
          !text.includes("mute") &&
          !text.match(/^\d+$/)
        ) {
          console.log(`👤 参加者名取得(textContent): "${text}"`);
          return text;
        }
      }

      current = current.parentElement;
      depth++;
    }

    console.log(`❌ 参加者名取得失敗。デフォルト名を使用: mic${index}`);
    return `参加者${index + 1}`;
  }

  checkParticipantVoiceActivity(participant, index) {
    console.log(`🔍 参加者${index}の音声アクティビティをチェック...`);

    const voiceIndicatorSelectors = [
      '[class*="micIcon"][class*="active_speaker"]',
      ".p-peer_title__avatar_mic_icon--active_speaker",
      '[data-qa="huddle_mic_icon_mute"][class*="active_speaker"]',
      '[class*="micIconContainer"][class*="active"]',
      '[class*="micIcon"]:not([class*="mute"])',
      '[class*="mic_icon"]:not([class*="mute"])',
      '[data-qa*="mic"]:not([data-qa*="mute"])',
      ".c-presence--active",
      '[data-qa*="voice_activity"]',
      ".voice-activity",
      ".audio-activity",
      ".c-presence--speaking",
      ".is-speaking",
    ];

    let activeIndicator = null;
    let detectionMethod = "";

    console.log(
      `🔎 ${voiceIndicatorSelectors.length}個のセレクターでチェック中...`
    );

    for (let i = 0; i < voiceIndicatorSelectors.length; i++) {
      const selector = voiceIndicatorSelectors[i];
      const indicator = participant.querySelector(selector);

      //   console.log(
      //     `  ${i}: "${selector}" → ${indicator ? "FOUND" : "NOT FOUND"}`
      //   );

      if (indicator) {
        const isActive = this.isIndicatorActive(indicator, selector);
        console.log(`    要素はアクティブ: ${isActive}`, {
          className: indicator.className,
          dataQa: indicator.dataset.qa,
          display: getComputedStyle(indicator).display,
          visibility: getComputedStyle(indicator).visibility,
        });

        if (isActive) {
          activeIndicator = indicator;
          detectionMethod = selector;
          console.log(`✅ アクティブインジケーター発見: "${selector}"`);
          break;
        }
      }
    }

    const participantId = this.getParticipantId(participant, index);
    const isCurrentlySpeaking = !!activeIndicator;
    const wasPreviouslySpeaking =
      this.participantStates.get(participantId) || false;

    console.log(`📊 参加者${index} (${participantId}) 状態:`, {
      isCurrentlySpeaking,
      wasPreviouslySpeaking,
      willTrigger: isCurrentlySpeaking && !wasPreviouslySpeaking,
    });

    if (isCurrentlySpeaking && !wasPreviouslySpeaking) {
      const participantName = this.getParticipantName(participant);
      console.log(
        `🎤 音声検知成功: ${participantName} (検知方法: ${detectionMethod})`
      );
      this.handleVoiceStart(participantName);
    }

    this.participantStates.set(participantId, isCurrentlySpeaking);
  }

  isIndicatorActive(indicator, selector) {
    console.log(`🔬 インジケーターアクティブ判定: "${selector}"`);

    const className = this.getElementClassName(indicator);

    if (selector.includes("micIcon") || selector.includes("mic_icon")) {
      console.log("  → micIcon系として判定");

      const hasActiveSpeaker =
        indicator.classList.contains(
          "p-peer_title__avatar_mic_icon--active_speaker"
        ) || className.includes("active_speaker");
      console.log(`    active_speaker クラス: ${hasActiveSpeaker}`);

      if (hasActiveSpeaker) {
        return true;
      }

      const hasMute =
        indicator.classList.contains("mute") ||
        className.includes("mute") ||
        indicator.getAttribute("data-qa") === "huddle_mic_icon_mute";
      console.log(`    mute状態: ${hasMute}`);

      if (!hasMute) {
        const style = getComputedStyle(indicator);
        const isVisible =
          style.display !== "none" && style.visibility !== "hidden";
        console.log(
          `    表示状態: ${isVisible} (display: ${style.display}, visibility: ${style.visibility})`
        );
        return isVisible;
      }
    }

    console.log("  → 従来ロジックで判定");
    const hasActiveClass =
      indicator.classList.contains("active") ||
      indicator.classList.contains("speaking") ||
      indicator.classList.contains("c-presence--active");

    const isVisible = getComputedStyle(indicator).display !== "none";
    const notMuted = !indicator.classList.contains("mute");

    console.log(
      `    activeクラス: ${hasActiveClass}, 表示: ${isVisible}, 非ミュート: ${notMuted}`
    );

    return hasActiveClass || (isVisible && notMuted);
  }

  debugParticipantMicState(participant, index) {
    const micElements = participant.querySelectorAll(
      '[class*="micIcon"], [class*="mic_icon"], [data-qa*="mic"]'
    );

    if (micElements.length > 0) {
      console.log(`🎤 参加者${index} のマイク要素 (${micElements.length}個):`, {
        participantClasses: this.getElementClassName(participant).slice(0, 100),
        micElements: Array.from(micElements).map((el) => ({
          tagName: el.tagName,
          className: this.getElementClassName(el).slice(0, 100),
          dataQa: el.dataset.qa,
          isVisible: getComputedStyle(el).display !== "none",
          textContent: el.textContent?.slice(0, 20),
        })),
      });
    } else {
      console.log(`❌ 参加者${index} にマイク要素が見つかりません`);
    }
  }

  debugAllMicIcons() {
    const allMicIcons = document.querySelectorAll(
      '[class*="micIcon"], [class*="mic_icon"], [data-qa*="mic"]'
    );

    console.log(`🔍 ページ内の全micIcon要素 (${allMicIcons.length}個):`);

    if (allMicIcons.length > 0) {
      Array.from(allMicIcons).forEach((el, index) => {
        console.log(`  ${index}:`, {
          tagName: el.tagName,
          className: this.getElementClassName(el).slice(0, 100),
          dataQa: el.dataset.qa,
          textContent: el.textContent?.slice(0, 20),
          parentClass: this.getElementClassName(el.parentElement).slice(0, 50),
          isVisible: getComputedStyle(el).display !== "none",
        });
      });
    } else {
      console.log("❌ ページ内にmicIcon要素が見つかりません");
    }
  }

  // 要素のクラス名を安全に取得するヘルパー関数
  getElementClassName(element) {
    if (!element) return "";

    // className が文字列の場合
    if (typeof element.className === "string") {
      return element.className;
    }

    // SVG要素などでclassNameがSVGAnimatedStringの場合
    if (element.className && typeof element.className.baseVal === "string") {
      return element.className.baseVal;
    }

    // classList から文字列を構築
    if (element.classList && element.classList.length > 0) {
      return Array.from(element.classList).join(" ");
    }

    // class属性から直接取得
    return element.getAttribute("class") || "";
  }

  getParticipantId(participant, index) {
    const id =
      participant.dataset.memberId ||
      participant.dataset.userId ||
      participant.dataset.qa ||
      participant.id ||
      `participant_${index}`;
    console.log(`🆔 参加者${index} ID: "${id}"`);
    return id;
  }

  getParticipantName(participant) {
    const nameSelectors = [
      ".c-huddle-sidebar__participant__name",
      ".c-huddle__participant__name",
      ".p-huddle_sidebar__participant__name",
      '[data-qa*="participant_name"]',
      ".participant-name",
    ];

    for (const selector of nameSelectors) {
      const nameElement = participant.querySelector(selector);
      if (nameElement && nameElement.textContent.trim()) {
        const name = nameElement.textContent.trim();
        console.log(`👤 参加者名取得成功: "${name}" (セレクター: ${selector})`);
        return name;
      }
    }

    const imgElement = participant.querySelector("img[alt]");
    if (imgElement && imgElement.alt) {
      console.log(`👤 参加者名取得(alt属性): "${imgElement.alt}"`);
      return imgElement.alt;
    }

    console.log("❌ 参加者名を取得できません。デフォルト名を使用");
    return "参加者";
  }

  handleVoiceStart(participantName) {
    const now = Date.now();

    console.log(`🚨 音声開始ハンドラー呼び出し: ${participantName}`);

    if (now - this.lastNotification < this.notificationCooldown) {
      console.log(
        `⏰ クールダウン中 (残り${
          this.notificationCooldown - (now - this.lastNotification)
        }ms)`
      );
      return;
    }

    this.lastNotification = now;

    const messageData = {
      type: "voice_activity_detected",
      data: {
        participantName: this.settings.showParticipantName
          ? participantName
          : "誰か",
        timestamp: now,
        soundEnabled: this.settings.soundEnabled,
        tabActive: document.hasFocus(),
      },
    };

    console.log("📤 背景スクリプトにメッセージを送信:", messageData);

    // Chrome Extension APIで背景スクリプトにメッセージ送信
    chrome.runtime
      .sendMessage(messageData)
      .then(() => {
        console.log("✅ メッセージ送信成功");
      })
      .catch((error) => {
        console.error("❌ メッセージ送信失敗:", error);
      });

    console.log(
      `🎉 音声検知完了: ${participantName} が話し始めました (タブアクティブ: ${document.hasFocus()})`
    );
  }
}

// 初期化
console.log("🌐 content-script.js 読み込み開始");

if (document.readyState === "loading") {
  console.log("📖 ドキュメント読み込み中...");
  document.addEventListener("DOMContentLoaded", () => {
    console.log("📋 DOMContentLoaded イベント発生");
    new SlackHuddleVoiceDetector();
  });
} else {
  console.log("📄 ドキュメント読み込み済み、すぐに初期化");
  new SlackHuddleVoiceDetector();
}

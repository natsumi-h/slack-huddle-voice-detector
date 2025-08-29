class SlackHuddleVoiceDetector {
  constructor() {
    this.isInHuddle = false;
    this.participantStates = new Map();
    this.lastNotification = 0;
    this.notificationCooldown = 3000;

    this.debugCounter = 0;
    this.lastDebugTime = 0;

    this.init();
  }

  // #1
  async init() {
    // #2
    this.observeHuddleChanges();
  }

  // #3
  observeHuddleChanges() {
    // DOM変更監視: MutationObserverでリアルタイムにDOM変更を検知
    const observer = new MutationObserver(() => {
      // DOM変更が発生するたびにこのコールバックが実行される
      this.checkHuddleStatus();
      if (this.isInHuddle) {
        this.monitorVoiceActivityFromAriaLabel();
      }
    });

    // #4
    // DOMツリーの変化を非同期にバッチ（まとめて）通知する仕組み
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-qa", "aria-label"],
    });

    console.log("🔍 初回ハドルステータスチェック");
    this.checkHuddleStatus();
  }

  // #5
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
      } else {
        console.log("👋 ハドルから退出しました");
        this.participantStates.clear();
      }
    }
  }

  // aria-labelから音声状態を監視
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
        participantName: participantName || "誰か",
        timestamp: now,
        soundEnabled: true,
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

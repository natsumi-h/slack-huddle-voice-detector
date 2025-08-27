// 通知の管理とバックグラウンド処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "voice_activity_detected") {
    handleVoiceNotification(message.data);
  }
});

async function handleVoiceNotification(data) {
  try {
    // macOS通知センターに表示するChrome通知
    const notificationOptions = {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Slack ハドル 🎤",
      message: `${data.participantName}が話し始めました`,
      priority: 2, // 高優先度で通知センターに確実に表示
      requireInteraction: false, // 自動で消える（通知センターには履歴が残る）
      silent: !data.soundEnabled, // 音声通知の設定を反映
    };

    // 通知を作成
    const notificationId = await chrome.notifications.create(
      notificationOptions
    );

    // 通知IDを記録（後で操作する場合に備えて）
    console.log("macOS通知センターに通知を送信:", {
      id: notificationId,
      participant: data.participantName,
      timestamp: new Date(data.timestamp).toLocaleTimeString(),
      tabActive: data.tabActive,
    });

    // 通知が正常に作成された場合の追加処理
    // if (notificationId) {
    //   // 統計情報を更新（オプション）
    //   updateNotificationStats();
    // }
  } catch (error) {
    console.error("macOS通知センターへの通知送信に失敗:", error);

    // フォールバック: エラーログも通知として表示
    try {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Slack ハドル - エラー",
        message: "通知システムでエラーが発生しました",
        priority: 1,
        requireInteraction: false,
        silent: true,
      });
    } catch (fallbackError) {
      console.error("フォールバック通知も失敗:", fallbackError);
    }
  }
}

function playNotificationSound() {
  // macOS通知センターの通知音はsilent: falseで自動再生される
  // 追加でカスタム音声が必要な場合のみこの関数を使用
  console.log("macOS通知音を再生します");
}

// 通知統計情報の管理（オプション）
// async function updateNotificationStats() {
//   try {
//     const stats = (await chrome.storage.local.get(["notificationStats"])) || {
//       notificationStats: {},
//     };
//     const today = new Date().toDateString();

//     if (!stats.notificationStats[today]) {
//       stats.notificationStats[today] = 0;
//     }
//     stats.notificationStats[today]++;

//     await chrome.storage.local.set(stats);
//   } catch (error) {
//     console.log("統計情報の更新をスキップ:", error);
//   }
// }

// 拡張機能がインストールされた時の初期設定
chrome.runtime.onInstalled.addListener(() => {
  console.log("Slack Huddle Voice Detector がインストールされました");

  // デフォルト設定を保存
  chrome.storage.sync.set({
    huddleSettings: {
      enabled: true,
      soundEnabled: true,
      showParticipantName: true,
      notificationCooldown: 3000,
    },
  });
});

// 通知がクリックされた時の処理
chrome.notifications.onClicked.addListener(async (notificationId) => {
  console.log("macOS通知がクリックされました:", notificationId);

  try {
    // Slackタブを探してアクティブにする
    const tabs = await chrome.tabs.query({ url: "https://*.slack.com/*" });

    if (tabs.length > 0) {
      // 最初に見つかったSlackタブをアクティブにする
      const slackTab = tabs[0];

      // タブをアクティブにする
      await chrome.tabs.update(slackTab.id, { active: true });

      // ウィンドウもフォーカスする
      await chrome.windows.update(slackTab.windowId, { focused: true });

      console.log("Slackタブにフォーカスしました:", slackTab.url);
    } else {
      console.log("アクティブなSlackタブが見つかりません");
    }

    // 通知を閉じる
    await chrome.notifications.clear(notificationId);
  } catch (error) {
    console.error("通知クリック処理でエラー:", error);
  }
});

// 通知が閉じられた時の処理（オプション）
// chrome.notifications.onClosed.addListener((notificationId, byUser) => {
//   console.log("macOS通知が閉じられました:", {
//     id: notificationId,
//     byUser: byUser, // ユーザーが手動で閉じたかどうか
//   });
// });

// 通知ボタンがクリックされた時の処理（将来的な拡張用）
chrome.notifications.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    console.log("通知ボタンがクリックされました:", {
      notificationId,
      buttonIndex,
    });
    // 将来的に「ミュート」「設定」などのボタンを追加する場合に使用
  }
);

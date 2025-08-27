// 設定UIの制御

document.addEventListener("DOMContentLoaded", async () => {
  // DOM要素を取得
  const enabledCheckbox = document.getElementById("enabled");
  const soundEnabledCheckbox = document.getElementById("soundEnabled");
  const showParticipantNameCheckbox = document.getElementById(
    "showParticipantName"
  );
  const statusDiv = document.getElementById("status");
  const testButton = document.getElementById("testNotification");

  // 保存されている設定を読み込み
  try {
    const result = await chrome.storage.sync.get(["huddleSettings"]);
    const settings = result.huddleSettings || {
      enabled: true,
      soundEnabled: true,
      showParticipantName: true,
    };

    // UIに設定を反映
    enabledCheckbox.checked = settings.enabled;
    soundEnabledCheckbox.checked = settings.soundEnabled;
    showParticipantNameCheckbox.checked = settings.showParticipantName;

    updateStatus(settings.enabled);
  } catch (error) {
    console.error("設定の読み込みエラー:", error);
  }

  // 設定変更イベントリスナー
  enabledCheckbox.addEventListener("change", handleSettingChange);
  soundEnabledCheckbox.addEventListener("change", handleSettingChange);
  showParticipantNameCheckbox.addEventListener("change", handleSettingChange);

  // テストボタンのイベントリスナー
  testButton.addEventListener("click", handleTestNotification);

  async function handleSettingChange() {
    const newSettings = {
      enabled: enabledCheckbox.checked,
      soundEnabled: soundEnabledCheckbox.checked,
      showParticipantName: showParticipantNameCheckbox.checked,
    };

    try {
      // 設定を保存
      await chrome.storage.sync.set({ huddleSettings: newSettings });

      // ステータス表示を更新
      updateStatus(newSettings.enabled);

      // content scriptに設定変更を通知
      const tabs = await chrome.tabs.query({ url: "https://*.slack.com/*" });
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, {
            type: "settings_updated",
            settings: newSettings,
          })
          .catch(() => {
            // エラーは無視（タブがアクティブでない可能性）
          });
      });

      console.log("設定が保存されました:", newSettings);
    } catch (error) {
      console.error("設定の保存エラー:", error);
    }
  }

  function updateStatus(enabled) {
    if (enabled) {
      statusDiv.textContent = "有効";
      statusDiv.className = "status enabled";
    } else {
      statusDiv.textContent = "無効";
      statusDiv.className = "status disabled";
    }
  }

  async function handleTestNotification() {
    console.log("テスト通知ボタンがクリックされました");

    try {
      // まず通知権限をチェック
      const permission = await chrome.notifications.getPermissionLevel();
      console.log("通知権限レベル:", permission);

      if (permission !== "granted") {
        testButton.textContent = "エラー: 通知権限が必要です";
        console.error("通知権限が許可されていません:", permission);
        setTimeout(() => {
          testButton.textContent = "通知をテスト";
        }, 3000);
        return;
      }

      // Data URLでアイコンを生成（アイコンファイル不要）
      const canvas = document.createElement("canvas");
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext("2d");

      // 簡単な円形アイコンを描画
      ctx.fillStyle = "#007bff";
      ctx.beginPath();
      ctx.arc(24, 24, 20, 0, 2 * Math.PI);
      ctx.fill();

      // マイクアイコン風の白い形を描画
      ctx.fillStyle = "white";
      ctx.fillRect(20, 12, 8, 12);
      ctx.fillRect(18, 20, 12, 4);
      ctx.fillRect(22, 24, 4, 8);

      const iconDataUrl = canvas.toDataURL();

      // macOS通知センター用のテスト通知を送信
      console.log("通知作成を開始...");
      const notificationId = await chrome.notifications.create({
        type: "basic",
        iconUrl: iconDataUrl, // Data URLを使用
        title: "Slack ハドル 🎤 (テスト)",
        message: "テスト参加者が話し始めました - macOS通知センターのテストです",
        priority: 2, // 高優先度
        requireInteraction: false,
        silent: !soundEnabledCheckbox.checked, // 音声設定を反映
      });

      console.log("通知ID:", notificationId);

      if (notificationId) {
        // ボタンのフィードバック
        const originalText = testButton.textContent;
        testButton.textContent = "macOS通知センターを確認！";
        testButton.disabled = true;

        setTimeout(() => {
          testButton.textContent = originalText;
          testButton.disabled = false;
        }, 3000);

        console.log("macOS通知センターにテスト通知を送信成功:", notificationId);
      } else {
        throw new Error("通知IDが取得できませんでした");
      }
    } catch (error) {
      console.error("macOS通知センターへのテスト通知送信エラー:", error);
      console.error("エラーの詳細:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      testButton.textContent = `エラー: ${error.message}`;
      setTimeout(() => {
        testButton.textContent = "通知をテスト";
      }, 5000);
    }
  }
});

// content scriptからの設定リクエストに応答
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "get_settings") {
    chrome.storage.sync.get(["huddleSettings"]).then((result) => {
      sendResponse(
        result.huddleSettings || {
          enabled: true,
          soundEnabled: true,
          showParticipantName: true,
        }
      );
    });
    return true; // 非同期レスポンスを示す
  }
});

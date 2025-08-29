// 設定UIの制御

document.addEventListener("DOMContentLoaded", async () => {
  const testButton = document.getElementById("testNotification");

  // テストボタンのイベントリスナー
  testButton.addEventListener("click", handleTestNotification);

  async function handleTestNotification() {
    console.log("テスト通知ボタンがクリックされました");

    try {
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

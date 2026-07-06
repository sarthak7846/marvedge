document.addEventListener("DOMContentLoaded", () => {
  const statusBadge = document.getElementById("status-badge");
  const demoIdVal = document.getElementById("demo-id");
  const clickCountVal = document.getElementById("click-count");
  const downloadBtn = document.getElementById("download-btn");
  const clearBtn = document.getElementById("clear-btn");

  function updateUI() {
    chrome.runtime.sendMessage({ type: "GET_CURRENT_STATUS" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("Could not connect to background service worker:", chrome.runtime.lastError.message);
        return;
      }
      
      if (response) {
        if (response.isRecording) {
          statusBadge.innerText = "Capturing Clicks...";
          statusBadge.className = "status-indicator status-active";
          demoIdVal.innerText = response.currentDemoId || "-";
          clickCountVal.innerText = response.count;
          downloadBtn.disabled = false;
        } else {
          statusBadge.innerText = "Inactive";
          statusBadge.className = "status-indicator status-inactive";
          
          chrome.storage.local.get("lastSession", (res) => {
            if (res.lastSession) {
              demoIdVal.innerText = `${res.lastSession.demoId} (Saved)`;
              clickCountVal.innerText = res.lastSession.eventsTimeline.length;
              downloadBtn.disabled = false;
            } else {
              demoIdVal.innerText = "-";
              clickCountVal.innerText = "0";
              downloadBtn.disabled = true;
            }
          });
        }
      }
    });
  }

  updateUI();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "UPDATE_STATUS") {
      updateUI();
    }
  });

  downloadBtn.addEventListener("click", () => {
    chrome.storage.local.get("lastSession", (res) => {
      chrome.runtime.sendMessage({ type: "GET_CURRENT_STATUS" }, (currStatus) => {
        let events = [];
        let demoName = "recording";
        
        if (currStatus && currStatus.isRecording) {
          chrome.runtime.sendMessage({ type: "GET_CURRENT_STATUS" }, (response) => {
            alert("Please stop recording in Marvedge first to generate the final event log!");
          });
          return;
        } else if (res.lastSession) {
          events = res.lastSession.eventsTimeline;
          demoName = res.lastSession.demoId;
        }

        if (events.length === 0) {
          alert("No events captured in the last session!");
          return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `marvedge_${demoName}_timeline.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      });
    });
  });

  clearBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear current and saved session click logs?")) {
      chrome.runtime.sendMessage({ type: "CLEAR_SESSION" }, (res) => {
        if (res && res.success) {
          updateUI();
        }
      });
    }
  });
});

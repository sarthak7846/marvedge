let isRecording = false;
let currentDemoId = null;
let eventsTimeline = [];
let screenshotScale = 1.0;
let recordingStartTime = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Marvedge Service Worker] Received message type:", message.type);

  if (message.type === "RECORDING_STATE_CHANGE") {
    isRecording = message.isRecording;
    if (isRecording) {
      currentDemoId = message.demoId || `demo_${Date.now()}`;
      eventsTimeline = [];
      recordingStartTime = Date.now();
      console.log(`[Marvedge Service Worker] Started capture for demo: ${currentDemoId} at ${recordingStartTime}`);
    } else {
      console.log(`[Marvedge Service Worker] Stopped capture. Total events captured: ${eventsTimeline.length}`);
      chrome.storage.local.set({ 
        lastSession: {
          demoId: currentDemoId,
          eventsTimeline: [...eventsTimeline],
          screenshotScale
        } 
      });
    }
    chrome.runtime.sendMessage({ type: "UPDATE_STATUS", data: { isRecording, currentDemoId, count: eventsTimeline.length } }).catch(() => {});
  } 
  
  else if (message.type === "CAPTURE_EVENT") {
    if (isRecording) {
      const event = { ...message.event };
      screenshotScale = event.screenshot_scale || 1.0;
      
      event.timestamp_ms = event.timestamp_ms - recordingStartTime;
      
      eventsTimeline.push(event);
      console.log("[Marvedge Service Worker] Logged event at relative offset:", event.timestamp_ms, event);

      chrome.runtime.sendMessage({ type: "UPDATE_STATUS", data: { isRecording, currentDemoId, count: eventsTimeline.length } }).catch(() => {});

      if (currentDemoId && !currentDemoId.startsWith("demo_")) {
        sendEventToBackend(currentDemoId, event);
      }
    }
  }

  else if (message.type === "GET_CURRENT_STATUS") {
    sendResponse({
      isRecording,
      currentDemoId,
      count: eventsTimeline.length
    });
  }

  else if (message.type === "CLEAR_SESSION") {
    eventsTimeline = [];
    currentDemoId = null;
    isRecording = false;
    chrome.storage.local.remove("lastSession");
    sendResponse({ success: true });
  }

  return true;
});

async function sendEventToBackend(demoId, event) {
  try {
    const response = await fetch(`http://localhost:3000/api/demos/${demoId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ event })
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    console.log("[Marvedge Service Worker] Event synced successfully to backend");
  } catch (error) {
    console.warn("[Marvedge Service Worker] Failed to send event to backend, keeping local buffer. Error:", error.message);
  }
}

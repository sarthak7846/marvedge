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

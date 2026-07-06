let startTime = 0;
let lastClickTime = 0;
const DEBOUNCE_DELAY = 250;

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const message = event.data;
  if (message && message.source === "marvedge-web") {
    console.log("[Marvedge Extension Content Script] Received action:", message.action);
    
    if (message.action === "START_CAPTURE") {
      startTime = Date.now();
      lastClickTime = 0;
      chrome.runtime.sendMessage({ 
        type: "RECORDING_STATE_CHANGE", 
        isRecording: true,
        demoId: message.demoId 
      });
    } else if (message.action === "STOP_CAPTURE") {
      chrome.runtime.sendMessage({ 
        type: "RECORDING_STATE_CHANGE", 
        isRecording: false 
      });
    } else if (message.action === "GET_LAST_SESSION") {
      chrome.storage.local.get("lastSession", (res) => {
        window.postMessage({
          source: "marvedge-extension",
          type: "SEND_TIMELINE",
          lastSession: res.lastSession || null
        }, "*");
      });
    }
  }
});

document.addEventListener("click", (e) => {
  const now = Date.now();
  if (now - lastClickTime < DEBOUNCE_DELAY) {
    console.log("[Marvedge Extension] Ignored rapid click (debounced)");
    return;
  }
  lastClickTime = now;

  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  
  const screenshotScale = window.devicePixelRatio || 1.0;

  const target = e.target;
  let targetSelector = target.tagName.toLowerCase();
  if (target.id) {
    targetSelector += `#${target.id}`;
  } else if (target.className) {
    const classes = typeof target.className === 'string' 
      ? target.className.trim().split(/\s+/).join('.')
      : '';
    if (classes) {
      targetSelector += `.${classes}`;
    }
  }

  const clickEvent = {
    timestamp_ms: now,
    event_type: "click",
    coordinates: { x, y },
    screenshot_scale: screenshotScale,
    target_element: targetSelector
  };

  console.log("[Marvedge Extension] Click captured, sending to background:", clickEvent);

  chrome.runtime.sendMessage({
    type: "CAPTURE_EVENT",
    event: clickEvent
  });
}, true);

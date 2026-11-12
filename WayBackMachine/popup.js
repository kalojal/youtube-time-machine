const dateInput = document.getElementById("target-datetime");
const setBtn = document.getElementById("set-time-btn");
const clockDisplay = document.getElementById("live-clock");

// Save the chosen date and the exact real-world moment you clicked the button
setBtn.addEventListener("click", () => {
  if (!dateInput.value) return;

  const chosenHistoricalTime = new Date(dateInput.value).getTime();
  const realWorldStartTime = Date.now();

  chrome.storage.local.set({
    historicalStart: chosenHistoricalTime,
    realStart: realWorldStartTime
  }, () => {
    updateClock();
  });
});

// Calculate current virtual time and display it
function updateClock() {
  chrome.storage.local.get(["historicalStart", "realStart"], (data) => {
    if (!data.historicalStart || !data.realStart) return;

    const elapsedRealTime = Date.now() - data.realStart;
    const currentVirtualTime = new Date(data.historicalStart + elapsedRealTime);

    clockDisplay.textContent = currentVirtualTime.toLocaleString();
  });
}

// Tick every second
setInterval(updateClock, 1000);
updateClock();

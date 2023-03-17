chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  fetch('http://localhost:10213').then(res => res.text()).then(res => {
    chrome.tabs.sendMessage(tabs[0].id, { greeting: res }, function (response) {});
  });
});

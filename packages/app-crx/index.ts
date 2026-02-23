chrome.runtime.onMessage.addListener(function(request: any, sender: any, sendResponse: any) {
  if (request.greeting) {
    const contentElement = document.getElementById('content');
    if (contentElement) {
      contentElement.innerHTML = request.greeting;
    }
  }
});

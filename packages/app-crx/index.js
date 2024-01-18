chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.greeting) {
    document.getElementById('content').innerHTML = request.greeting;
  }
});

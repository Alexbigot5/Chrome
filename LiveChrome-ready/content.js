// Detects the current creator profile handle from the URL (TikTok or Instagram)
(function () {
  function extractHandle() {
    const url = window.location.href;

    // TikTok: tiktok.com/@handle
    const tiktokMatch = url.match(/tiktok\.com\/@([\w.]+)/);
    if (tiktokMatch) {
      return { handle: tiktokMatch[1].toLowerCase(), platform: 'tiktok' };
    }

    // Instagram: instagram.com/@handle or instagram.com/handle
    // Exclude known non-profile paths
    const igExclude = /instagram\.com\/(explore|reels|stories|accounts|p\/|reel\/|direct|about)/i;
    if (!igExclude.test(url)) {
      const igMatch = url.match(/instagram\.com\/@?([\w.]+)/);
      if (igMatch) {
        return { handle: igMatch[1].toLowerCase(), platform: 'instagram' };
      }
    }

    return null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_HANDLE') {
      const result = extractHandle();
      sendResponse(result || { handle: null, platform: null });
    }
  });
})();

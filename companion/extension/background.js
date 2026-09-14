async function openDesk() {
  const url = chrome.runtime.getURL('desk.html');
  const existing = (await chrome.tabs.query({})).find(t => t.url === url);
  if (existing) await chrome.tabs.update(existing.id, {active: true});
  else await chrome.tabs.create({url});
}
chrome.action.onClicked.addListener(openDesk);
chrome.runtime.onInstalled.addListener(openDesk);

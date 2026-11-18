// The tab URL binds the draft to this visit. No account data crosses this bridge.
window.addEventListener('message', async event=>{
  const id=location.hash.slice('#douban-import='.length);
  if(event.source!==window || event.origin!==location.origin ||
     !location.hash.startsWith('#douban-import=') || event.data?.type!=='cinema-request-import' || event.data.id!==id)return;
  let payload;
  try { payload=await chrome.runtime.sendMessage({type:'get-draft',id}); } catch {}
  window.postMessage({type:'cinema-import',id,payload},location.origin);
});

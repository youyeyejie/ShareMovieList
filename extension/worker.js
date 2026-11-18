chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='get-draft'||!sender.url||sender.frameId!==0)return;
  const page=new URL(sender.url);
  const destination=new URL(chrome.runtime.getManifest().content_scripts[0].matches[0].replace(/\*$/, ''));
  if(page.origin!==destination.origin||page.pathname!==destination.pathname||
     !/^[a-f0-9-]{36}$/.test(message.id))return;
  chrome.storage.session.get(message.id).then(data=>{
    const value=data[message.id];
    reply(value?.expires>Date.now()?value:null);
  }).catch(()=>reply(null));
  return true;
});

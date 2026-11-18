chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='get-draft'||!sender.url||sender.frameId!==0)return;
  const page=new URL(sender.url);
  if(page.origin!=='https://youyeyejie.github.io'||page.pathname!=='/ShareMovieList/'||
     !/^[a-f0-9-]{36}$/.test(message.id))return;
  chrome.storage.session.get(message.id).then(data=>{
    const value=data[message.id];
    reply(value?.expires>Date.now()?value:null);
  }).catch(()=>reply(null));
  return true;
});

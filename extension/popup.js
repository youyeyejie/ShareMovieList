const statusLine = document.querySelector('#status');
const send = document.querySelector('#send');
let tab;
const subject = /^https:\/\/movie\.douban\.com\/subject\/(\d+)\/?(?:[?#].*)?$/;

async function initialize() {
  [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!subject.test(tab?.url)) return;
  statusLine.textContent = tab.title;
  send.disabled = false;
}

// Runs on the page only after the user invokes the extension. Collect only
// the public fields consumed by the site's existing offline HTML parser.
function readSubject() {
  if(!/^https:\/\/movie\.douban\.com\/subject\/\d+\/?$/.test(location.origin+location.pathname))throw Error('请打开豆瓣作品详情页');
  const selectors = ['meta[property^="og:"]','link[rel="canonical"]','script[type="application/ld+json"]','[property="v:itemreviewed"]','.year','[property="v:summary"]','[property="v:average"]'];
  const html = [...document.querySelectorAll(selectors.join(','))].map(el=>el.outerHTML).join('\n');
  const poster=document.querySelector('#mainpic img');
  const cover=poster?.currentSrc || document.querySelector('meta[property="og:image"]')?.content;
  const rect=poster?.getBoundingClientRect();
  let crop=null;
  if(poster?.naturalWidth && rect.width>0 && rect.height>0 &&
      rect.left>=0 && rect.top>=0 && rect.right<=innerWidth && rect.bottom<=innerHeight &&
      [0.05,0.5,0.95].every(x=>[0.05,0.5,0.95].every(y=>
        document.elementFromPoint(rect.x+rect.width*x,rect.y+rect.height*y)===poster))){
    crop={x:rect.x,y:rect.y,w:rect.width,h:rect.height,vw:innerWidth,vh:innerHeight};
  }
  return {html,cover,crop,url:location.href};

}

async function readCover(url) {
  const image = new URL(url);
  if (image.protocol !== 'https:' || !image.hostname.endsWith('.doubanio.com')) throw Error('封面域名不受支持');
  const response = await fetch(image, {credentials:'omit',redirect:'error',signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw Error('封面请求失败');
  const blob = await response.blob();
  if (!blob.size || blob.size > 4*1024*1024) throw Error('封面过大或为空');
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result.split(',')[1]);
    reader.onerror = ()=>reject(Error('无法读取封面'));
    reader.readAsDataURL(blob);
  });
}

// If the CDN refuses embedding, crop the already displayed poster. Only the
// cropped JPEG leaves this popup. Off-screen/obscured posters use the file picker.
async function capturePoster(subjectTab,crop){
  if(!crop)return '';
  const active=async()=> (await chrome.tabs.query({active:true,windowId:subjectTab.windowId}))[0];
  const matches=async()=>{const t=await active();return t?.id===subjectTab.id&&t.url===subjectTab.url;};
  if(!await matches())return '';
  const frame=await chrome.tabs.captureVisibleTab(subjectTab.windowId,{format:'png'});
  if(!await matches())return '';
  const image=new Image();image.src=frame;await image.decode();
  const sx=image.naturalWidth/crop.vw,sy=image.naturalHeight/crop.vh;
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(crop.w*sx);canvas.height=Math.round(crop.h*sy);
  canvas.getContext('2d').drawImage(image,crop.x*sx,crop.y*sy,crop.w*sx,crop.h*sy,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',0.92).split(',')[1];
}

send.onclick = async ()=>{
  send.disabled = true;
  statusLine.textContent = '正在读取资料与封面…';
  try {
    const [{result}] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:readSubject});
    if (!subject.test(result.url) || !result.html || result.html.length>250000) throw Error('无法读取豆瓣作品资料');
    let image = '';
    try { image = await readCover(result.cover); } catch { image=await capturePoster(tab,result.crop).catch(()=>''); }
    const id = crypto.randomUUID();
    const now=Date.now();
    const old=await chrome.storage.session.get(null);
    const expired=Object.keys(old).filter(key=>old[key].expires<=now);
    if(expired.length)await chrome.storage.session.remove(expired);
    await chrome.storage.session.set({[id]:{html:result.html,image,expires:now+15*60*1000}});
    const destination = chrome.runtime.getManifest().content_scripts[0].matches[0].replace(/\*$/, '');
    await chrome.tabs.create({url:destination+'#douban-import='+id});
    window.close();
  } catch(error) {statusLine.textContent=error.message;send.disabled=false;}
};
initialize().catch(error=>statusLine.textContent=error.message);

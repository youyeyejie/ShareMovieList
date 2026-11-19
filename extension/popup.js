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
  return {html,url:location.href};
}

send.onclick = async ()=>{
  send.disabled = true;
  statusLine.textContent = '正在读取作品资料…';
  try {
    const [{result}] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:readSubject});
    if (!subject.test(result.url) || !result.html || result.html.length>250000) throw Error('无法读取豆瓣作品资料');
    const id = crypto.randomUUID();
    const now=Date.now();
    const old=await chrome.storage.session.get(null);
    const expired=Object.keys(old).filter(key=>old[key].expires<=now);
    if(expired.length)await chrome.storage.session.remove(expired);
    await chrome.storage.session.set({[id]:{html:result.html,expires:now+15*60*1000}});
    const destination = chrome.runtime.getManifest().content_scripts[0].matches[0].replace(/\*$/, '');
    await chrome.tabs.create({url:destination+'#douban-import='+id});
    window.close();
  } catch(error) {statusLine.textContent=error.message;send.disabled=false;}
};
initialize().catch(error=>statusLine.textContent=error.message);

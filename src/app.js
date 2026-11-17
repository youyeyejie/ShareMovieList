import {types,safeUrl,TMDB,demoMovies} from './data.js';
import {makeInvite,parseInvite} from './session.js';
import {photoPose,drawRopes} from './wall.js';
const $=s=>document.querySelector(s);
const session={get(k,f){try{return JSON.parse(sessionStorage.getItem(k))??f;}catch{return f;}},set(k,v){sessionStorage.setItem(k,JSON.stringify(v));},remove(k){sessionStorage.removeItem(k);}};
const params=new URLSearchParams(location.search), demo=params.get('demo')==='1';
let settings={...(window.CINEMA_CONFIG||{}),...session.get('cinema-tmdb',{})};
if(params.has('list'))settings.listId=/^\d+$/.test(params.get('list'))?params.get('list'):'';
let auth=session.get('cinema-tmdb-auth',{}),movies=[],listDetails=null,filter='all',editing=null,selected=null,pending=false,loading=false,loadController,loadVersion=0,lookupController;
let albumPage=1,albumTotalPages=1;
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const client=()=>new TMDB({...settings,...auth});
const isDemo=()=>demo;
const toast=msg=>{$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6500);};
const notice=msg=>{$('#notice').textContent=msg;$('#notice').hidden=!msg;};
const open=id=>{if(!$(id).open)$(id).showModal();};
function persist(){session.set('cinema-tmdb-demo',movies);}
function saveSettings(){session.set('cinema-tmdb',settings);const url=new URL(location.href);if(url.searchParams.has('list')){if(settings.listId)url.searchParams.set('list',settings.listId);else url.searchParams.delete('list');history.replaceState(null,'',url.href);}}
function settingsDialog(force=false){if(pending&&force!==true)return toast('请等待当前操作完成');const f=$('#settings-form');for(const key of ['readToken','listId'])f.elements[key].value=settings[key]||'';updateAuthStatus();open('#settings');}
function updateAuthStatus(){
  $('#auth-status').textContent=auth.accessToken?'已连接 TMDB 用户授权，可选择或创建自己的清单。':'尚未授权。填写 Read Access Token，点击登录，在 TMDB 确认授权后会返回此页面。';
  $('#logout').hidden=$('#revoke').hidden=!auth.accessToken;
  $('#login').hidden=!!auth.accessToken;
  $('#finish-login').hidden=!session.get('cinema-tmdb-request',null);
}
function editable(){
  if(demo)return true;
  if(!auth.accessToken){toast('请先在设置中登录 TMDB 并授权');settingsDialog();return false;}
  if(!settings.listId){toast('请先创建或选择一份 TMDB 清单');settingsDialog();return false;}
  if(listDetails?.created_by?.id&&listDetails.created_by.id!==auth.accountId){toast('这份清单属于其他账号，请选择自己的清单或导入所有者共享的授权');settingsDialog();return false;}
  return true;
}
async function load(){
  loadController?.abort();const controller=loadController=new AbortController();const version=++loadVersion;
  loading=true;$('#refresh').disabled=true;$('#connection').textContent='正在同步 TMDB';
  try{
    if(demo){movies=session.get('cinema-tmdb-demo',demoMovies);notice('本机演示 · 原创示意封面，修改仅保存在当前标签页。退出演示后连接 TMDB，管理真实清单。');}
    else if(!settings.readToken&&!auth.accessToken){movies=[];listDetails=null;notice('欢迎来到放映室。点击右上角设置，填写自己的 TMDB 凭证，登录后创建或选择清单。');}
    else if(!settings.listId){movies=[];listDetails=null;notice('TMDB 已配置。可搜索作品；登录授权后，在设置中创建或选择清单。');}
    else{const data=await client().list(settings.listId,controller.signal);if(version!==loadVersion)return;movies=data.movies;listDetails=data.details;notice('');}
    if(version!==loadVersion)return;render();$('#connection').textContent=demo?'本机演示':auth.accessToken?'TMDB · 已授权':settings.listId?'TMDB · 只读':'连接 TMDB';
  }catch(e){if(version!==loadVersion||e.name==='AbortError')return;notice(`同步失败：${e.message}。当前内容可能尚未同步，请重试。`);$('#connection').textContent='TMDB 同步失败';}
  finally{if(version===loadVersion){loading=false;$('#refresh').disabled=false;updateListLink();}}
}
function updateListLink(){const link=$('#tmdb-link');link.hidden=!settings.listId;link.href=`https://www.themoviedb.org/list/${encodeURIComponent(settings.listId||'')}`;}
function card(m,index,inAlbum=false){
  const pose=photoPose(index,inAlbum);
  return `<article class="photo" style="${pose}">${inAlbum?'':'<span class="clip"></span>'}<button class="photo-open" data-open="${escape(m.id)}" aria-label="查看${escape(m.title)}">${m.cover?`<img class="photo-image" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title)}封面" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cover-empty"><span>${escape(m.title)}</span><small>WAITING FOR A STORY</small></div>`}<div class="photo-info"><h3>${escape(m.title)}</h3><div class="photo-meta"><span>${escape(m.year)}${m.year?' · ':''}${types[m.type]||'其他'}</span>${m.rating!==''&&m.rating!=null?`<span class="rating">★ ${escape(m.rating)} ${escape(m.ratingSource)}</span>`:''}</div><p class="photo-note">${escape(m.note||'留一个晚上，给这个故事。')}</p></div></button><div class="photo-bottom"><span>${isDemo()?'DEMO / 示意封面':'TMDB / 我们的片单'}</span><button class="watch-button" data-watch="${escape(m.id)}">${m.watched?'↶ 放回绳子':'✓ 看过了'}</button></div></article>`;
}
function wireCards(root){root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>detail(el.dataset.open));root.querySelectorAll('[data-watch]').forEach(el=>el.onclick=()=>mutate(el.dataset.watch,'watch'));root.querySelectorAll('img').forEach(img=>img.onerror=()=>{const blank=document.createElement('div');blank.className='cover-empty';blank.innerHTML='<span>一段待看的故事</span><small>THE SHARED CINEMA</small>';img.replaceWith(blank);});}
function render(){
  const query=$('#search').value.trim().toLowerCase();const waiting=movies.filter(m=>!m.watched);const visible=waiting.filter(m=>(filter==='all'||m.type===filter)&&`${m.title} ${m.note} ${m.year}`.toLowerCase().includes(query));
  $('#total-count').textContent=waiting.length;$('#wall-count').textContent=`待放映 / ${String(visible.length).padStart(2,'0')}`;$('#album-count').textContent=`${movies.filter(m=>m.watched).length} 个共同的片刻 ↗`;
  const columns=innerWidth<=700?2:innerWidth<=1100?3:4;const wall=$('#wall');wall.style.setProperty('--columns',columns);wall.innerHTML='';
  for(let start=0;start<visible.length;start+=columns){const row=document.createElement('div');row.className='rope-row';row.innerHTML=visible.slice(start,start+columns).map((m,i)=>card(m,start+i)).join('');wall.append(row);}
  if(!visible.length)wall.innerHTML=`<p class="empty">${query?'没有找到这个故事。':filter!=='all'?'这根绳子还没有这个类型的故事。':'绳子空了，挂一部想一起看的故事吧。'}</p>`;
  wireCards(wall);renderAlbum();requestAnimationFrame(()=>drawRopes(wall));
}
function updateAlbumControls(){
  $('#album-prev').disabled=albumPage<=1;
  $('#album-next').disabled=albumPage>=albumTotalPages;
  $('#album-page').textContent=`第 ${albumPage} / ${albumTotalPages} 页`;
}
function renderAlbum(){
  const query=$('#album-search').value.trim().toLowerCase();
  const seen=movies.filter(m=>m.watched);
  const matches=seen.filter(m=>`${m.title} ${m.note} ${m.year} ${types[m.type]||''}`.toLowerCase().includes(query));
  const pageSize=innerWidth<=600?4:6;
  albumTotalPages=Math.max(1,Math.ceil(matches.length/pageSize));
  albumPage=Math.max(1,Math.min(albumPage,albumTotalPages));
  const visible=matches.slice((albumPage-1)*pageSize,albumPage*pageSize);
  $('#album-results').textContent=query?`找到 ${matches.length} / ${seen.length} 个片刻`:`已珍藏 ${seen.length} 个共同的片刻`;
  $('#album-grid').innerHTML=visible.length?visible.map((m,i)=>card(m,(albumPage-1)*pageSize+i,true)).join(''):`<p class="empty">${query?'相册里没有找到这个故事，换个关键词试试。':'相册的第一页，等我们一起写。'}</p>`;
  wireCards($('#album-grid'));updateAlbumControls();
}
function showSelected(){const box=$('#selected-movie');box.innerHTML=selected?`<div class="selected-work"><strong>${escape(selected.title)}</strong><span>${escape(selected.year)} · ${types[selected.type]||'其他'}${selected.rating!==''?` · TMDB ${escape(selected.rating)}`:''}</span><small>封面、名称和评分随 TMDB 资料更新。</small></div>`:'';}
function editor(movie=null){
  if(movie&&!editable())return;lookupController?.abort();editing=movie;selected=movie?{...movie}:null;$('#movie-form').reset();$('#search-fields').hidden=!!movie;$('#lookup-results').innerHTML='';$('#editor-title').textContent=movie?'编辑这个故事':'挂一部新片';$('#movie-form').elements.note.value=movie?.note||'';$('#movie-form').elements.type.value=movie?.type||'movie';showSelected();$('#save-hint').textContent=demo?'本机演示：修改只保存在当前标签页。':'从 TMDB 检索并选择作品，备注、分类和已看状态保存在 TMDB 清单。';open('#editor');
}
function detail(id){const m=movies.find(m=>m.id===id);if(!m)return;
  $('#detail-content').innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">${m.watched?'A COLLECTED MOMENT':'ON OUR WATCHLIST'}</p><h2>${escape(m.title)}</h2></div><button class="close" data-close aria-label="关闭">×</button></div>${m.cover?`<img class="detail-cover" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title)}" referrerpolicy="no-referrer">`:''}<p class="hint">${types[m.type]||'其他'} · ${escape(m.year||'年份未填写')}${m.rating!==''&&m.rating!=null?` · TMDB ${escape(m.rating)}`:''}</p><p class="detail-note">${escape(m.note||m.overview)}</p>${m.url?`<a class="secondary" href="${escape(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer">前往 TMDB 作品页面 ↗</a>`:''}<div class="detail-actions"><button class="primary" id="detail-watch">${m.watched?'放回绳子':'✓ 标记已观看'}</button><button class="secondary" id="detail-edit">编辑</button><button class="secondary danger" id="detail-delete">移除</button></div>`;
  $('#detail-watch').onclick=()=>mutate(m.id,'watch');$('#detail-edit').onclick=()=>{if(editable()){$('#detail').close();editor(m);}};$('#detail-delete').onclick=()=>mutate(m.id,'delete');$('#detail-content img')?.addEventListener('error',e=>e.target.remove());open('#detail');
}
async function operation(task){if(pending)return;pending=true;document.body.classList.add('busy');document.querySelectorAll('dialog button').forEach(b=>b.disabled=true);try{await task();}catch(e){toast(e.message);}finally{pending=false;document.body.classList.remove('busy');document.querySelectorAll('dialog button').forEach(b=>b.disabled=false);updateAlbumControls();}}
async function mutate(id,action){
  if(pending||loading||!editable())return;const m=movies.find(x=>x.id===id);if(!m)return;
  if(action==='delete'&&!confirm(`从 TMDB 清单移除《${m.title}》？恢复需重新添加。`))return;
  await operation(async()=>{
    if(!demo){if(action==='delete')await client().items(settings.listId,'DELETE',m);else await client().save(settings.listId,{...m,watched:!m.watched});}
    if(action==='delete')movies=movies.filter(x=>x.id!==id);else m.watched=!m.watched;
    if(demo)persist();$('#detail').close();render();toast(action==='delete'?'已从清单移除':m.watched?'已收进我们的相册':'已重新夹到绳子上');
  });
}
$('#movie-form').onsubmit=async e=>{
  e.preventDefault();if(pending)return;if(!selected)return toast('请先搜索并选择一部 TMDB 作品');if(!editable())return;
  const movie={...selected,note:e.target.elements.note.value.trim(),type:e.target.elements.type.value};
  if(!editing&&movies.some(m=>m.id===movie.id))return toast('这部作品已在清单或相册中，可直接编辑或恢复');
  await operation(async()=>{
    if(!demo)await client().save(settings.listId,movie,{newItem:!editing});
    if(editing)movies=movies.map(m=>m.id===movie.id?movie:m);else movies.unshift(movie);
    if(demo)persist();$('#editor').close();render();toast(editing?'留言和分类已更新':'新的故事，已夹到绳子上');
  });
};
$('#lookup').onclick=async()=>{
  const query=$('#lookup-query').value.trim();if(!query)return toast('先填写作品名称');lookupController?.abort();const controller=lookupController=new AbortController();const box=$('#lookup-results');box.textContent='正在检索 TMDB…';
  try{const results=demo?demoMovies.filter(m=>m.title.includes(query)):await client().search(query,controller.signal);if(controller!==lookupController)return;box.innerHTML='';if(!results.length)box.textContent='没有找到匹配作品，请试试原名或英文名。';
    results.forEach(m=>{const b=document.createElement('button');b.type='button';b.className='lookup-result';b.innerHTML=`${m.cover?`<img src="${escape(safeUrl(m.cover))}" alt="" loading="lazy">`:''}<span><strong>${escape(m.title)}</strong><small>${escape(m.year)} · ${types[m.type]||'其他'}${m.rating!==''?` · TMDB ${escape(m.rating)}`:''}</small></span>`;b.onclick=()=>{selected={...m,watched:false,note:''};$('#movie-form').elements.type.value=m.type;showSelected();box.innerHTML='';};box.append(b);});
  }catch(e){if(controller===lookupController&&e.name!=='AbortError')box.textContent=e.message;}
};
$('#lookup-query').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#lookup').click();}};
function readSettingsForm(){const f=$('#settings-form');return {readToken:f.elements.readToken.value.trim(),listId:f.elements.listId.value.trim()};}
function applySettings(){if(demo)throw Error('演示模式不会连接或修改 TMDB，请退出演示后配置');const next=readSettingsForm();if(next.listId&&!/^[1-9]\d*$/.test(next.listId))throw Error('清单 ID 需要填写正整数');const changed=JSON.stringify(settings)!==JSON.stringify(next);loadController?.abort();loadVersion++;loading=false;$('#refresh').disabled=false;settings=next;saveSettings();if(changed){movies=[];listDetails=null;render();}updateListLink();}
$('#settings-form').onsubmit=e=>{e.preventDefault();if(pending)return;try{applySettings();$('#settings').close();load();}catch(err){toast(err.message);}};
$('#login').onclick=()=>operation(async()=>{
  applySettings();if(!settings.readToken)throw Error('请填写长令牌 API Read Access Token，再登录授权');
  const state=crypto.randomUUID();const redirect=new URL(location.href);redirect.search='';redirect.hash='';redirect.searchParams.set('tmdb_auth',state);if(settings.listId)redirect.searchParams.set('list',settings.listId);
  const data=await client().request('/4/auth/request_token',{method:'POST',application:true,body:{redirect_to:redirect.href}});
  if(!data.request_token)throw Error('TMDB 没有返回授权请求令牌');
  session.set('cinema-tmdb-request',{token:data.request_token,state,created:Date.now()});
  location.assign(`https://www.themoviedb.org/auth/access?request_token=${encodeURIComponent(data.request_token)}`);
});
async function finishLogin(state){
  const request=session.get('cinema-tmdb-request',null);
  if(!request||request.state!==state)throw Error('授权请求不匹配，请重新登录');
  if(Date.now()-request.created>15*60*1000){session.remove('cinema-tmdb-request');throw Error('授权请求已超过 15 分钟，请重新登录');}
  const result=await client().request('/4/auth/access_token',{method:'POST',application:true,body:{request_token:request.token}});
  if(!result.access_token||!result.account_id)throw Error('TMDB 没有返回有效的用户授权');
  auth={accessToken:result.access_token,accountId:result.account_id};session.set('cinema-tmdb-auth',auth);session.remove('cinema-tmdb-request');
  updateAuthStatus();toast('TMDB 授权完成，请选择或创建清单');await load();settingsDialog(true);
}
$('#finish-login').onclick=()=>operation(async()=>{const request=session.get('cinema-tmdb-request',null);if(!request)throw Error('没有等待完成的授权');await finishLogin(request.state);});
$('#logout').onclick=()=>operation(async()=>{if(demo)throw Error('请退出演示后管理授权');auth={};session.remove('cinema-tmdb-auth');session.remove('cinema-tmdb-request');updateAuthStatus();$('#my-list-results').innerHTML='';await load();toast('此页面已断开，其他共享链接仍然有效');});
$('#revoke').onclick=()=>{
  if(demo)return toast('请退出演示后管理授权');
  if(!auth.accessToken||!confirm('撤销当前 TMDB 用户授权？使用同一授权令牌的朋友也会失去编辑权限，需要重新登录并分享。'))return;
  operation(async()=>{await client().request('/4/auth/access_token',{method:'DELETE',application:true,body:{access_token:auth.accessToken}});auth={};session.remove('cinema-tmdb-auth');session.remove('cinema-tmdb-request');updateAuthStatus();$('#my-list-results').innerHTML='';await load();toast('当前授权已撤销，旧的共享令牌已失效');});
};
$('#my-lists').onclick=()=>operation(async()=>{
  applySettings();if(!auth.accessToken)throw Error('先登录 TMDB 再选择清单');
  const lists=await client().accountLists(auth.accountId);const box=$('#my-list-results');box.innerHTML='';
  if(!lists.length)box.textContent='还没有自己的清单，点击“创建共享清单”开始。';
  for(const list of lists){const b=document.createElement('button');b.type='button';b.className='list-choice';b.textContent=`${list.name} · ${list.number_of_items??0} 部${list.public===false?' · 私密':''}`;b.onclick=()=>{settings.listId=String(list.id);saveSettings();$('#settings-form').elements.listId.value=settings.listId;movies=[];listDetails=null;render();$('#settings').close();load();};box.append(b);}
});
$('#create-list').onclick=()=>operation(async()=>{
  applySettings();if(!auth.accessToken)throw Error('请先登录 TMDB，再创建清单');
  const result=await client().createList();const id=result.id||result.list_id;if(!id)throw Error('TMDB 没有返回新清单 ID');settings.listId=String(id);saveSettings();$('#settings-form').elements.listId.value=settings.listId;$('#settings').close();await load();toast('公开清单已创建，现在可以挂新片了');
});
function cleanBase(){const url=new URL(location.href);url.search='';url.hash='';return url;}
async function copyLink(url){try{await navigator.clipboard.writeText(url);toast('链接已复制');}catch{const d=$('#share-output');$('#share-url').value=url;d.showModal();$('#share-url').select();}}
$('#share').onclick=()=>{
  if(pending)return;try{applySettings();if(!auth.accessToken||!settings.listId)throw Error('请先登录 TMDB 并创建或选择清单');
    if(!editable())return;
    if(!confirm('共享链接包含完整账号授权，接收者将能以相同权限操作 TMDB 账号，不限于这份清单。确认只分享给完全信任的人？'))return;
    copyLink(makeInvite(cleanBase(),{...settings,...auth}));
  }catch(e){toast(e.message);}
};
$('#share-readonly').onclick=()=>{if(pending)return;try{applySettings();if(!settings.listId)throw Error('先选择一份公开清单');if(listDetails?.public===false)throw Error('私密清单不能通过只读链接公开访问');const url=cleanBase();url.searchParams.set('list',settings.listId);copyLink(url.href);}catch(e){toast(e.message);}};
document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))e.target.closest('dialog').close();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#settings-button').onclick=settingsDialog;$('#add-button').onclick=()=>editor();$('#refresh').onclick=()=>{if(!pending)load();};$('#search').oninput=render;$('#album-button').onclick=()=>{renderAlbum();open('#album');};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>(x.classList.toggle('active',x===b),x.setAttribute('aria-pressed',String(x===b))));render();});
$('#album-search').oninput=()=>{albumPage=1;renderAlbum();};
$('#album-prev').onclick=()=>{if(albumPage>1){albumPage--;renderAlbum();$('#album').scrollTop=0;}};
$('#album-next').onclick=()=>{if(albumPage<albumTotalPages){albumPage++;renderAlbum();$('#album').scrollTop=0;}};
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);});
window.addEventListener('focus',()=>{if(!demo&&!loading&&!pending&&!document.querySelector('dialog[open]'))load();});
async function start(){
  // Consume fragment credentials before making API requests; fragments are never sent to the host.
  const hash=location.hash;
  if(hash.startsWith('#access=')){
    history.replaceState(null,'',location.pathname+location.search);
    try{const invitation=parseInvite(hash);if(invitation&&confirm('这个链接包含分享者的完整 TMDB 账号授权。导入后将以分享者身份操作，不是访客权限。是否替换当前标签页的连接并使用？')){
      settings={readToken:invitation.readToken,listId:invitation.listId};auth={accessToken:invitation.accessToken,accountId:invitation.accountId};saveSettings();session.set('cinema-tmdb-auth',auth);session.remove('cinema-tmdb-request');
    }}catch(e){notice('无法导入共享链接：'+e.message);render();return;}
  }
  const state=new URLSearchParams(location.search).get('tmdb_auth');
  if(state){const url=new URL(location.href);url.searchParams.delete('tmdb_auth');url.searchParams.delete('request_token');url.searchParams.delete('approved');history.replaceState(null,'',url.href);await operation(()=>finishLogin(state));}
  else await load();
}
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#access='))start();});
start();

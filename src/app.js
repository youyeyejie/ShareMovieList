import {types,safeUrl,TMDB,demoMovies} from './data.js';
import {makeInvite,parseInvite} from './session.js';
import {photoPose,initBoard} from './wall.js';
import {ask,showMessage} from './dialog.js';
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
  $('#auth-status').textContent=auth.accessToken?'已授权':'未授权';
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
    if(demo){movies=session.get('cinema-tmdb-demo',demoMovies);notice('');}
    else if(!settings.readToken&&!auth.accessToken){movies=[];listDetails=null;notice('');}
    else if(!settings.listId){movies=[];listDetails=null;notice('');}
    else{const data=await client().list(settings.listId,controller.signal);if(version!==loadVersion)return;movies=data.movies;listDetails=data.details;notice('');}
    if(version!==loadVersion)return;render();$('#connection').textContent=demo?'本机演示':auth.accessToken?'TMDB · 已授权':settings.listId?'TMDB · 只读':'连接 TMDB';
  }catch(e){if(version!==loadVersion||e.name==='AbortError')return;notice(`同步失败：${e.message}。当前内容可能尚未同步，请重试。`);$('#connection').textContent='TMDB 同步失败';}
  finally{if(version===loadVersion){loading=false;$('#refresh').disabled=false;updateListLink();}}
}
function updateListLink(){const link=$('#tmdb-link');link.hidden=!settings.listId;link.href=`https://www.themoviedb.org/list/${encodeURIComponent(settings.listId||'')}`;}
function card(m,index,inAlbum=false){
  const pose=photoPose(index,inAlbum);
  return `<article class="photo${inAlbum?' album-photo':''}" data-movie-id="${escape(m.id)}" style="${pose}">${inAlbum?'':`<button class="pushpin" type="button" aria-label="移动《${escape(m.title)}》" title="拖动调整位置；方向键微调，Home 复位"></button>`}<button class="photo-open" data-open="${escape(m.id)}" aria-label="查看${escape(m.title)}">${m.cover?`<img class="photo-image" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title)}封面" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cover-empty"><span>${escape(m.title)}</span><small>WAITING FOR A STORY</small></div>`}<div class="photo-info"><h3>${escape(m.title)}</h3><div class="photo-meta"><span>${escape(m.year)}${m.year?' · ':''}${types[m.type]||'其他'}</span>${m.rating!==''&&m.rating!=null?`<span class="rating">★ ${escape(m.rating)} ${escape(m.ratingSource)}</span>`:''}</div><p class="photo-note">${escape(m.note||'留一个晚上，给这个故事。')}</p></div></button><div class="photo-bottom"><span>${isDemo()?'DEMO / 示意封面':'TMDB / 我们的片单'}</span><button class="watch-button" data-watch="${escape(m.id)}">${m.watched?'↶ 放回照片墙':'✓ 看过了'}</button></div></article>`;
}
function wireCards(root){root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>detail(el.dataset.open));root.querySelectorAll('[data-watch]').forEach(el=>el.onclick=()=>mutate(el.dataset.watch,'watch'));root.querySelectorAll('img').forEach(img=>img.onerror=()=>{const blank=document.createElement('div');blank.className='cover-empty';blank.innerHTML='<span>一段待看的故事</span><small>THE SHARED CINEMA</small>';img.replaceWith(blank);});}
function render(){
  const query=$('#search').value.trim().toLowerCase();const waiting=movies.filter(m=>!m.watched);const visible=waiting.filter(m=>(filter==='all'||m.type===filter)&&`${m.title} ${m.note} ${m.year}`.toLowerCase().includes(query));
  $('#total-count').textContent=waiting.length;$('#wall-count').textContent=`待放映 / ${String(visible.length).padStart(2,'0')}`;$('#album-count').textContent=`${movies.filter(m=>m.watched).length} 个共同的片刻 ↗`;
  const columns=innerWidth<=600?2:innerWidth<=850?3:innerWidth<=1100?4:innerWidth<1400?5:6;
  const wall=$('#wall');wall.style.setProperty('--columns',columns);
  wall.innerHTML=visible.length?'<div class="board-grid">'+visible.map((m,i)=>card(m,i)).join('')+'</div>':`<div class="empty"><p>${query?'没有找到这个故事。':filter!=='all'?'暂时没有这个类型的作品。':'照片墙还空着。'}</p>${!query&&filter==='all'?'<button class="primary" id="empty-add">添加作品</button>':''}</div>`;
  $('#empty-add')?.addEventListener('click',()=>editor());
  wireCards(wall);renderAlbum();requestAnimationFrame(()=>initBoard(wall,{key:demo?'demo':settings.listId||'personal'}));
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
  if(movie&&!editable())return;lookupController?.abort();editing=movie;selected=movie?{...movie}:null;$('#movie-form').reset();$('#search-fields').hidden=!!movie;$('#lookup-results').innerHTML='';$('#editor-title').textContent=movie?'编辑作品':'添加作品';$('#movie-form [type=submit]').textContent=movie?'保存修改':'添加到照片墙';$('#movie-form').elements.note.value=movie?.note||'';$('#movie-form').elements.type.value=movie?.type||'movie';showSelected();$('#save-hint').textContent='';open('#editor');
}
function detail(id){const m=movies.find(m=>m.id===id);if(!m)return;
  $('#detail-content').innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">${m.watched?'A COLLECTED MOMENT':'ON OUR WATCHLIST'}</p><h2>${escape(m.title)}</h2></div><button class="close" data-close aria-label="关闭">×</button></div>${m.cover?`<img class="detail-cover" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title)}" referrerpolicy="no-referrer">`:''}<p class="hint">${types[m.type]||'其他'} · ${escape(m.year||'年份未填写')}${m.rating!==''&&m.rating!=null?` · TMDB ${escape(m.rating)}`:''}</p><p class="detail-note">${escape(m.note||m.overview)}</p>${m.url?`<a class="secondary" href="${escape(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer">前往 TMDB 作品页面 ↗</a>`:''}<div class="detail-actions"><button class="primary" id="detail-watch">${m.watched?'放回照片墙':'✓ 标记已观看'}</button><button class="secondary" id="detail-edit">编辑</button><button class="secondary danger" id="detail-delete">移除</button></div>`;
  $('#detail-watch').onclick=()=>mutate(m.id,'watch');$('#detail-edit').onclick=()=>{if(editable()){$('#detail').close();editor(m);}};$('#detail-delete').onclick=()=>mutate(m.id,'delete');$('#detail-content img')?.addEventListener('error',e=>e.target.remove());open('#detail');
}
async function operation(task){
  if(pending)return;pending=true;document.body.classList.add('busy');
  const controls=[...document.querySelectorAll('dialog[open] button')].map(button=>({button,disabled:button.disabled}));
  controls.forEach(({button})=>button.disabled=true);
  try{await task();}catch(e){await showMessage({title:'操作未完成',message:e.message});}
  finally{pending=false;document.body.classList.remove('busy');controls.forEach(({button,disabled})=>{if(button.isConnected)button.disabled=disabled;});updateAlbumControls();}
}
async function mutate(id,action){
  if(pending||loading||!editable())return;const m=movies.find(x=>x.id===id);if(!m)return;
  if(action==='delete'&&!await ask('移除作品',`要移除《${m.title}》吗？移除后需要重新添加，原来的留言不会恢复。`,'移除',true))return;
  await operation(async()=>{
    if(!demo){if(action==='delete')await client().items(settings.listId,'DELETE',m);else await client().save(settings.listId,{...m,watched:!m.watched});}
    if(action==='delete')movies=movies.filter(x=>x.id!==id);else m.watched=!m.watched;
    if(demo)persist();$('#detail').close();render();toast(action==='delete'?'已从清单移除':m.watched?'已收进我们的相册':'已放回照片墙');
  });
}
$('#movie-form').onsubmit=async e=>{
  e.preventDefault();if(pending)return;if(!selected)return toast('请先搜索并选择一部 TMDB 作品');if(!editable())return;
  const movie={...selected,note:e.target.elements.note.value.trim(),type:e.target.elements.type.value};
  if(!editing&&movies.some(m=>m.id===movie.id))return toast('这部作品已在清单或相册中，可直接编辑或恢复');
  await operation(async()=>{
    if(!demo)await client().save(settings.listId,movie,{newItem:!editing});
    if(editing)movies=movies.map(m=>m.id===movie.id?movie:m);else movies.unshift(movie);
    if(demo)persist();$('#editor').close();render();toast(editing?'留言和分类已更新':'已添加到照片墙');
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
$('#settings-form').onsubmit=e=>{e.preventDefault();if(pending)return;try{applySettings();$('#settings').close();load();}catch(err){showMessage({title:'无法保存设置',message:err.message});}};
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
$('#revoke').onclick=async()=>{
  if(demo)return showMessage({title:'本机演示',message:'请退出演示后管理真实账号授权。'});
  if(!auth.accessToken||!await ask('撤销账号授权','撤销后，使用同一共享令牌的朋友也会失去编辑权限。需要重新登录并生成新的共享链接。','撤销授权',true))return;
  operation(async()=>{await client().request('/4/auth/access_token',{method:'DELETE',application:true,body:{access_token:auth.accessToken}});auth={};session.remove('cinema-tmdb-auth');session.remove('cinema-tmdb-request');updateAuthStatus();$('#my-list-results').innerHTML='';await load();toast('授权已撤销');});
};
$('#my-lists').onclick=()=>operation(async()=>{
  applySettings();if(!auth.accessToken)throw Error('先登录 TMDB 再选择清单');
  const lists=await client().accountLists(auth.accountId);const box=$('#my-list-results');box.innerHTML='';
  if(!lists.length)box.textContent='还没有自己的清单，点击“创建共享清单”开始。';
  for(const list of lists){const b=document.createElement('button');b.type='button';b.className='list-choice';b.textContent=`${list.name} · ${list.number_of_items??0} 部${list.public===false?' · 私密':''}`;b.onclick=()=>{settings.listId=String(list.id);saveSettings();$('#settings-form').elements.listId.value=settings.listId;movies=[];listDetails=null;render();$('#settings').close();load();};box.append(b);}
});
$('#create-list').onclick=()=>operation(async()=>{
  applySettings();if(!auth.accessToken)throw Error('请先登录 TMDB，再创建清单');
  const result=await client().createList();const id=result.id||result.list_id;if(!id)throw Error('TMDB 没有返回新清单 ID');settings.listId=String(id);saveSettings();$('#settings-form').elements.listId.value=settings.listId;$('#settings').close();await load();toast('清单已创建，可以添加作品了');
});
function cleanBase(){const url=new URL(location.href);url.search='';url.hash='';return url;}
async function copyLink(url){try{await navigator.clipboard.writeText(url);toast('链接已复制');}catch{const d=$('#share-output');$('#share-url').value=url;d.showModal();$('#share-url').select();}}
$('#share').onclick=async()=>{
  if(pending)return;
  try{
    applySettings();if(!auth.accessToken||!settings.listId)throw Error('请先登录 TMDB 并创建或选择清单');if(!editable())return;
    if(!await ask('共享账号编辑权限','这个链接包含完整账号授权。接收者享有与你相同的 TMDB 权限，不限于这份清单。请只分享给完全信任的人。','生成共享链接'))return;
    await copyLink(makeInvite(cleanBase(),{...settings,...auth}));
  }catch(e){showMessage({title:'无法生成链接',message:e.message});}
};
$('#share-readonly').onclick=()=>{if(pending)return;try{applySettings();if(!settings.listId)throw Error('先选择一份公开清单');if(listDetails?.public===false)throw Error('私密清单不能通过只读链接公开访问');const url=cleanBase();url.searchParams.set('list',settings.listId);copyLink(url.href);}catch(e){showMessage({title:'无法生成链接',message:e.message});}};
$('#settings-help').onclick=()=>showMessage({title:'使用说明与权限',message:'连接：填写 TMDB 的 API Read Access Token（长令牌），登录授权后选择或创建清单。\n\n凭证：仅保存在当前标签页会话中，不会写入公开仓库。编辑清单需要清单所属账号授权。\n\n分享：共享编辑链接包含完整账号授权，只发给完全信任的人；只读链接不包含凭证，访客需配置自己的读取令牌。撤销授权会让使用同一令牌的链接一起失效。\n\n照片墙：拖动大头钉调整位置，也可聚焦大头钉后用方向键微调，Home 复位。位置仅保存在当前浏览器，不影响 TMDB 清单。\n\n演示：示意封面和修改都只用于本机预览，不会写入 TMDB。'});
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
    try{const invitation=parseInvite(hash);if(invitation&&await ask('导入共享账号','这个链接包含分享者的完整 TMDB 账号授权。导入后将以分享者身份操作，不是访客权限。是否替换当前标签页的连接？','导入并连接')){
      settings={readToken:invitation.readToken,listId:invitation.listId};auth={accessToken:invitation.accessToken,accountId:invitation.accountId};saveSettings();session.set('cinema-tmdb-auth',auth);session.remove('cinema-tmdb-request');
    }}catch(e){notice('无法导入共享链接：'+e.message);render();return;}
  }
  const state=new URLSearchParams(location.search).get('tmdb_auth');
  if(state){const url=new URL(location.href);url.searchParams.delete('tmdb_auth');url.searchParams.delete('request_token');url.searchParams.delete('approved');history.replaceState(null,'',url.href);await operation(()=>finishLogin(state));}
  else await load();
}
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#access='))start();});
start();

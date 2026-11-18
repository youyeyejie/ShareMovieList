import {parseDoubanFile} from './douban-file.js';
import {types,safeUrl} from './data.js';
import {lookupTMDB} from './tmdb.js';
import {Repository,pinColor,segment} from './repository.js';
import {photoPose,initBoard} from './wall.js';
import {ask,showMessage} from './dialog.js';
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const config=window.CINEMA_CONFIG;
let repo=new Repository(config), login='', list=params.get('list') || '', movies=[], filter='all', editing=null;
let pending=false,loading=false,version=0,lookupController,source={};
if(location.hash.startsWith('#access='))history.replaceState(null,'',location.pathname+location.search);
let draftList='', saving=false, retryId=null;
let albumPage=1,albumTotalPages=1;
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));


const toast=msg=>{$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6500);};
const notice=msg=>{$('#notice').textContent=msg;$('#notice').hidden=!msg;};
const open=id=>{if(!$(id).open)$(id).showModal();};

function settingsDialog(){
  if(saving)return toast('正在提交修改，请稍后切换账号');
  $('#auth-status').textContent=login?login+(repo.writer?' · 可编辑':' · 只读'):'公开浏览';
  $('#settings-form').elements.token.value=repo.token;
  $('#settings-form').elements.tmdbToken.value=localStorage.getItem('cinema.tmdb')||'';
  open('#settings');
}
function editable(){
  if(saving){toast('正在提交上一项修改');return false;}
  if(repo.writer)return true;
  settingsDialog();return false;
}
function selectLists(names){
  $('#list-select').textContent=list||'选择清单';
  const options=names.map(name=>{
    const button=document.createElement('button');
    button.textContent=name;button.value=name;button.setAttribute('aria-current',String(name===list));
    button.onclick=()=>{if(!pending&&!saving){$('#list-picker').open=false;changeList(name);}};
    return button;
  });
  $('#list-options').replaceChildren(...options);
}
async function load(){
  if(saving)return;
  const current=++version;loading=true;
  try{
    const catalog=await repo.catalog();
      if(current!==version)return;
      const names=catalog.tree.filter(e=>e.type==='tree'&&/^lists\/[^/.][^/]*$/.test(e.path)).map(e=>e.path.slice(6));
      if(draftList && !names.includes(draftList))names.push(draftList);
      if(list && !names.includes(list))list='';
      list ||= names[0]||'';
      selectLists(names);
      const records=list?await repo.movies(catalog,list):[];
      if(current!==version)return;
      movies=records;
    notice(!list?'仓库暂无片单，有写权限的成员可在清单菜单中创建。':'');
    render();
  }catch(e){if(current===version)notice('读取 GitHub 片单失败：'+e.message);}
  finally{if(current===version){loading=false;$('#connection').textContent=login||'公开浏览';}}
}
function card(m,index,inAlbum=false){
  const pose=photoPose(index,inAlbum)+';--pin-color:'+pinColor(m.createdBy);
  return `<article class="photo${safeUrl(m.cover)?'':' memo'}${inAlbum?' album-photo':''}" data-movie-id="${escape(m.id)}" style="${pose}">${inAlbum?'':`<button class="pushpin" type="button" aria-label="移动《${escape(m.title||'未命名作品')}》" title="拖动照片调整位置；方向键微调，Home 复位"></button>`}<button class="photo-open" data-open="${escape(m.id)}" aria-label="查看${escape(m.title||'未命名作品')}">${safeUrl(m.cover)?`<img class="photo-image" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title||'未命名作品')}封面" loading="lazy" referrerpolicy="no-referrer">`:''}<div class="photo-info"><h3>${escape(m.title||'未命名作品')}</h3><div class="photo-meta"><span>${escape(m.year)}${m.year?' · ':''}${types[m.type]||'其他'}</span>${m.rating!==''&&m.rating!=null?`<span class="rating">★ ${escape(m.rating)} ${escape(m.ratingSource)}</span>`:''}</div><p class="photo-note">${escape(m.note||m.overview||'')}</p></div></button><div class="photo-bottom"><span>${escape(m.createdBy||'未记录添加者')}</span><button class="watch-button" data-watch="${escape(m.id)}">${m.watched?'↶ 放回照片墙':'✓ 看过了'}</button></div></article>`;
}
function wireCards(root){root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>detail(el.dataset.open));root.querySelectorAll('[data-watch]').forEach(el=>el.onclick=()=>mutate(el.dataset.watch,'watch'));root.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.closest('.photo').classList.add('memo');img.remove();});}
let deferredRender=false;
$('#wall').addEventListener('board-release',()=>{
  if(deferredRender){deferredRender=false;setTimeout(render,0);}
});
function render(){
  if($('#wall').dataset.pressed){deferredRender=true;return;}
  const query=$('#search').value.trim().toLowerCase();const waiting=movies.filter(m=>!m.watched);const visible=waiting.filter(m=>(filter==='all'||m.type===filter)&&`${m.title} ${m.note} ${m.year}`.toLowerCase().includes(query));
  $('#total-count').textContent=waiting.length;$('#album-count').textContent=`${movies.filter(m=>m.watched).length} 个共同的片刻 ↗`;
  const columns=innerWidth<=600?2:innerWidth<=850?3:innerWidth<=1100?4:innerWidth<1400?5:6;
  const wall=$('#wall');wall.style.setProperty('--columns',columns);
  wall.innerHTML=visible.length?'<div class="board-grid">'+visible.map((m,i)=>card(m,i)).join('')+'</div>':`<div class="empty"><p>${query?'没有找到这个故事。':filter!=='all'?'暂时没有这个类型的作品。':'照片墙还空着。'}</p>${!query&&filter==='all'?'<button class="primary" id="empty-add">添加作品</button>':''}</div>`;
  $('#empty-add')?.addEventListener('click',()=>editor());
  wireCards(wall);renderAlbum();initBoard(wall,{key:list});
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
const fields=['title','year','cover','url','rating','ratingSource','overview','type','note'];
const form=$('#movie-form');
function editor(movie=null){
  if(!editable())return;
  if(!list)return open('#new-list-dialog');
  retryId=null;editing=movie;source={tmdb:movie?.tmdb||'',fetchedAt:movie?.fetchedAt||''};
  form.reset();
  for(const key of fields)form.elements[key].value=movie?.[key]??(key==='type'?'movie':'');
  $('#lookup-results').replaceChildren();
  $('#editor-title').textContent=movie?'编辑作品':'添加作品';
  form.querySelector('[type=submit]').textContent='保存并提交';
  open('#editor');
}
function detail(id){const m=movies.find(m=>m.id===id);if(!m)return;
  $('#detail-content').innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">${m.watched?'A COLLECTED MOMENT':'ON OUR WATCHLIST'}</p><h2>${escape(m.title||'未命名作品')}</h2></div><button class="close" data-close aria-label="关闭">×</button></div>${safeUrl(m.cover)?`<img class="detail-cover" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title||'未命名作品')}" referrerpolicy="no-referrer">`:''}<p class="hint">${types[m.type]||'其他'} · ${escape(m.year||'年份未填写')}${m.rating!==''&&m.rating!=null?` · ${escape(m.ratingSource||'评分')} ${escape(m.rating)}`:''}</p><p class="detail-note">${escape(m.note||m.overview)}</p><div class="detail-actions">${m.url?`<a class="secondary" href="${escape(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer">作品页面 ↗</a>`:''}<button class="primary" id="detail-watch">${m.watched?'放回照片墙':'标记已看'}</button><button class="secondary" id="detail-edit">编辑</button><button class="secondary danger" id="detail-delete">移除</button></div>`;
  $('#detail-watch').onclick=()=>mutate(m.id,'watch');$('#detail-edit').onclick=()=>{if(editable()){$('#detail').close();editor(m);}};$('#detail-delete').onclick=()=>mutate(m.id,'delete');$('#detail-content img')?.addEventListener('error',e=>e.target.remove());open('#detail');
}
async function operation(task){
  if(pending)return;pending=true;document.body.classList.add('busy');
  const controls=[...document.querySelectorAll('dialog[open] button')].map(button=>({button,disabled:button.disabled}));
  controls.forEach(({button})=>button.disabled=true);
  try{await task();}catch(e){await showMessage({title:'操作未完成',message:e.message});}
  finally{pending=false;document.body.classList.remove('busy');controls.forEach(({button,disabled})=>{if(button.isConnected)button.disabled=disabled;});updateAlbumControls();}
}
// A single in-flight write preserves GitHub's SHA ordering. Reading details,
// filtering and dragging remain available while the request is in flight.
async function saveInBackground(movie, previous, action){
  if(saving)return;
  const snapshot=movies;
  const targetList=list;
  saving=true;
  ++version;
  loading=false;
  movies=action==='delete' ? movies.filter(item=>item.id!==movie.id)
    : previous ? movies.map(item=>item.id===movie.id?movie:item) : [movie,...movies];
  $('#editor').close();$('#detail').close();
  $('#connection').textContent='正在提交…';
  render();
  try{
    const saved=await repo.commit(targetList,movie,action==='delete');
    if(action!=='delete')movies=movies.map(item=>item.id===movie.id?saved:item);
    if(draftList===targetList)draftList='';
    toast('已提交到 GitHub');
  }catch(error){
    movies=snapshot;
    $('#detail').close();
    render();
    await showMessage({title:'提交未确认',message:error.message+(action==='edit'?'。草稿已保留，可继续编辑。':'。已恢复原来的显示。')});
    if(action==='edit'){
      saving=false;
      editor(previous);
      retryId=movie.id;
      for(const key of fields)form.elements[key].value=movie[key]??'';
      source={tmdb:movie.tmdb||'',fetchedAt:movie.fetchedAt||''};
    }
  }finally{
    saving=false;
    $('#connection').textContent=login||'公开浏览';
    render();
  }
}
async function mutate(id,action){
  if(pending||loading||!editable())return;
  const previous=movies.find(item=>item.id===id);
  if(!previous)return;
  if(action==='delete'&&!await ask('移除作品',`要移除《${previous.title}》吗？`,'移除',true))return;
  const movie=action==='delete'?previous:{...previous,watched:!previous.watched};
  void saveInBackground(movie,previous,action);
}
form.onsubmit=event=>{
  event.preventDefault();
  if(pending||loading||!editable())return;
  const changes=Object.fromEntries(fields.map(key=>[key,form.elements[key].value.trim()]));
  const movie={watched:false,createdBy:repo.writer,...editing,...changes,
    id:editing?.id||retryId||`lists/${list}/${crypto.randomUUID()}.json`,
    tmdb:source.tmdb,fetchedAt:source.fetchedAt};
  void saveInBackground(movie,editing,'edit');
};
async function lookup(){
  const box=$('#lookup-results');
  const url=form.elements.url.value.trim();
  const linked=url.match(/^https:\/\/www\.themoviedb\.org\/((?:movie|tv)\/\d+)/)?.[1];
  const title=form.elements.title.value.trim();
  const knownId=linked||source.tmdb;
  const refresh=knownId && (!title || title===source.lookupTitle || (!source.lookupTitle && title===editing?.title));
  const mode=refresh?'detail':'search';
  const query=refresh?knownId:title;
  if(!query){box.textContent='请先填写片名。';return;}
  lookupController?.abort();const controller=lookupController=new AbortController();
  box.textContent='正在查询资料，可继续手动填写…';
  try{
    const results=await lookupTMDB(mode,query,localStorage.getItem('cinema.tmdb'),controller.signal);
    if(controller.signal.aborted)return;
    box.textContent=results.length?'选择资料填入草稿，核对后保存。':'没有匹配作品，可继续手动填写。';
    for(const item of results){
      const button=document.createElement('button');button.type='button';button.className='lookup-result';
      button.textContent=[item.title,item.year,types[item.type],item.ratingSource].filter(Boolean).join(' · ');
      button.onclick=()=>{
        for(const key of ['title','year','cover','url','overview','rating','ratingSource','type']){
          if(item[key]!==undefined)form.elements[key].value=item[key];
        }
        source={tmdb:item.tmdb||'',lookupTitle:item.title,fetchedAt:new Date().toISOString()};
        box.textContent='资料已填入，可修改后保存。';
      };
      box.append(button);
    }
  }catch(e){if(!controller.signal.aborted)box.textContent=e.message;}
}
const filePicker=$('#douban-file');
$('#import-douban').onclick=()=>filePicker.click();
filePicker.onchange=async()=>{
  const file=filePicker.files[0];
  filePicker.value='';
  if(!file)return;
  lookupController?.abort();
  const controller=lookupController=new AbortController();
  try{
    const data=parseDoubanFile(await file.text());
    if(controller.signal.aborted)return;
    for(const field of ['title','url','cover','year','overview','rating','type']){
      form.elements[field].value=data[field]??'';
    }
    form.elements.ratingSource.value=data.rating?'豆瓣':'';
    source={tmdb:'',fetchedAt:new Date().toISOString()};
    $('#lookup-results').textContent='已读取豆瓣页面，可核对后保存。';
  }catch(error){
    if(!controller.signal.aborted)$('#lookup-results').textContent=error.message;
  }
};
$('#lookup').onclick=lookup;
form.elements.title.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();lookup();}};
$('#editor').addEventListener('close',()=>lookupController?.abort());
$('#save-tmdb').onclick=()=>{
  const value=$('#settings-form').elements.tmdbToken.value.trim();
  if(value)localStorage.setItem('cinema.tmdb',value);
  else localStorage.removeItem('cinema.tmdb');
  $('#settings').close();toast(value?'TMDB 设置已保存':'TMDB 令牌已清除');
};
$('#settings-form').onsubmit=e=>{
  e.preventDefault();
  operation(async()=>{
    const candidate=new Repository(config,e.target.elements.token.value.trim());
    if(!candidate.token)throw Error('请输入 GitHub 令牌');
    const identity=await candidate.identity();
    repo=candidate;login=identity;
    localStorage.setItem('cinema.github',candidate.token);
    $('#settings').close();await load();toast(repo.writer?'已验证，可编辑':'已验证，只读权限');
  });
};
$('#logout').onclick=()=>{
  localStorage.removeItem('cinema.github');repo=new Repository(config);login='';
  $('#settings-form').elements.token.value='';$('#settings').close();load();
};
$('#new-list').onclick=()=>{
  $('#list-picker').open=false;
  if(editable())open('#new-list-dialog');
};
$('#new-list-form').onsubmit=e=>{
  e.preventDefault();
  operation(async()=>{
    const name=segment(e.target.elements.newList.value.trim());
    if([...$('#list-options').children].some(o=>o.value===name))throw Error('清单已存在');
    draftList=name;e.target.reset();$('#new-list-dialog').close();await changeList(name);editor();
  });
};
document.addEventListener('click',e=>{if(!e.target.closest('#list-picker'))$('#list-picker').open=false;});
$('#list-picker').onkeydown=e=>{if(e.key==='Escape'){$('#list-picker').open=false;$('#list-select').focus();}};
async function changeList(name){
  list=name;movies=[];albumPage=1;render();
  const url=new URL(location.href);url.searchParams.set('list',name);history.replaceState(null,'',url);
  await load();
}

$('#repo-link').href='https://github.com/'+config.repository;
document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))e.target.closest('dialog').close();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#settings-button').onclick=settingsDialog;$('#add-button').onclick=()=>{if(!pending&&!loading)editor();};$('#search').oninput=render;$('#album-button').onclick=()=>{renderAlbum();open('#album');};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>(x.classList.toggle('active',x===b),x.setAttribute('aria-pressed',String(x===b))));render();});
$('#album-search').oninput=()=>{albumPage=1;renderAlbum();};
$('#album-prev').onclick=()=>{if(albumPage>1){albumPage--;renderAlbum();$('#album').scrollTop=0;}};
$('#album-next').onclick=()=>{if(albumPage<albumTotalPages){albumPage++;renderAlbum();$('#album').scrollTop=0;}};
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);});
window.addEventListener('focus',()=>{if(!loading&&!pending&&!document.querySelector('dialog[open]'))load();});
async function initialize(){
  const token=localStorage.getItem('cinema.github');
  let warning='';
  if(token){
    const candidate=new Repository(config,token);
    try{login=await candidate.identity();repo=candidate;}
    catch(error){
      if(error.status===401)localStorage.removeItem('cinema.github');
      warning='GitHub 自动连接失败：'+error.message;
    }
  }
  await load();
  if(warning)notice(warning);
}
initialize();

import {coverFile,isDoubanCover} from './cover.js';
import {parseExtensionMarkup} from './extension-markup.js';
import {types,safeUrl} from './data.js';
import {lookupTMDB,lookupSummary} from './tmdb.js';
import {Repository,pinColor,segment} from './repository.js';
import {photoPose,initBoard} from './wall.js';
import {ask,showMessage} from './dialog.js';
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const config=window.CINEMA_CONFIG;
let repo=new Repository(config), login='', list=params.get('list') || '', movies=[], filter='all', editing=null;
let pending=false,loading=false,version=0,lookupController,source={};
if(location.hash.startsWith('#access='))history.replaceState(null,'',location.pathname+location.search);
let listCatalog=null;
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
  $('#refresh').disabled=true;
  try{
    const catalog=await repo.catalog();
      if(current!==version)return;
      const names=catalog.tree.filter(e=>e.type==='tree'&&/^lists\/[^/.][^/]*$/.test(e.path)).map(e=>e.path.slice(6));
      if(draftList && !names.includes(draftList))names.push(draftList);
      if(list && !names.includes(list))list='';
      list ||= names[0]||'';
      listCatalog=catalog;
      selectLists(names);
      const records=list?await repo.movies(catalog,list):[];
      if(current!==version)return;
      movies=records;
    notice(!list?'仓库暂无片单，有写权限的成员可在清单菜单中创建。':'');
    render();
    return true;
  }catch(e){if(current===version)notice('读取 GitHub 片单失败：'+e.message);}
  finally{if(current===version){loading=false;$('#refresh').disabled=saving;$('#connection').textContent=login||'公开浏览';}}
}
function watchAction(watched){
  const label=watched?'钉回片单墙':'收进相册';
  const icon=watched?'pin':'album';
  return `<img class="action-glyph" src="./assets/${icon}.svg" alt="">${label}`;
}
function card(m,index,inAlbum=false){
  const pose=photoPose(index,inAlbum)+';--pin-color:'+pinColor(m.createdBy);
  return `<article class="photo${safeUrl(m.cover)?'':' memo'}${inAlbum?' album-photo':''}" data-movie-id="${escape(m.id)}" style="${pose}">${inAlbum?'':`<button class="pushpin" type="button" aria-label="移动《${escape(m.title||'未命名作品')}》" title="拖动照片调整位置；方向键微调，Home 复位"></button>`}<button class="photo-open" data-open="${escape(m.id)}" aria-label="查看${escape(m.title||'未命名作品')}">${safeUrl(m.cover)?`<img class="photo-image" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title||'未命名作品')}封面" loading="lazy" referrerpolicy="no-referrer">`:''}<div class="photo-info"><h3>${escape(m.title||'未命名作品')}</h3><div class="photo-meta"><span>${escape(m.year)}${m.year?' · ':''}${types[m.type]||'其他'}</span>${m.rating!==''&&m.rating!=null?`<span class="rating">★ ${escape(m.rating)} ${escape(m.ratingSource)}</span>`:''}</div><p class="photo-note">${escape(m.note||m.overview||'')}</p></div></button><div class="photo-bottom"><span class="creator" title="${escape(m.createdBy||'未记录添加者')}">${escape(m.createdBy||'未记录添加者')}</span><button class="watch-button" data-watch="${escape(m.id)}">${watchAction(m.watched)}</button></div></article>`;
}
function wireCards(root){root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>detail(el.dataset.open));root.querySelectorAll('[data-watch]').forEach(el=>el.onclick=()=>mutate(el.dataset.watch,'watch'));root.querySelectorAll('.photo-image').forEach(img=>img.onerror=()=>{img.closest('.photo').classList.add('memo');img.remove();});}
let deferredRender=false;
$('#wall').addEventListener('board-release',()=>{
  if(deferredRender){deferredRender=false;setTimeout(render,0);}
});
function render(){
  if($('#wall').dataset.pressed){deferredRender=true;return;}
  const query=$('#search').value.trim().toLowerCase();const waiting=movies.filter(m=>!m.watched);const visible=waiting.filter(m=>(filter==='all'||(Object.hasOwn(types,m.type)?m.type:'other')===filter)&&`${m.title} ${m.note} ${m.year}`.toLowerCase().includes(query));
  $('#random-movie').disabled=!waiting.length;
  const counts={all:waiting.length};
  for(const movie of waiting){const key=Object.hasOwn(types,movie.type)?movie.type:'other';counts[key]=(counts[key]||0)+1;}
  for(const button of document.querySelectorAll('[data-filter]')){
    const badge=button.querySelector('span'),count=counts[button.dataset.filter]||0;
    badge.hidden=count===0;badge.textContent=count||'';
  }
  $('#album-count').textContent=`已看 ${movies.filter(m=>m.watched).length} 部`;
  const columns=innerWidth<=600?2:innerWidth<=850?3:innerWidth<=1100?4:innerWidth<1400?5:6;
  const wall=$('#wall');wall.style.setProperty('--columns',columns);
  wall.innerHTML=visible.length?'<div class="board-grid">'+visible.map((m,i)=>card(m,i)).join('')+'</div>':`<div class="empty"><p>${query?'没有找到这个故事。':filter!=='all'?'暂时没有这个类型的作品。':'片单墙还空着。'}</p>${!query&&filter==='all'?'<button class="primary" id="empty-add">添加作品</button>':''}</div>`;
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
  $('#album-results').textContent=query?`找到 ${matches.length} 部，共 ${seen.length} 部`:`已看 ${seen.length} 部`;
  $('#album-grid').innerHTML=visible.length?visible.map((m,i)=>card(m,(albumPage-1)*pageSize+i,true)).join(''):`<p class="empty">${query?'相册里没有找到这个故事，换个关键词试试。':'相册的第一页，等我们一起写。'}</p>`;
  wireCards($('#album-grid'));updateAlbumControls();
}
let attachment=null;
const fields=['title','year','cover','url','rating','ratingSource','overview','type','note'];
const form=$('#movie-form');
function editor(movie=null){
  if(!editable())return;
  if(!list)return open('#new-list-dialog');
  $('#copy-from').hidden=Boolean(movie);
  retryId=null;editing=movie;source={tmdb:movie?.tmdb||'',fetchedAt:movie?.fetchedAt||''};
  form.reset();
  attachment=null;
  showCoverName('');$('#cover-status').textContent='';
  for(const key of fields)form.elements[key].value=movie?.[key]??(key==='type'?'movie':'');
  $('#lookup-results').replaceChildren();
  $('#editor-title').textContent=movie?'编辑作品':'添加作品';
  form.querySelector('[type=submit]').textContent='保存并提交';
  open('#editor');
  if(!movie && importPending){
    importPending=false;
    $('#lookup-results').textContent='正在读取豆瓣草稿…';
    importButton.click();
  }
}
function detail(id){const m=movies.find(m=>m.id===id);if(!m)return;
  $('#detail-content').innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">${m.watched?'A COLLECTED MOMENT':'ON OUR WATCHLIST'}</p><h2>${escape(m.title||'未命名作品')}</h2></div><button class="close" data-close aria-label="关闭">×</button></div>${safeUrl(m.cover)?`<img class="detail-cover" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title||'未命名作品')}" referrerpolicy="no-referrer">`:''}<p class="hint">${types[m.type]||'其他'} · ${escape(m.year||'年份未填写')}${m.rating!==''&&m.rating!=null?` · ${escape(m.ratingSource||'评分')} ${escape(m.rating)}`:''}</p><p class="detail-note">${escape(m.note||m.overview)}</p><div class="detail-actions">${m.url?`<a class="secondary" href="${escape(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer">作品页面 ↗</a>`:''}<button class="primary" id="detail-watch">${watchAction(m.watched)}</button><button class="secondary" id="detail-edit">编辑</button><button class="secondary" id="detail-move">移动</button><button class="secondary danger" id="detail-delete">移除</button></div>`;
  $('#detail-move').onclick=()=>{if(editable())openTransfer(m);};
  $('#detail-watch').onclick=()=>mutate(m.id,'watch');$('#detail-edit').onclick=()=>{if(editable()){$('#detail').close();editor(m);}};$('#detail-delete').onclick=()=>mutate(m.id,'delete');$('#detail-content .detail-cover')?.addEventListener('error',e=>e.target.remove());open('#detail');
}
let movingMovie=null;
let sourceRecords=[];
let readVersion=0;
const transferList=$('#transfer-list');
function openTransfer(movie=null){
  movingMovie=movie;
  const names=[...$('#list-options').children].map(button=>button.value).filter(name=>name!==list && name!==draftList);
  transferList.replaceChildren(...names.map(name=>new Option(name,name)));
  $('#transfer-title').textContent=movie?'移动《'+(movie.title||'未命名作品')+'》':'从清单添加';
  $('#transfer-label').textContent=movie?'移至清单':'来源清单';
  $('#copy-search').hidden=Boolean(movie)||!names.length;
  $('#confirm-move').hidden=!movie||!names.length;
  transferList.hidden=!names.length;
  $('#transfer-label').hidden=!names.length;
  $('#transfer-search').value='';
  $('#transfer-status').textContent=names.length?'':'暂无其他清单';
  open('#transfer');
  if(names.length&&!movie)readSource();
}
function renderSource(){
  const query=$('#transfer-search').value.trim().toLowerCase();
  const results=$('#transfer-results');
  results.replaceChildren();
  for(const movie of sourceRecords){
    if(![movie.title,movie.year,movie.note].join(' ').toLowerCase().includes(query))continue;
    const button=document.createElement('button');
    button.type='button';button.className='list-choice';
    button.textContent=[movie.title||'未命名作品',movie.year,movie.watched?'已看':'待看'].filter(Boolean).join(' · ');
    button.disabled=movies.some(existing=>(movie.tmdb && existing.tmdb===movie.tmdb)||(movie.url && existing.url===movie.url));
    if(button.disabled)button.textContent+=' · 已在当前清单';
    button.onclick=()=>{
      lookupController?.abort();
      for(const field of fields)form.elements[field].value=movie[field]??(field==='type'?'other':'');
      source={tmdb:movie.tmdb||'',lookupTitle:movie.title,fetchedAt:movie.fetchedAt||''};
      attachment=null;showCoverName('');$('#cover-file').value='';$('#cover-status').textContent='';
      $('#lookup-results').textContent='已填入作品资料，保存后加入「'+list+'」。';
      $('#transfer').close();
    };
    results.append(button);
  }
  $('#transfer-status').textContent=results.children.length?'':query?'没有匹配的作品':'这份清单还没有作品';
}
async function readSource(){
  const version=++readVersion;
  sourceRecords=[];
  $('#transfer-results').replaceChildren();
  $('#transfer-status').textContent='正在读取作品…';
  try{
    const records=await repo.movies(listCatalog,transferList.value);
    if(version!==readVersion)return;
    sourceRecords=records;renderSource();
  }catch(error){if(version===readVersion)$('#transfer-status').textContent=error.message;}
}
$('#copy-from').onclick=()=>openTransfer();
transferList.onchange=()=>{if(!movingMovie)readSource();};
$('#transfer-search').oninput=renderSource;
$('#transfer').addEventListener('close',()=>{readVersion++;});
$('#confirm-move').onclick=()=>operation(async()=>{
  const target=transferList.value, movie=movingMovie;
  await repo.move(list,target,movie);
  movies=movies.filter(item=>item.id!==movie.id);
  $('#transfer').close();$('#detail').close();render();toast('已移动到「'+target+'」');
  await load();
});
async function operation(task){
  if(pending)return;pending=true;document.body.classList.add('busy');
  const controls=[...document.querySelectorAll('dialog[open] button')].map(button=>({button,disabled:button.disabled}));
  controls.forEach(({button})=>button.disabled=true);
  try{await task();}catch(e){await showMessage({title:'操作未完成',message:e.message});}
  finally{pending=false;document.body.classList.remove('busy');controls.forEach(({button,disabled})=>{if(button.isConnected)button.disabled=disabled;});updateAlbumControls();}
}
// A single in-flight write preserves GitHub's SHA ordering. Reading details,
// filtering and dragging remain available while the request is in flight.
async function saveInBackground(movie, previous, action, image=null){
  if(saving)return;
  const snapshot=movies;
  const targetList=list;
  saving=true;
  $('#refresh').disabled=true;
  ++version;
  loading=false;
  movies=action==='delete' ? movies.filter(item=>item.id!==movie.id)
    : previous ? movies.map(item=>item.id===movie.id?movie:item) : [movie,...movies];
  $('#editor').close();$('#detail').close();
  $('#connection').textContent='正在提交…';
  render();
  try{
    const saved=await repo.commit(targetList,movie,action==='delete',image);
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
      if(image)setAttachment(image);
      for(const key of fields)form.elements[key].value=movie[key]??'';
      source={tmdb:movie.tmdb||'',fetchedAt:movie.fetchedAt||''};
    }
  }finally{
    saving=false;
    $('#refresh').disabled=false;
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
  if(isDoubanCover(changes.cover)&&!attachment){
    showMessage({title:'需要封面文件',message:'请选择本地封面图片，或清空封面地址保存为便笺。'});return;
  }
  const movie={watched:false,createdBy:repo.writer,...editing,...changes,
    id:editing?.id||retryId||`lists/${list}/${crypto.randomUUID()}.json`,
    tmdb:source.tmdb,fetchedAt:source.fetchedAt};
  void saveInBackground(movie,editing,'edit',attachment);
};
function lookupLabel(item, directors=[], countries=item.countries){
  const names=directors.slice(0,2).join('、')+(directors.length>2?'等':'');
  return [item.title,item.year,names,countries,types[item.type]].filter(Boolean).join(' · ');
}
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
    const token=localStorage.getItem('cinema.tmdb');
    const results=await lookupTMDB(mode,query,token,controller.signal);
    if(controller.signal.aborted)return;
    box.textContent=results.length?'':'没有匹配作品，可继续手动填写。';
    const credits=[];
    for(const item of results){
      const button=document.createElement('button');button.type='button';button.className='lookup-result';
      button.textContent=lookupLabel(item);
      credits.push({item,button});
      button.onclick=()=>{
        controller.abort();
        attachment=null;$('#cover-file').value='';showCoverName('');$('#cover-status').textContent='';
        for(const key of ['title','year','cover','url','overview','rating','ratingSource','type']){
          if(item[key]!==undefined)form.elements[key].value=item[key];
        }
        source={tmdb:item.tmdb||'',lookupTitle:item.title,fetchedAt:new Date().toISOString()};
        box.textContent='资料已填入，可修改后保存。';
      };
      box.append(button);
    }
    // Results remain selectable while up to three credit requests run.
    async function fillCredits(){
      while(credits.length&&!controller.signal.aborted){
        const {item,button}=credits.shift();
        try{
          const summary=await lookupSummary(item.tmdb,token,controller.signal);
          if(controller.signal.aborted)return;
          button.textContent=lookupLabel(item,summary.directors,summary.countries||item.countries);
        }catch{
          // The existing label is complete even when credits are unavailable.
        }
      }
    }
    await Promise.all(Array.from({length:Math.min(3,credits.length)},fillCredits));
  }catch(e){if(!controller.signal.aborted)box.textContent=e.message;}
}
function showCoverName(name){
  const label=$('#cover-name');
  label.textContent=name;
  label.title=name;
}
function setAttachment(image){
  attachment=image;
  form.elements.cover.value='';
  showCoverName(image.name || ('豆瓣封面.'+image.ext));
  $('#cover-status').textContent='';
}
function applyDouban(data,image){
  for(const field of ['title','url','year','overview','rating','type'])form.elements[field].value=data[field]??'';
  form.elements.ratingSource.value=data.rating?'豆瓣':'';
  source={tmdb:'',fetchedAt:new Date().toISOString()};
  attachment=null;
  form.elements.cover.value=editing?.cover && !isDoubanCover(editing.cover)?editing.cover:'';
  showCoverName('');$('#cover-status').textContent='';
  if(image)setAttachment(image);
  $('#lookup-results').textContent='已读取豆瓣资料，核对后保存。';
}
form.elements.cover.oninput=()=>{attachment=null;$('#cover-file').value='';showCoverName('');$('#cover-status').textContent='';};
$('#pick-cover').onclick=()=>$('#cover-file').click();
$('#cover-file').onchange=async event=>{
  const file=event.target.files[0];
  if(!file)return;
  try{
    if(file.size>4*1024*1024)throw Error('封面超过 4 MB');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const chunks=[];
    for(let start=0;start<bytes.length;start+=32768){
      chunks.push(String.fromCharCode(...bytes.subarray(start,start+32768)));
    }
    const encoded=btoa(chunks.join(''));
    setAttachment({...coverFile(encoded),name:file.name});
  }catch(error){event.target.value='';$('#cover-status').textContent=error.message;}
};
const importId=location.hash.match(/^#douban-import=([a-f0-9-]{36})$/)?.[1];
let importPending=Boolean(importId);
function resumeImport(){
  if(!importPending)return;
  if(!repo.writer){settingsDialog();return;}
  editor();
}
const importButton=$('#extension-draft');
let importTimer;
function finishImport(){
  clearTimeout(importTimer);
  importTimer=null;
}
importButton.onclick=()=>{
  if(!importId){
    showMessage({title:'从扩展读取',message:'在豆瓣作品页打开「等空一起看」扩展并点击「导入到片单」，片单页会自动打开「添加作品」并读取草稿。'});
    return;
  }
  finishImport();
  importTimer=setTimeout(()=>{
    finishImport();
    $('#lookup-results').textContent='扩展未响应，请回到豆瓣作品页重新导入。';
  },5000);
  window.postMessage({type:'cinema-request-import',id:importId},location.origin);
};
$('#editor').addEventListener('close',finishImport);
window.addEventListener('message',event=>{
  if(!importTimer||!$('#editor').open||event.source!==window||event.origin!==location.origin||
      event.data?.type!=='cinema-import'||event.data.id!==importId)return;
  finishImport();
  try{
    const draft=event.data.payload;
    if(!draft?.html)throw Error('草稿已过期，请回到豆瓣重新导入。');
    const parsed=parseExtensionMarkup(draft.html);
    let image=null;
    try{if(draft.image)image=coverFile(draft.image);}catch{/* Allow a local replacement. */}
    lookupController?.abort();
    applyDouban(parsed,image);
  }catch(error){showMessage({title:'无法导入',message:error.message});}
});
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
    if(!candidate.token){
      localStorage.removeItem('cinema.github');
      repo=candidate;login='';
      $('#settings').close();await load();toast('已断开 GitHub 连接');
      return;
    }
    const identity=await candidate.identity();
    repo=candidate;login=identity;
    localStorage.setItem('cinema.github',candidate.token);
    $('#settings').close();
    const loaded=await load();
    toast(repo.writer?'已验证，可编辑':'已验证，只读权限');
    if(loaded && repo.writer)resumeImport();
  });
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
$('#random-movie').onclick=()=>{
  const candidates=movies.filter(movie=>!movie.watched);
  if(candidates.length)detail(candidates[Math.floor(Math.random()*candidates.length)].id);
};
$('#refresh').onclick=async()=>{
  if(!loading&&!saving&&await load())toast('片单已刷新');
};
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
  const loaded=await load();
  if(warning)notice(warning);
  if(loaded || !repo.writer)resumeImport();
}
initialize();

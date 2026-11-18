import {types,safeUrl,demoMovies} from './data.js';
import {Repository,pinColor,segment} from './repository.js';
import {photoPose,initBoard} from './wall.js';
import {ask,showMessage} from './dialog.js';
const $=s=>document.querySelector(s);
const session={get(k,f){try{return JSON.parse(sessionStorage.getItem(k))??f;}catch{return f;}},set(k,v){sessionStorage.setItem(k,JSON.stringify(v));},remove(k){sessionStorage.removeItem(k);}};
const params=new URLSearchParams(location.search), demo=params.get('demo')==='1';
const config=window.CINEMA_CONFIG;
let repo=new Repository(config), login='', list=params.get('list') || '', movies=[], filter='all', editing=null;
let pending=false,loading=false,version=0,lookupController,source={};
if(location.hash.startsWith('#access='))history.replaceState(null,'',location.pathname+location.search);
session.remove('cinema-tmdb-auth');session.remove('cinema-tmdb');session.remove('cinema-tmdb-request');
let albumPage=1,albumTotalPages=1;
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const isDemo=()=>demo;
const toast=msg=>{$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6500);};
const notice=msg=>{$('#notice').textContent=msg;$('#notice').hidden=!msg;};
const open=id=>{if(!$(id).open)$(id).showModal();};
function persist(){session.set('cinema-tmdb-demo',movies);}
function settingsDialog(){
  $('#auth-status').textContent=demo?'本机演示':login?login+(repo.writer?' · 可编辑':' · 只读'):'公开浏览';
  $('#settings-form').elements.token.value='';
  open('#settings');
}
function editable(){
  if(demo || repo.writer)return true;
  settingsDialog();return false;
}
function selectLists(names){
  const select=$('#list-select'); select.replaceChildren(...names.map(name=>new Option(name,name)));
  select.value=list;
}
async function load(){
  const current=++version;loading=true;$('#refresh').disabled=true;
  try{
    if(demo){
      list='演示';selectLists([list]);
      movies=session.get('cinema-tmdb-demo',demoMovies).map((m,i)=>({...m,createdBy:m.createdBy||['demo-alex','demo-lin','demo-yu'][i%3]}));
    }else{
      const catalog=await repo.catalog();
      if(current!==version)return;
      const names=catalog.tree.filter(e=>e.type==='tree'&&/^lists\/[^/.][^/]*$/.test(e.path)).map(e=>e.path.slice(6));
      if(list && !names.includes(list))throw Error('找不到片单 '+list);
      list ||= names[0]||'';
      selectLists(names);
      const records=list?await repo.movies(catalog,list):[];
      if(current!==version)return;
      movies=records;
    }
    notice(!demo&&!list?'仓库暂无片单，有写权限的成员可在设置中创建。':'');
    render();
  }catch(e){if(current===version)notice('读取 GitHub 片单失败：'+e.message);}
  finally{if(current===version){loading=false;$('#refresh').disabled=false;$('#connection').textContent=demo?'本机演示':login||'公开浏览';}}
}
function card(m,index,inAlbum=false){
  const pose=photoPose(index,inAlbum)+';--pin-color:'+pinColor(m.createdBy);
  return `<article class="photo${inAlbum?' album-photo':''}" data-movie-id="${escape(m.id)}" style="${pose}">${inAlbum?'':`<button class="pushpin" type="button" aria-label="移动《${escape(m.title||'未命名作品')}》" title="拖动调整位置；方向键微调，Home 复位"></button>`}<button class="photo-open" data-open="${escape(m.id)}" aria-label="查看${escape(m.title||'未命名作品')}">${m.cover?`<img class="photo-image" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title||'未命名作品')}封面" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cover-empty"><span>${escape(m.title||'未命名作品')}</span><small>WAITING FOR A STORY</small></div>`}<div class="photo-info"><h3>${escape(m.title||'未命名作品')}</h3><div class="photo-meta"><span>${escape(m.year)}${m.year?' · ':''}${types[m.type]||'其他'}</span>${m.rating!==''&&m.rating!=null?`<span class="rating">★ ${escape(m.rating)} ${escape(m.ratingSource)}</span>`:''}</div><p class="photo-note">${escape(m.note||'留一个晚上，给这个故事。')}</p></div></button><div class="photo-bottom"><span>${escape(m.createdBy||'未记录添加者')}</span><button class="watch-button" data-watch="${escape(m.id)}">${m.watched?'↶ 放回照片墙':'✓ 看过了'}</button></div></article>`;
}
function wireCards(root){root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>detail(el.dataset.open));root.querySelectorAll('[data-watch]').forEach(el=>el.onclick=()=>mutate(el.dataset.watch,'watch'));root.querySelectorAll('img').forEach(img=>img.onerror=()=>{const blank=document.createElement('div');blank.className='cover-empty';blank.innerHTML='<span>一段待看的故事</span><small>THE SHARED CINEMA</small>';img.replaceWith(blank);});}
function render(){
  const query=$('#search').value.trim().toLowerCase();const waiting=movies.filter(m=>!m.watched);const visible=waiting.filter(m=>(filter==='all'||m.type===filter)&&`${m.title} ${m.note} ${m.year}`.toLowerCase().includes(query));
  $('#total-count').textContent=waiting.length;$('#wall-count').textContent=`待放映 / ${String(visible.length).padStart(2,'0')}`;$('#album-count').textContent=`${movies.filter(m=>m.watched).length} 个共同的片刻 ↗`;
  const columns=innerWidth<=600?2:innerWidth<=850?3:innerWidth<=1100?4:innerWidth<1400?5:6;
  const wall=$('#wall');wall.style.setProperty('--columns',columns);
  wall.innerHTML=visible.length?'<div class="board-grid">'+visible.map((m,i)=>card(m,i)).join('')+'</div>':`<div class="empty"><p>${query?'没有找到这个故事。':filter!=='all'?'暂时没有这个类型的作品。':'照片墙还空着。'}</p>${!query&&filter==='all'?'<button class="primary" id="empty-add">添加作品</button>':''}</div>`;
  $('#empty-add')?.addEventListener('click',()=>editor());
  wireCards(wall);renderAlbum();requestAnimationFrame(()=>initBoard(wall,{key:demo?'demo':list}));
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
  if(!list)return settingsDialog();
  editing=movie;source={tmdb:movie?.tmdb||'',fetchedAt:movie?.fetchedAt||''};
  form.reset();
  for(const key of fields)form.elements[key].value=movie?.[key]??(key==='type'?'movie':'');
  $('#lookup-results').replaceChildren();
  $('#editor-title').textContent=movie?'编辑作品':'添加作品';
  $('#save-hint').textContent=demo?'本机演示':'保存会提交到 '+config.repository+' / '+list;
  form.querySelector('[type=submit]').textContent=demo?'保存':'保存并提交';
  open('#editor');
}
function detail(id){const m=movies.find(m=>m.id===id);if(!m)return;
  $('#detail-content').innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">${m.watched?'A COLLECTED MOMENT':'ON OUR WATCHLIST'}</p><h2>${escape(m.title||'未命名作品')}</h2></div><button class="close" data-close aria-label="关闭">×</button></div>${m.cover?`<img class="detail-cover" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title||'未命名作品')}" referrerpolicy="no-referrer">`:''}<p class="hint">${types[m.type]||'其他'} · ${escape(m.year||'年份未填写')}${m.rating!==''&&m.rating!=null?` · ${escape(m.ratingSource||'评分')} ${escape(m.rating)}`:''}</p><p class="detail-note">${escape(m.note||m.overview)}</p>${m.url?`<a class="secondary" href="${escape(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer">前往作品页面 ↗</a>`:''}<div class="detail-actions"><button class="primary" id="detail-watch">${m.watched?'放回照片墙':'✓ 标记已观看'}</button><button class="secondary" id="detail-edit">编辑</button><button class="secondary danger" id="detail-delete">移除</button></div>`;
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
    if(action==='delete'){
      if(!demo)await repo.commit(list,m,true);
      movies=movies.filter(x=>x.id!==id);
    }else{
      const updated={...m,watched:!m.watched};
      const saved=demo?updated:await repo.commit(list,updated);
      movies=movies.map(x=>x.id===id?saved:x);
    }
    if(demo)persist();$('#detail').close();render();toast(action==='delete'?'已从清单移除':m.watched?'已放回照片墙':'已收进我们的相册');
  });
}
form.onsubmit=async event=>{
  event.preventDefault();if(pending||loading||!editable())return;
  const changes=Object.fromEntries(fields.map(key=>[key,form.elements[key].value.trim()]));
  const movie={watched:false,...editing,...changes,...source};
  await operation(async()=>{
    const saved=demo?{...movie,id:movie.id||crypto.randomUUID(),createdBy:movie.createdBy||'demo-you'}:await repo.commit(list,movie);
    movies=editing?movies.map(m=>m.id===editing.id?saved:m):[saved,...movies];
    if(demo)persist();
    $('#editor').close();render();toast(demo?'已保存':'已提交到 GitHub');
  });
};
async function lookup(refresh){
  const box=$('#lookup-results');
  const url=form.elements.url.value.trim();
  let mode='search',query=form.elements.title.value.trim();
  if(refresh){
    if(/^https:\/\/movie\.douban\.com\/subject\/\d+\/?$/.test(url)){mode='douban';query=url;}
    else{
      mode='detail';query=url.match(/^https:\/\/www\.themoviedb\.org\/((?:movie|tv)\/\d+)/)?.[1]||source.tmdb;
      if(!query){box.textContent='请填写豆瓣或 TMDB 条目链接，或按片名搜索。';return;}
    }
  }
  if(!query){box.textContent='请先填写片名。';return;}
  lookupController?.abort();const controller=lookupController=new AbortController();
  box.textContent='正在查询资料，可继续手动填写…';
  try{
    const results=demo?demoMovies.filter(m=>m.title.includes(query)):await repo.lookup(mode,query,controller.signal);
    if(controller.signal.aborted)return;
    box.textContent=results.length?'选择资料填入草稿，核对后保存。':'没有匹配作品，可继续手动填写。';
    for(const item of results){
      const button=document.createElement('button');button.type='button';button.className='lookup-result';
      button.textContent=[item.title,item.year,types[item.type]].filter(Boolean).join(' · ');
      button.onclick=()=>{
        for(const key of ['title','year','cover','url','overview','rating','ratingSource','type']){
          if(item[key]!==undefined)form.elements[key].value=item[key];
        }
        source={tmdb:item.tmdb||'',fetchedAt:new Date().toISOString()};
        box.textContent='资料已填入，可修改后保存。';
      };
      box.append(button);
    }
  }catch(e){if(!controller.signal.aborted)box.textContent=e.message;}
}
$('#lookup').onclick=()=>lookup(false);
$('#refresh-meta').onclick=()=>lookup(true);
$('#editor').addEventListener('close',()=>lookupController?.abort());
$('#settings-form').onsubmit=e=>{
  e.preventDefault();if(demo)return toast('演示模式仅保存到本机');
  operation(async()=>{
    const candidate=new Repository(config,e.target.elements.token.value.trim());
    if(!candidate.token)throw Error('请输入 GitHub 令牌');
    const identity=await candidate.identity();
    repo=candidate;login=identity;e.target.elements.token.value='';
    $('#settings').close();await load();toast(repo.writer?'已验证，可编辑':'已验证，只读权限');
  });
};
$('#logout').onclick=()=>{repo=new Repository(config);login='';$('#settings').close();load();};
$('#create-list').onclick=()=>operation(async()=>{
  if(demo)throw Error('请在正式模式中创建仓库片单');
  const name=segment($('#settings-form').elements.newList.value.trim());
  if([...$('#list-select').options].some(o=>o.value===name))throw Error('清单已存在');
  await repo.createList(name);changeList(name);$('#settings').close();
});
function changeList(name){
  list=name;movies=[];albumPage=1;render();
  const url=new URL(location.href);url.searchParams.set('list',name);history.replaceState(null,'',url);
  load();
}
$('#list-select').onchange=e=>{if(pending){e.target.value=list;return;}changeList(e.target.value);};
$('#repo-link').href='https://github.com/'+config.repository;
document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))e.target.closest('dialog').close();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#settings-button').onclick=settingsDialog;$('#add-button').onclick=()=>{if(!pending&&!loading)editor();};$('#refresh').onclick=()=>{if(!pending)load();};$('#search').oninput=render;$('#album-button').onclick=()=>{renderAlbum();open('#album');};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>(x.classList.toggle('active',x===b),x.setAttribute('aria-pressed',String(x===b))));render();});
$('#album-search').oninput=()=>{albumPage=1;renderAlbum();};
$('#album-prev').onclick=()=>{if(albumPage>1){albumPage--;renderAlbum();$('#album').scrollTop=0;}};
$('#album-next').onclick=()=>{if(albumPage<albumTotalPages){albumPage++;renderAlbum();$('#album').scrollTop=0;}};
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);});
window.addEventListener('focus',()=>{if(!demo&&!loading&&!pending&&!document.querySelector('dialog[open]'))load();});
load();

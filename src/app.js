import {types, safeUrl, normalize, encodeMovie, decodeIssue, github, loadMovies, demoMovies} from './data.js';
const $ = s => document.querySelector(s);
const storage = {get(k,f){try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
let settings = {...(window.CINEMA_CONFIG || {}), ...storage.get('cinema-settings',{})};
if (new URLSearchParams(location.search).get('demo') === '1') settings.repository = '';
let token = '', movies = [], filter = 'all', editing = null, current = null, loading = false, pending = false, loadController;
const escape = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = msg => {$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4500);};
const isDemo = () => !settings.repository;
const notice = msg => {$('#notice').textContent=msg;$('#notice').hidden=!msg;};
function open(dialog){$(dialog).showModal();}
function settingsDialog(){if(pending){toast('请等待当前保存完成');return;}const f=$('#settings-form');f.elements.repository.value=settings.repository||'';f.elements.tmdbApiKey.value=settings.tmdbApiKey||'';f.elements.token.value=token;open('#settings');}
function editable(){if(isDemo()||token)return true;toast('请先连接具有该仓库 Issues 读写权限的 Token，即可在页面操作');settingsDialog();return false;}
function persist(){storage.set('cinema-demo',movies);}
async function load(){
  loadController?.abort();loadController=new AbortController();loading=true;$('#refresh').disabled=true;$('#connection').textContent='正在同步清单';
  try {
    if(isDemo()){movies=storage.get('cinema-demo',demoMovies);notice('本机演示 · 这些示例使用原创示意封面，修改仅保存在此浏览器。连接公开仓库，开始共享。');}
    else {movies=await loadMovies(settings.repository,token,loadController.signal);notice('');}
    render();$('#connection').textContent=isDemo()?'本机演示':token?'已连接 · 可直接编辑':'共享清单 · 只读';
  }catch(e){if(e.name==='AbortError')return;notice(`同步失败：${e.message} 当前保留上次加载内容。`);$('#connection').textContent='同步失败';}
  finally{loading=false;$('#refresh').disabled=false;}
  const link=$('#repository-link');link.hidden=isDemo();link.href=`https://github.com/${settings.repository}`;
}
function card(m,index,inAlbum=false){
  const rotation=[-3,2,-1.8,3,-2.2,1.5,2.6,-2][index%8];
  return `<article class="photo" style="--rotation:${rotation}deg">${inAlbum?'':'<span class="clip"></span>'}<button class="photo-open" data-open="${escape(m.id)}" aria-label="查看${escape(m.title)}">${m.cover?`<img class="photo-image" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title)}封面" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cover-empty"><span>${escape(m.title)}</span><small>WAITING FOR A STORY</small></div>`}<div class="photo-info"><h3>${escape(m.title)}</h3><div class="photo-meta"><span>${escape(m.year)}${m.year?' · ':''}${types[m.type]||'其他'}</span>${m.rating!==''&&m.rating!=null?`<span class="rating">★ ${escape(m.rating)} ${escape(m.ratingSource)}</span>`:''}</div><p class="photo-note">${escape(m.note||'留一个晚上，给这个故事。')}</p></div></button><div class="photo-bottom"><span>${isDemo()?'DEMO / 示意封面':escape(m.author||'我们的片单')}</span><button class="watch-button" data-watch="${escape(m.id)}">${m.watched?'↶ 放回绳子':'✓ 看过了'}</button></div></article>`;
}
function wireCards(root){root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>detail(el.dataset.open));root.querySelectorAll('[data-watch]').forEach(el=>el.onclick=()=>mutate(el.dataset.watch,'watch'));root.querySelectorAll('img').forEach(img=>img.onerror=()=>{const blank=document.createElement('div');blank.className='cover-empty';blank.innerHTML='<span>一段待看的故事</span><small>THE SHARED CINEMA</small>';img.replaceWith(blank);});}
function render(){
  const query=$('#search').value.trim().toLowerCase();
  const waiting=movies.filter(m=>!m.watched);const visible=waiting.filter(m=>(filter==='all'||m.type===filter)&&`${m.title} ${m.note} ${m.year}`.toLowerCase().includes(query));
  $('#total-count').textContent=waiting.length;$('#wall-count').textContent=`待放映 / ${String(visible.length).padStart(2,'0')}`;$('#album-count').textContent=`${movies.filter(m=>m.watched).length} 个共同的片刻 ↗`;
  const columns=window.innerWidth<=700?2:window.innerWidth<=1000?3:4;
  const wall=$('#wall');wall.style.setProperty('--columns',columns);wall.innerHTML='';
  // Fill each horizontal rope before hanging another row below it. Large collections chain below the third rope.
  for(let start=0;start<visible.length;start+=columns){const row=document.createElement('div');row.className=`rope-row${start>=columns*3?' chained':''}`;row.innerHTML=visible.slice(start,start+columns).map((m,i)=>card(m,start+i)).join('');if(start>=columns*3)row.querySelectorAll('.photo').forEach(p=>p.insertAdjacentHTML('afterbegin','<span class="chain"></span>'));wall.append(row);}
  if(!visible.length)wall.innerHTML=`<p class="empty">${query?'没有找到这个故事。':filter!=='all'?'这根绳子还没有这个类型的故事。':'绳子空了，挂一部想一起看的故事吧。'}</p>`;
  wireCards(wall);renderAlbum();
}
function renderAlbum(){const seen=movies.filter(m=>m.watched);$('#album-grid').innerHTML=seen.length?seen.map((m,i)=>card(m,i,true)).join(''):'<p class="empty">相册的第一页，等我们一起写。</p>';wireCards($('#album-grid'));}
function editor(movie=null){if(movie&&!editable())return;editing=movie;$('#movie-form').reset();$('#lookup-results').innerHTML='';$('#editor-title').textContent=movie?'编辑这个故事':'挂一部新片';if(movie)for(const key of Object.keys(normalize(movie)))$('#movie-form').elements[key].value=movie[key]??'';$('#save-hint').textContent=isDemo()?'本机演示：内容仅保存在当前浏览器。':token?'保存后立即同步到共享清单。':'连接 Token 可直接保存，也可在下一步通过 GitHub 提交。';open('#editor');}
function detail(id){current=movies.find(m=>String(m.id)===String(id));if(!current)return;const m=current;$('#detail-content').innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">${m.watched?'A COLLECTED MOMENT':'ON OUR WATCHLIST'}</p><h2>${escape(m.title)}</h2></div><button class="close" data-close aria-label="关闭">×</button></div>${m.cover?`<img class="detail-cover" src="${escape(safeUrl(m.cover))}" alt="${escape(m.title)}" referrerpolicy="no-referrer">`:''}<p class="hint">${types[m.type]} · ${escape(m.year||'年份未填写')}${m.rating!==''&&m.rating!=null?` · ${escape(m.ratingSource||'评分')} ${escape(m.rating)}`:''}</p><p class="detail-note">${escape(m.note)}</p>${m.url?`<a class="secondary" href="${escape(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer">前往作品页面 ↗</a>`:''}<div class="detail-actions"><button class="primary" id="detail-watch">${m.watched?'放回绳子':'✓ 标记已观看'}</button><button class="secondary" id="detail-edit">编辑</button><button class="secondary danger" id="detail-delete">移除</button>${m.issueUrl?`<a class="secondary" href="${escape(m.issueUrl)}" target="_blank" rel="noopener noreferrer">讨论 ↗</a>`:''}</div>`;
  $('#detail-watch').onclick=()=>mutate(m.id,'watch');$('#detail-edit').onclick=()=>{if(editable()){$('#detail').close();editor(m);}};$('#detail-delete').onclick=()=>mutate(m.id,'delete');$('#detail-content img')?.addEventListener('error',e=>e.target.remove());open('#detail');}
async function mutate(id,action){if(pending||loading||!editable())return;const m=movies.find(x=>String(x.id)===String(id));if(!m)return;if(action==='delete'&&!confirm(`将《${m.title}》从清单中移除？`))return;pending=true;document.body.classList.add('busy');
  try{if(!isDemo())await github(settings.repository,`/${m.id}`,{token,method:'PATCH',body:action==='delete'?{state:'closed',state_reason:'not_planned'}:{state:m.watched?'open':'closed',state_reason:m.watched?'reopened':'completed'}});if(action==='delete')movies=movies.filter(x=>x.id!==m.id);else m.watched=!m.watched;if(isDemo())persist();$('#detail').close();render();toast(action==='delete'?'已从清单移除':m.watched?'已收进我们的相册':'已重新夹到绳子上');}catch(e){toast(e.message);}finally{pending=false;document.body.classList.remove('busy');}}
$('#movie-form').onsubmit=async e=>{e.preventDefault();if(pending)return;const movie=normalize(Object.fromEntries(new FormData(e.target)));if(!movie.title.trim())return;const button=e.target.querySelector('[type=submit]');pending=true;button.disabled=true;
  try{
    if(!isDemo()&&!token){const url=new URL(`https://github.com/${settings.repository}/issues/new`);url.searchParams.set('title',`[片刻] ${movie.title}`);url.searchParams.set('body',encodeMovie(movie));if(url.href.length>7800)throw new Error('内容过长，请连接 Token 后在页面保存。');window.open(url.href,'_blank','noopener,noreferrer');toast('请在 GitHub 提交后，回到这里刷新清单');return;}
    if(isDemo()){if(editing)Object.assign(editing,movie);else movies.unshift({...movie,id:`local-${Date.now()}`,watched:false});persist();}
    else {const issue=await github(settings.repository,editing?`/${editing.id}`:'',{token,method:editing?'PATCH':'POST',body:{title:`[片刻] ${movie.title}`,body:encodeMovie(movie)}});const saved=decodeIssue(issue);if(!saved)throw new Error('GitHub 返回的数据无法读取，请刷新核对。');if(editing)movies=movies.map(m=>m.id===editing.id?saved:m);else movies.unshift(saved);}
    $('#editor').close();render();toast(editing?'故事已更新':'新的故事，已夹到绳子上');
  }catch(err){toast(err.message);}finally{pending=false;button.disabled=false;}
};
$('#settings-form').onsubmit=e=>{e.preventDefault();loadController?.abort();settings={repository:e.target.elements.repository.value.trim(),tmdbApiKey:e.target.elements.tmdbApiKey.value.trim()};token=e.target.elements.token.value.trim();storage.set('cinema-settings',settings);movies=[];render();$('#settings').close();load();};
$('#lookup').onclick=async()=>{
 const form=$('#movie-form'),button=$('#lookup');button.disabled=true;$('#lookup-results').textContent='正在寻找作品资料…';
 try {
  const url=safeUrl(form.elements.url.value);let found=false;
  if(url&&new URL(url).hostname==='movie.douban.com'){
   try {const response=await fetch(url,{signal:AbortSignal.timeout(6000),credentials:'omit'});if(!response.ok)throw Error();const doc=new DOMParser().parseFromString(await response.text(),'text/html');const title=doc.querySelector('[property="v:itemreviewed"]')?.textContent;const cover=safeUrl(doc.querySelector('#mainpic img')?.src);const rating=doc.querySelector('[property="v:average"]')?.textContent;if(title){form.elements.title.value=title;found=true;}if(cover)form.elements.cover.value=cover;if(rating){form.elements.rating.value=rating;form.elements.ratingSource.value='豆瓣';}const year=doc.querySelector('.year')?.textContent?.match(/\d{4}/)?.[0];if(year)form.elements.year.value=year;}catch{/* CORS / anti-hotlink: preserve manual entries. */}
   if(found){$('#lookup-results').textContent='已读取豆瓣资料，请核对后保存。';return;}
  }
  if(!settings.tmdbApiKey){$('#lookup-results').textContent='未获取到资料。豆瓣可能限制跨域读取，可手动填写，或在设置中配置 TMDB API Key 后重试。';return;}
  const q=form.elements.title.value.trim();if(!q)throw new Error('先填写作品名称');const endpoint=new URL('https://api.themoviedb.org/3/search/multi');endpoint.search=new URLSearchParams({api_key:settings.tmdbApiKey,query:q,language:'zh-CN',include_adult:'false'});
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`检索失败（${response.status}），请检查 TMDB Key`);const data=await response.json();const results=data.results.filter(r=>['movie','tv'].includes(r.media_type)).slice(0,6);const box=$('#lookup-results');box.innerHTML='';
  if(!results.length)box.textContent='没有找到匹配作品，可以手动填写。';
  results.forEach(r=>{const b=document.createElement('button');b.type='button';b.textContent=`${r.title||r.name} · ${(r.release_date||r.first_air_date||'').slice(0,4)} · ${r.media_type==='movie'?'电影':'剧集'}`;b.onclick=()=>{form.elements.title.value=r.title||r.name;form.elements.year.value=(r.release_date||r.first_air_date||'').slice(0,4);form.elements.cover.value=r.poster_path?`https://image.tmdb.org/t/p/w500${r.poster_path}`:'';form.elements.rating.value=r.vote_count>0?Number(r.vote_average).toFixed(1):'';form.elements.ratingSource.value=r.vote_count>0?'TMDB':'';form.elements.url.value=`https://www.themoviedb.org/${r.media_type}/${r.id}`;form.elements.type.value=r.media_type==='tv'&&r.genre_ids?.includes(16)?'anime':r.media_type;box.textContent='已填入 TMDB 资料，请核对后保存。';};box.append(b);});
 }catch(e){$('#lookup-results').textContent=e.message||'获取失败，可以手动填写。';}finally{button.disabled=false;}
};
document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))e.target.closest('dialog').close();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#settings-button').onclick=settingsDialog;$('#add-button').onclick=()=>editor();$('#refresh').onclick=load;$('#search').oninput=render;$('#album-button').onclick=()=>{renderAlbum();open('#album');};document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render();});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);});
// Re-read after returning from a GitHub submission. Do not interrupt an edit.
window.addEventListener('focus',()=>{if(!isDemo()&&!loading&&!pending&&!document.querySelector('dialog[open]'))load();});
load();

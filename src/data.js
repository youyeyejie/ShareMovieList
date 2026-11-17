export const types = { movie: '电影', anime: '番剧', tv: '剧集', other: '其他' };
export const safeUrl = value => { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; } };
const PREFIX='[shared-cinema:v2]';
export function encodeComment({note='',watched=false,type}={}) { return PREFIX+JSON.stringify({note:String(note).slice(0,500),watched:!!watched,...(types[type]?{type}:{})}); }
export function decodeComment(comment='') {
  if(typeof comment!=='string')return {note:'',watched:false};
  if(comment.startsWith(PREFIX)){try{const m=JSON.parse(comment.slice(PREFIX.length));return {note:String(m.note||'').slice(0,500),watched:m.watched===true,...(types[m.type]?{type:m.type}:{})};}catch{/* Preserve a malformed or native TMDB comment. */}}
  return {note:comment,watched:false};
}
export function fromTMDB(item,comment='') {
  const mediaType=item.media_type||'movie'; const meta=decodeComment(comment);
  return { id:`${mediaType}:${item.id}`, mediaId:item.id, mediaType, title:item.title||item.name||'未命名作品', year:(item.release_date||item.first_air_date||'').slice(0,4),type:meta.type||(mediaType==='tv'&&(item.genre_ids||item.genres?.map(g=>g.id)||[]).includes(16)?'anime':mediaType),cover:item.poster_path?`https://image.tmdb.org/t/p/w500${item.poster_path}`:'',rating:item.vote_count>0&&Number.isFinite(item.vote_average)?item.vote_average.toFixed(1):'',ratingSource:'TMDB',overview:item.overview||'',url:`https://www.themoviedb.org/${mediaType}/${item.id}`,note:meta.note,watched:meta.watched };
}
export class TMDB {
  constructor({apiKey='',readToken='',accessToken=''}={}){Object.assign(this,{apiKey,readToken,accessToken});}
  async request(path,{method='GET',body,user=false,application=false,signal}={}){
    const url=new URL(`https://api.themoviedb.org${path}`);
    const bearer=user?this.accessToken:application?this.readToken:(this.accessToken||this.readToken);
    if(user&&!bearer)throw Error('请先登录 TMDB，再编辑清单');
    if(!bearer){if(!this.apiKey)throw Error('请在设置中填写 TMDB API Key');if(method!=='GET')throw Error('登录授权需要 API Read Access Token，请在设置中填写');url.searchParams.set('api_key',this.apiKey);}
    let response;
    try{response=await fetch(url,{method,signal:signal||AbortSignal.timeout(20000),headers:{accept:'application/json',...(bearer?{Authorization:`Bearer ${bearer}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch(e){if(e.name==='AbortError')throw e;throw Error('无法连接 TMDB，请检查网络后重试');}
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.success===false)throw Error(response.status===401?'TMDB 凭证无效、已过期或尚未授权，请重新连接':response.status===403?'当前账号没有这个清单的编辑权限（需要清单所属账号）':`TMDB 请求失败（${response.status}）：${data.status_message||'请稍后重试'}`);
    return data;
  }
  async search(query,signal){const data=await this.request(`/3/search/multi?${new URLSearchParams({query,language:'zh-CN',include_adult:'false'})}`,{signal});return (data.results||[]).filter(i=>['movie','tv'].includes(i.media_type)).map(i=>fromTMDB(i));}
  async list(id,signal){let page=1,all=[],details;do{const data=await this.request(`/4/list/${encodeURIComponent(id)}?language=zh-CN&page=${page}`,{signal});details??=data;all.push(...(data.results||[]).filter(i=>['movie','tv'].includes(i.media_type)).map(i=>fromTMDB(i,data.comments?.[`${i.media_type}:${i.id}`]??i.comment??'')));if(page>=data.total_pages||!data.results?.length)break;page++;}while(true);return {movies:all,details};}
  async items(listId,method,movie,meta){const item={media_type:movie.mediaType,media_id:movie.mediaId,...(meta?{comment:encodeComment(meta)}:{})};const data=await this.request(`/4/list/${encodeURIComponent(listId)}/items`,{method,user:true,body:{items:[item]}});if(data.results?.some(r=>r.success===false))throw Error('TMDB 未保存这个作品（可能已存在或无编辑权限），请刷新核对');return data;}
  async save(listId,movie,{newItem=false}={}){
    if(newItem)await this.items(listId,'POST',movie);
    // TMDB only documents comment updates via PUT; keep failures visible after a successful add.
    try{await this.items(listId,'PUT',movie,movie);}catch(e){if(newItem)e.message='作品已加入，但备注未保存。请刷新后编辑重试。'+e.message;throw e;}
  }
  async createList(){return this.request('/4/list',{method:'POST',user:true,body:{name:'片刻放映室',description:'那些说好一起看的电影、番剧，和还没开始的冒险。',iso_639_1:'zh',iso_3166_1:'CN',public:true}});}
  async accountLists(accountId){let page=1,lists=[];do{const d=await this.request(`/4/account/${encodeURIComponent(accountId)}/lists?page=${page}`,{user:true});lists.push(...d.results||[]);if(page>=d.total_pages||!d.results?.length)break;page++;}while(true);return lists;}
}
export const demoMovies=[
 {id:'movie:120',mediaId:120,mediaType:'movie',title:'布达佩斯大饭店',type:'movie',year:'2014',note:'想在一个下雨的周末，走进粉色的世界。',art:'hotel'},
 {id:'tv:1',mediaId:1,mediaType:'tv',title:'葬送的芙莉莲',type:'anime',year:'2023',note:'旅途结束以后，故事才刚刚开始。',art:'forest'},
 {id:'movie:157336',mediaId:157336,mediaType:'movie',title:'星际穿越',type:'movie',year:'2014',note:'找一个没有人打扰的晚上，把灯都关掉。',art:'space'},
 {id:'movie:2',mediaId:2,mediaType:'movie',title:'海街日记',type:'movie',year:'2015',note:'夏天、梅子酒，和镰仓的海风。',art:'sea'},
 {id:'movie:3',mediaId:3,mediaType:'movie',title:'重庆森林',type:'movie',year:'1994',note:'希望记忆永远不会过期。',art:'city'},
 {id:'movie:4',mediaId:4,mediaType:'movie',title:'完美的日子',type:'movie',year:'2023',note:'听一盘磁带，看一棵树。',art:'tree'},
 {id:'tv:5',mediaId:5,mediaType:'tv',title:'虫师',type:'anime',year:'2005',note:'在寂静的森林里，听一个很远的故事。',art:'mist'},
 {id:'movie:6',mediaId:6,mediaType:'movie',title:'小森林 夏秋篇',type:'movie',year:'2014',note:'四季流转，好好吃饭。',art:'field'},
 {id:'movie:7',mediaId:7,mediaType:'movie',title:'心灵奇旅',type:'movie',year:'2020',note:'一起看过的第一个故事。',art:'soul',watched:true}
].map(m=>({rating:'',ratingSource:'',url:'',watched:false,...m,cover:new URL(`../assets/${m.art}.svg`,import.meta.url).href}));

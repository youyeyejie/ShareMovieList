async function request(path,token,signal){
  const options = {signal:signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),redirect:'error'};
  if (!token) throw Error('请在连接设置中保存 TMDB 长令牌');
  const response=await fetch('https://api.themoviedb.org/3/'+path+'language=zh-CN',{...options,headers:{Authorization:'Bearer '+token}});
  if (!response.ok) throw Error('TMDB 请求失败 '+response.status);
  return response.json();
}

const summaryCache = new Map();
const regionNames = new Intl.DisplayNames(['zh-CN'], {type:'region'});
function regions(item){
  const origin=item.origin_country?.filter(Boolean) || [];
  const codes=origin.length?origin:(item.production_countries||[]).map(country=>country.iso_3166_1);
  return [...new Set(codes.filter(code=>/^[A-Z]{2}$/.test(code)))].map(code=>regionNames.of(code)).join('、');
}
function summarize(data,tv){
  const credits=(tv?data.aggregate_credits:data.credits)||{};
  const directors=(credits.crew||[]).map(person=>{
    const episodes=person.jobs?.find(role=>role.job==='Director')?.episode_count;
    return {name:person.name,count:tv?(episodes??0):Number(person.job==='Director')};
  }).filter(person=>person.name&&person.count>0).sort((a,b)=>b.count-a.count);
  const names=[...new Set(directors.map(person=>person.name))];
  return {directors:names,countries:regions(data)};
}
function detailsPath(id){
  return id+'?append_to_response='+(id.startsWith('tv/')?'aggregate_credits':'credits')+'&';
}
export async function lookupSummary(id,token,signal){
  if (!/^(movie|tv)\/\d+$/.test(id)) throw Error('无效的作品编号');
  if (!summaryCache.has(id)){
    const data=await request(detailsPath(id),token,signal);
    summaryCache.set(id,summarize(data,id.startsWith('tv/')));
  }
  return summaryCache.get(id);
}

export async function lookupTMDB(mode, query, token, signal) {
  let path;
  if (mode==='search' && query.trim() && query.length<=160) path='search/multi?query='+encodeURIComponent(query)+'&';
  else if (mode==='detail' && /^(movie|tv)\/\d+$/.test(query)) path=detailsPath(query);
  else throw Error('无效的查询');
  const data=await request(path,token,signal);
  if(mode==='detail')summaryCache.set(query,summarize(data,query.startsWith('tv/')));
  const items = mode==='search'?data.results:[{...data,media_type:query.split('/')[0]}];
  return items.filter(i=>['movie','tv'].includes(i.media_type)).slice(0,8).map(i=>({
    countries:regions(i),title:i.title||i.name,year:(i.release_date||i.first_air_date||'').slice(0,4),
    type:i.media_type==='tv' && (i.genre_ids||i.genres?.map(g=>g.id)||[]).includes(16)?'anime':i.media_type,
    overview:(i.overview||'').slice(0,2000),cover:i.poster_path?'https://image.tmdb.org/t/p/w500'+i.poster_path:'',
    url:'https://www.themoviedb.org/'+i.media_type+'/'+i.id,tmdb:i.media_type+'/'+i.id,
    rating:i.vote_count>0?Number(i.vote_average).toFixed(1):'',ratingSource:'TMDB'
  }));
}

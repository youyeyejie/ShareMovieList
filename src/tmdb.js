export async function lookupTMDB(mode, query, token, signal) {
  const options = {signal:signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),redirect:'error'};
  if (!token) throw Error('请在连接设置中保存 TMDB 长令牌');
  let path;
  if (mode==='search' && query.trim() && query.length<=160) path='search/multi?query='+encodeURIComponent(query)+'&';
  else if (mode==='detail' && /^(movie|tv)\/\d+$/.test(query)) path=query+'?';
  else throw Error('无效的查询');
  const response = await fetch('https://api.themoviedb.org/3/'+path+'language=zh-CN',{...options,headers:{Authorization:'Bearer '+token}});
  if (!response.ok) throw Error('TMDB 请求失败 '+response.status);
  const data = await response.json();
  const items = mode==='search'?data.results:[{...data,media_type:query.split('/')[0]}];
  return items.filter(i=>['movie','tv'].includes(i.media_type)).slice(0,8).map(i=>({
    title:i.title||i.name,year:(i.release_date||i.first_air_date||'').slice(0,4),
    type:i.media_type==='tv' && (i.genre_ids||i.genres?.map(g=>g.id)||[]).includes(16)?'anime':i.media_type,
    overview:(i.overview||'').slice(0,2000),cover:i.poster_path?'https://image.tmdb.org/t/p/w500'+i.poster_path:'',
    url:'https://www.themoviedb.org/'+i.media_type+'/'+i.id,tmdb:i.media_type+'/'+i.id,
    rating:i.vote_count>0?Number(i.vote_average).toFixed(1):'',ratingSource:'TMDB'
  }));
}

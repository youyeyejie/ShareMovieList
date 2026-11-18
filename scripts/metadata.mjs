import {pathToFileURL} from 'node:url';

export async function lookup(mode, query, token) {
  const options = {signal:AbortSignal.timeout(15000),redirect:'error'};
  if (mode === 'douban') {
    const match = /^(?:https:\/\/movie\.douban\.com\/subject\/)?(\d{1,12})\/?$/.exec(query);
    if (!match) throw Error('需要豆瓣电影条目链接或编号');
    const url = 'https://movie.douban.com/subject/'+match[1]+'/';
    const response = await fetch(url,options);
    if (!response.ok) throw Error('豆瓣页面不可读取');
    const html = await response.text();
    const blocks = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const block of blocks) {
      let item;
      try { item=JSON.parse(block[1]); } catch { continue; }
      if (!['Movie','TVSeries'].includes(item['@type'])) continue;
      return [{title:item.name,year:item.datePublished?.slice(0,4),overview:item.description?.slice(0,2000),cover:item.image,url,rating:item.aggregateRating?.ratingValue??'',ratingSource:'豆瓣',type:item['@type']==='Movie'?'movie':'tv'}];
    }
    throw Error('豆瓣没有提供可读取的作品资料');
  }
  if (!token) throw Error('请配置 TMDB_TOKEN');
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
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {REQUEST_ID,MODE,QUERY,TMDB_TOKEN,GH_TOKEN,GITHUB_SHA,GITHUB_REPOSITORY}=process.env;
  if (!/^[a-f0-9-]{36}$/.test(REQUEST_ID)) throw Error('Invalid request ID');
  const results=await lookup(MODE,QUERY,TMDB_TOKEN);
  const response=await fetch('https://api.github.com/repos/'+GITHUB_REPOSITORY+'/check-runs',{
    method:'POST',headers:{Authorization:'Bearer '+GH_TOKEN,'Content-Type':'application/json'},
    body:JSON.stringify({name:'metadata-'+REQUEST_ID,external_id:REQUEST_ID,head_sha:GITHUB_SHA,status:'completed',conclusion:'success',
      output:{title:'影片资料',summary:'查询完成',text:JSON.stringify(results)}})
  });
  if (!response.ok) throw Error('无法发布查询结果 '+response.status);
}

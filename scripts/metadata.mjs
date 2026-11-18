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
  throw Error('无效的豆瓣查询');
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {REQUEST_ID,MODE,QUERY,GH_TOKEN,GITHUB_SHA,GITHUB_REPOSITORY}=process.env;
  if (!/^[a-f0-9-]{36}$/.test(REQUEST_ID)) throw Error('Invalid request ID');
  const results=await lookup(MODE,QUERY);
  const response=await fetch('https://api.github.com/repos/'+GITHUB_REPOSITORY+'/check-runs',{
    method:'POST',headers:{Authorization:'Bearer '+GH_TOKEN,'Content-Type':'application/json'},
    body:JSON.stringify({name:'metadata-'+REQUEST_ID,external_id:REQUEST_ID,head_sha:GITHUB_SHA,status:'completed',conclusion:'success',
      output:{title:'影片资料',summary:'查询完成',text:JSON.stringify(results)}})
  });
  if (!response.ok) throw Error('无法发布查询结果 '+response.status);
}

export const MARKER = 'shared-cinema:v1';
export const types = { movie: '电影', anime: '番剧', tv: '剧集', other: '其他' };
export function safeUrl(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
export function normalize(m) {
  return { title: String(m.title || '').slice(0,120), type: types[m.type] ? m.type : 'other', year: /^\d{4}$/.test(String(m.year)) ? String(m.year) : '', url: safeUrl(m.url), cover: safeUrl(m.cover), rating: m.rating !== '' && m.rating != null && Number.isFinite(Number(m.rating)) && Number(m.rating) >= 0 && Number(m.rating) <= 10 ? Number(m.rating) : '', ratingSource: String(m.ratingSource || '').slice(0,30), note: String(m.note || '').slice(0,500) };
}
export function encodeMovie(movie) { return `<!-- ${MARKER} -->\n\n\`\`\`json\n${JSON.stringify(normalize(movie), null, 2)}\n\`\`\`\n\n由片刻放映室管理。关闭 = 已观看；重新打开 = 待观看；关闭为 not planned = 已移除。`; }
export function decodeIssue(issue) {
  if (issue.pull_request || !issue.body?.startsWith(`<!-- ${MARKER} -->`) || issue.state_reason === 'not_planned') return null;
  try { const match = issue.body.match(/```json\s*([\s\S]*?)```/); const movie = normalize(JSON.parse(match[1])); if (!movie.title) return null; return { ...movie, id: issue.number, watched: issue.state === 'closed', issueUrl: safeUrl(issue.html_url), author: issue.user?.login || '' }; } catch { return null; }
}
export async function github(repository, path = '', {token = '', method = 'GET', body, signal} = {}) {
  const response = await fetch(`https://api.github.com/repos/${repository}/issues${path}`, {method, signal, headers: { Accept:'application/vnd.github+json', ...(token ? {Authorization:`Bearer ${token}`} : {}), ...(body ? {'Content-Type':'application/json'} : {}) }, ...(body ? {body:JSON.stringify(body)} : {})});
  if (!response.ok) { const error = await response.json().catch(()=>({})); throw new Error(response.status === 403 || response.status === 429 ? 'GitHub 请求受限，或 Token 没有写入权限。请稍后重试或检查设置。' : response.status === 401 ? 'Token 无效或已过期，请重新连接。' : `GitHub ${response.status}：${error.message || '请求失败'}`); }
  return response.json();
}
export async function loadMovies(repository, token, signal) {
  const all = []; let page = 1;
  while (true) { const batch = await github(repository, `?state=all&per_page=100&page=${page++}`, {token,signal}); all.push(...batch.map(decodeIssue).filter(Boolean)); if (batch.length < 100) break; }
  return all;
}
export const demoMovies = [
  {title:'布达佩斯大饭店',type:'movie',year:'2014',note:'想在一个下雨的周末，走进韦斯·安德森的粉色世界。',art:'hotel'},
  {title:'葬送的芙莉莲',type:'anime',year:'2023',note:'旅途结束以后，故事才刚刚开始。',art:'forest'},
  {title:'星际穿越',type:'movie',year:'2014',note:'找一个没有人打扰的晚上，把灯都关掉。',art:'space'},
  {title:'海街日记',type:'movie',year:'2015',note:'夏天、梅子酒，和镰仓的海风。',art:'sea'},
  {title:'重庆森林',type:'movie',year:'1994',note:'如果记忆也是一个罐头，希望它永远不会过期。',art:'city'},
  {title:'完美的日子',type:'movie',year:'2023',note:'听一盘磁带，看一棵树，过好平凡的一天。',art:'tree'},
  {title:'虫师',type:'anime',year:'2005',note:'在寂静的森林里，听一个很远的故事。',art:'mist'},
  {title:'小森林 夏秋篇',type:'movie',year:'2014',note:'四季流转，好好吃饭。',art:'field'},
  {title:'心灵奇旅',type:'movie',year:'2020',note:'一起看过的第一个故事。',art:'soul',watched:true}
].map((m,i)=>({...normalize(m),...m,id:`demo-${i}`,watched:!!m.watched,cover:new URL(`../assets/${m.art}.svg`,import.meta.url).href}));

// Template contents stay inert: scripts, images and frames from the saved page
// are never attached to the application document.
export function parseDoubanFile(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const page = template.content;
  const meta = property => page.querySelector(`meta[property="${property}"]`)?.content || '';
  const text = selector => page.querySelector(selector)?.textContent.trim() || '';
  const items = [];
  for (const script of page.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const json = JSON.parse(script.textContent);
      items.push(...(Array.isArray(json) ? json : json?.['@graph'] || [json]));
    } catch { /* Some saved pages have malformed JSON-LD but intact HTML. */ }
  }
  const item = items.find(value => ['Movie', 'TVSeries'].includes(value?.['@type'])) || {};
  const savedUrl = html.match(/<!--\s*saved from url=\(\d+\)(https:\/\/movie\.douban\.com\/subject\/\d+\/)/i)?.[1];
  const match = [meta('og:url'), savedUrl, page.querySelector('link[rel="canonical"]')?.getAttribute('href')]
    .map(url => /^https?:\/\/movie\.douban\.com\/subject\/(\d+)\/?(?:[?#].*)?$/.exec(url || ''))
    .find(Boolean);
  const title = text('[property="v:itemreviewed"]') || item.name || meta('og:title');
  if (!match || typeof title !== 'string' || !title.trim()) throw Error('请选择从豆瓣电影或剧集详情页保存的 HTML 文件。');
  const year = text('.year').match(/\d{4}/)?.[0] || String(item.datePublished || '').match(/^\d{4}/)?.[0];
  const rating = String(item.aggregateRating?.ratingValue || text('[property="v:average"]')).trim();
  const image = meta('og:image') || item.image?.url || item.image;
  return {
    title: title.trim().slice(0,160),
    url: `https://movie.douban.com/subject/${match[1]}/`,
    year, cover: typeof image === 'string' && /^https?:\/\//i.test(image) ? image : undefined,
    overview: (text('[property="v:summary"]') || String(item.description || '')).slice(0,5000),
    rating: rating && Number.isFinite(+rating) && +rating >= 0 && +rating <= 10 ? rating : '',
    type: item['@type'] === 'TVSeries' ? (item.genre?.includes('动画') ? 'anime' : 'tv') : 'movie'
  };
}

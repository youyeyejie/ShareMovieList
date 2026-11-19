export const types = { movie: '电影', anime: '番剧', tv: '剧集', other: '其他' };
export const safeUrl = value => { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; } };
export const isRetiredCover = value => typeof value==='string' && value.startsWith('https://youyeyejie.github.io/ShareMovieList/assets/covers/');
export const safeCoverUrl = value => {
  if(isRetiredCover(value))return '';
  return typeof value==='string' && value.length<=34000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : safeUrl(value);
};

export const types = { movie: '电影', anime: '番剧', tv: '剧集', other: '其他' };
export const safeUrl = value => { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; } };
export const safeCoverUrl = value => typeof value==='string' && value.length<=34000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : safeUrl(value);

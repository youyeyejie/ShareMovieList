export const types = { movie: '电影', anime: '番剧', tv: '剧集', other: '其他' };
export const safeUrl = value => { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; } };

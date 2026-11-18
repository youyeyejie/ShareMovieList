export const types = { movie: '电影', anime: '番剧', tv: '剧集', other: '其他' };
export const safeUrl = value => { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; } };
export const demoMovies=[
 {id:'movie:120',mediaId:120,mediaType:'movie',title:'布达佩斯大饭店',type:'movie',year:'2014',note:'想在一个下雨的周末，走进粉色的世界。',art:'hotel'},
 {id:'tv:1',mediaId:1,mediaType:'tv',title:'葬送的芙莉莲',type:'anime',year:'2023',note:'旅途结束以后，故事才刚刚开始。',art:'forest'},
 {id:'movie:157336',mediaId:157336,mediaType:'movie',title:'星际穿越',type:'movie',year:'2014',note:'找一个没有人打扰的晚上，把灯都关掉。',art:'space'},
 {id:'movie:2',mediaId:2,mediaType:'movie',title:'海街日记',type:'movie',year:'2015',note:'夏天、梅子酒，和镰仓的海风。',art:'sea'},
 {id:'movie:3',mediaId:3,mediaType:'movie',title:'重庆森林',type:'movie',year:'1994',note:'希望记忆永远不会过期。',art:'city'},
 {id:'movie:4',mediaId:4,mediaType:'movie',title:'完美的日子',type:'movie',year:'2023',note:'听一盘磁带，看一棵树。',art:'tree'},
 {id:'tv:5',mediaId:5,mediaType:'tv',title:'虫师',type:'anime',year:'2005',note:'在寂静的森林里，听一个很远的故事。',art:'mist'},
 {id:'movie:6',mediaId:6,mediaType:'movie',title:'小森林 夏秋篇',type:'movie',year:'2014',note:'四季流转，好好吃饭。',art:'field'},
 {id:'movie:7',mediaId:7,mediaType:'movie',title:'心灵奇旅',type:'movie',year:'2020',note:'一起看过的第一个故事。',art:'soul',watched:true},
 {"id":"demo-archive-0","mediaId":1000,"mediaType":"movie","title":"千与千寻","type":"movie","year":"2001","note":"回头看，成长就是一场勇敢的冒险。","art":"forest","watched":true},
 {"id":"demo-archive-1","mediaId":1001,"mediaType":"movie","title":"寻梦环游记","type":"movie","year":"2017","note":"被记得，就从来没有离开。","art":"soul","watched":true},
 {"id":"demo-archive-2","mediaId":1002,"mediaType":"movie","title":"龙猫","type":"movie","year":"1988","note":"把夏天和童年收进这一页。","art":"tree","watched":true},
 {"id":"demo-archive-3","mediaId":1003,"mediaType":"movie","title":"机器人总动员","type":"movie","year":"2008","note":"在星星之间，留一个位置给你。","art":"space","watched":true},
 {"id":"demo-archive-4","mediaId":1004,"mediaType":"movie","title":"秒速五厘米","type":"movie","year":"2007","note":"记住那一年的风景。","art":"sea","watched":true},
 {"id":"demo-archive-5","mediaId":1005,"mediaType":"movie","title":"魔女宅急便","type":"movie","year":"1989","note":"慢慢找到属于自己的生活。","art":"city","watched":true}
].map(m=>({rating:'',ratingSource:'',url:'',watched:false,...m,cover:new URL(`../assets/${m.art}.svg`,import.meta.url).href}));

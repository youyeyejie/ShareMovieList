import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,safeUrl,encodeMovie,decodeIssue,loadMovies} from '../src/data.js';
test('issue round trip preserves metadata, watched and reopened states',()=>{
 const movie={title:'千与千寻',type:'anime',year:'2001',rating:'9.4',ratingSource:'豆瓣',url:'https://movie.douban.com/subject/1291561/',note:'一起看'};
 const issue={number:42,body:encodeMovie(movie),state:'closed',state_reason:'completed',user:{login:'friend'}};
 assert.deepEqual(decodeIssue(issue),{...normalize(movie),id:42,watched:true,issueUrl:'',author:'friend'});
 assert.equal(decodeIssue({...issue,state:'open',state_reason:'reopened'}).watched,false);
 assert.equal(decodeIssue({...issue,state_reason:'not_planned'}),null);
});
test('rejects unrelated issues, pull requests, malformed JSON and unsafe links',()=>{
 assert.equal(decodeIssue({body:'not a movie'}),null);
 assert.equal(decodeIssue({body:'<!-- shared-cinema:v1 -->\n```json\nbroken\n```'}),null);
 assert.equal(decodeIssue({pull_request:{},body:encodeMovie({title:'x'})}),null);
 for(const url of ['javascript:alert(1)','data:text/html,x','file:///etc/passwd','//evil.test'])assert.equal(safeUrl(url),'');
 assert.equal(normalize({rating:11}).rating,'');assert.equal(normalize({rating:''}).rating,'');assert.equal(normalize({rating:0}).rating,0);
});
test('loads every GitHub page, excluding unrelated issues',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>calls.length===1?Array.from({length:100},(_,i)=>({number:i+1,body:encodeMovie({title:`Movie ${i}`}),state:'open'})):[{number:101,body:encodeMovie({title:'Last'}),state:'closed'},{body:'unrelated'}]};};
 try{const movies=await loadMovies('owner/repo','');assert.equal(movies.length,101);assert.equal(calls.length,2);assert.match(calls[1],/page=2/);assert.equal(movies.at(-1).watched,true);}finally{globalThis.fetch=original;}
});

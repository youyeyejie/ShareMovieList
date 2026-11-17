import test from 'node:test';
import assert from 'node:assert/strict';
import {TMDB,encodeComment,decodeComment,fromTMDB,safeUrl} from '../src/data.js';
import {makeInvite,parseInvite} from '../src/session.js';
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const fixture={id:11,media_type:'movie',title:'星球大战',release_date:'1977-05-25',vote_count:100,vote_average:8.2,poster_path:'/poster.jpg'};
async function mockFetch(fn,run){const original=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=original;}}
test('TMDB comments preserve shared watched state, note and category, including code fences',()=>{
 const metadata={note:'一起看 ```json <script> 中文 🌲',watched:true,type:'anime'};
 assert.deepEqual(decodeComment(encodeComment(metadata)),metadata);
 assert.deepEqual(decodeComment('普通 TMDB 留言'),{note:'普通 TMDB 留言',watched:false});
 assert.equal(decodeComment('[shared-cinema:v2]{invalid').watched,false);
 assert.equal(decodeComment('[shared-cinema:v2]null').watched,false);
 assert.equal(decodeComment('[shared-cinema:v2]{"watched":"false"}').watched,false);
 assert.equal(decodeComment(encodeComment({note:'x'.repeat(600)})).note.length,500);
});
test('maps real TMDB metadata; unavailable cover and rating remain absent',()=>{
 const movie=fromTMDB(fixture,encodeComment({watched:true,note:'周末看'}));
 assert.equal(movie.id,'movie:11');assert.equal(movie.rating,'8.2');assert.equal(movie.watched,true);assert.match(movie.cover,/image.tmdb.org/);assert.match(movie.url,/movie\/11/);
 const missing=fromTMDB({id:1,media_type:'tv',name:'番剧',genre_ids:[16],vote_count:0,vote_average:0});assert.equal(missing.type,'anime');assert.equal(missing.cover,'');assert.equal(missing.rating,'');
 for(const url of ['javascript:alert(1)','data:text/html,x','file:///tmp/a','//evil.test'])assert.equal(safeUrl(url),'');
});
test('loads all list pages and reads per-item comments, preferring user authorization for private lists',async()=>{
 const calls=[];
 await mockFetch(async(url,options)=>{calls.push({url:String(url),options});return response({created_by:{id:'owner'},total_pages:2,results:[{...fixture,id:calls.length}],comments:{[`movie:${calls.length}`]:encodeComment({watched:calls.length===2})}});},async()=>{
  const data=await new TMDB({readToken:'application',accessToken:'user'}).list('123');assert.equal(data.movies.length,2);assert.equal(data.movies[1].watched,true);assert.match(calls[1].url,/page=2/);assert.equal(calls[0].options.headers.Authorization,'Bearer user');assert.equal(data.details.created_by.id,'owner');
 });
});
test('search uses application key if no bearer; excludes people; never sends key to other origins',async()=>{
 await mockFetch(async(url,options)=>{assert.equal(url.origin,'https://api.themoviedb.org');assert.equal(url.searchParams.get('api_key'),'application-key');assert.equal(url.searchParams.get('query'),'千与千寻');assert.equal(options.headers.Authorization,undefined);return response({results:[fixture,{id:99,media_type:'person'}]});},async()=>{
  const result=await new TMDB({apiKey:'application-key'}).search('千与千寻');assert.equal(result.length,1);
 });
});
test('new item uses POST then PUT comment; watched update uses only PUT; remove uses DELETE',async()=>{
 const calls=[];const movie=fromTMDB(fixture);movie.note='一起看';movie.watched=true;
 await mockFetch(async(url,options)=>{calls.push({url:String(url),...options});return response({success:true,results:[{success:true}]});},async()=>{
  const c=new TMDB({readToken:'app',accessToken:'owner'});await c.save('42',movie,{newItem:true});await c.save('42',movie);await c.items('42','DELETE',movie);
  assert.deepEqual(calls.map(c=>c.method),['POST','PUT','PUT','DELETE']);assert.equal(calls[0].headers.Authorization,'Bearer owner');const item=JSON.parse(calls[1].body).items[0];assert.equal(item.media_id,11);assert.equal(decodeComment(item.comment).watched,true);
 });
});
test('per-item failures and partially successful additions are surfaced, no optimistic success',async()=>{
 let call=0;await mockFetch(async()=>response({results:[{success:++call===1}]}),async()=>{
  await assert.rejects(new TMDB({accessToken:'owner'}).save('42',fromTMDB(fixture),{newItem:true}),/作品已加入，但备注未保存/);
 });
 await assert.rejects(new TMDB({readToken:'app'}).items('42','POST',fromTMDB(fixture)),/先登录/);
 await mockFetch(async()=>response({success:false},401),async()=>{await assert.rejects(new TMDB({apiKey:'invalid'}).search('x'),/无效/);});
});
test('auth endpoints require application token, separately from the user write token',async()=>{
 await mockFetch(async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer application');assert.equal(options.method,'POST');return response({request_token:'request'});},async()=>{await new TMDB({readToken:'application',accessToken:'owner'}).request('/4/auth/request_token',{method:'POST',application:true,body:{redirect_to:'https://example.test'}});});
});
test('shared credentials round trip in fragment only, no query; rejects incomplete invitations',()=>{
 const session={apiKey:'application-key',readToken:'application',accessToken:'private-user',accountId:'owner',listId:'42'};
 const url=makeInvite('https://example.test/cinema/?list=old&demo=1#anything',session);assert.equal(new URL(url).search,'');assert.ok(new URL(url).hash.startsWith('#access='));assert.deepEqual(parseInvite(new URL(url).hash),session);assert.equal(parseInvite(''),null);assert.throws(()=>parseInvite('#access=broken'));assert.throws(()=>makeInvite('https://example.test',{...session,accessToken:''}));
});

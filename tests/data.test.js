import test from 'node:test';
import assert from 'node:assert/strict';
import {Repository,moviePath,pinColor} from '../src/repository.js';
import {lookupTMDB} from '../src/tmdb.js';

test('only direct movie files and movie.json in a movie folder are writable',()=>{
  assert.ok(moviePath('lists/周末/星际穿越.json','周末'));
  assert.ok(moviePath('lists/周末/星际穿越/movie.json','周末'));
  for(const path of ['lists/别处/a.json','lists/周末/../movie.json','lists/周末/a/poster.png','.github/workflows/pages.yml'])assert.equal(moviePath(path,'周末'),false);
});

test('changing editor keeps original creator and uses current blob SHA',async()=>{
  const repo=new Repository({repository:'sample/repo',branch:'main'});
  await assert.rejects(repo.commit('片单',{title:'电影'}),/写权限/);
  const requests=[];
  repo.api=async(path,method,body)=>{
    requests.push({path,method,body});
    return {content:{sha:'new-sha'}};
  };
  repo.writer='Alice';
  const movie=await repo.commit('片单',{title:'电影',note:'一起看'});
  repo.writer='Bob';
  const updated=await repo.commit('片单',{...movie,watched:true});
  assert.equal(updated.createdBy,'Alice');
  assert.equal(updated.createdAt,movie.createdAt);
  assert.match(requests[1].body.message,/^feat\(list\): /);
  assert.equal(requests[1].body.sha,'new-sha');
  assert.equal(requests[0].body.sha,undefined);
  assert.equal(JSON.parse(Buffer.from(requests[0].body.content,'base64')).title,'电影');
  assert.equal(pinColor('Alice'),pinColor('alice'));
  assert.notEqual(pinColor('Alice'),pinColor('Bob'));
  repo.api=async()=>{throw Error('冲突');};
  await assert.rejects(repo.commit('片单',movie),/冲突/);
});

test('metadata uses a fixed provider host and never returns authorization',async t=>{
  let url,headers;
  t.mock.method(globalThis,'fetch',async(u,o)=>{
    url=u;headers=o.headers;
    return Response.json({id:11,title:'作品',release_date:'2020',vote_count:0});
  });
  const [item]=await lookupTMDB('detail','movie/11','fixture');
  assert.equal(new URL(url).hostname,'api.themoviedb.org');
  assert.equal(headers.Authorization,'Bearer fixture');
  assert.equal(item.tmdb,'movie/11');
  assert.equal(item.rating,'');
  assert.ok(!JSON.stringify(item).includes('fixture'));
  await assert.rejects(lookupTMDB('detail','https://example.test','fixture'));
});

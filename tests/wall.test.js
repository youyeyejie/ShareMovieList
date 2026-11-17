import test from 'node:test';
import assert from 'node:assert/strict';
import {cableHeight,suspensionX} from '../src/wall.js';
test('loaded rope stays attached to both supports and every added load increases sag',()=>{
 const loads=[{u:.15,mass:1},{u:.4,mass:1.3},{u:.68,mass:.8},{u:.9,mass:1}];
 assert.equal(cableHeight(0,24,52,loads),24);assert.equal(cableHeight(1,24,52,loads),52);
 for(let i=1;i<100;i++){const u=i/100;assert.ok(cableHeight(u,24,52,loads)>cableHeight(u,24,52,[]));}
 // With gravity and no intermediate supports, slope cannot rise again to
 // produce an unsupported peak between two photos.
 let previous=Infinity;for(let i=0;i<100;i++){const slope=cableHeight((i+1)/100,24,52,loads)-cableHeight(i/100,24,52,loads);assert.ok(slope<=previous+1e-9);previous=slope;}
});
test('a tilted photo balances with its centre of mass directly below the hanging point',()=>{
 for(const [w,h] of [[145,340],[250,500],[310,610]])for(const angle of [-6,-2,0,3.5,6]){
  const anchorY=-14,anchorX=suspensionX(w,h,angle,anchorY),r=angle*Math.PI/180;
  const dx=w/2-anchorX,dy=h/2-anchorY;
  assert.ok(Math.abs(Math.cos(r)*dx-Math.sin(r)*dy)<1e-9);
  assert.ok(anchorX>0&&anchorX<w);
 }
});

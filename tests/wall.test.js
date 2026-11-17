import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedMove,photoPose} from '../src/wall.js';
test('dragging cannot move a photo beyond any board edge',()=>{
 const bounds={minX:-20,maxX:180,minY:-12,maxY:250};
 assert.deepEqual(boundedMove(-500,100,bounds),{x:-20,y:100});
 assert.deepEqual(boundedMove(999,999,bounds),{x:180,y:250});
 assert.deepEqual(boundedMove(30,-999,bounds),{x:30,y:-12});
 assert.deepEqual(boundedMove(30,40,bounds),{x:30,y:40});
});
test('album photos have no rotation or stagger, including later pages',()=>{
 for(let i=0;i<30;i++)assert.equal(photoPose(i,true),'--rotation:0deg;--offset-y:0px');
});

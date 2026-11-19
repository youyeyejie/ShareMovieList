import {readFile,writeFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {isRetiredCover} from '../data.js';
import {DiscussionRepository} from '../discussions.js';
const window={};
runInNewContext(await readFile(new URL('../config.js',import.meta.url),'utf8'),{window});
if(!process.env.GH_TOKEN)throw Error('GH_TOKEN is required to export Discussions');
const repository=new DiscussionRepository(window.CINEMA_CONFIG,process.env.GH_TOKEN);
const entries=await repository.snapshot();
for(const entry of entries){
  if(isRetiredCover(entry.cover))entry.cover='';
}
await writeFile(new URL('../watchlists.json',import.meta.url),JSON.stringify({updatedAt:new Date().toISOString(),entries})+'\n');
console.log('Exported '+entries.length+' trusted discussion records.');

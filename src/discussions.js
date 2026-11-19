import {Repository,segment} from './repository.js';

export const discussionMarker='<!-- share-movie-list:v1 -->';
const discussionFields='id body authorAssociation';
export function decode(body){
  if(!body.startsWith(discussionMarker+'\n'))return null;
  const match=body.match(/\n```json\n([\s\S]*?)\n```$/);
  if(!match)return null;
  try{
    const value=JSON.parse(match[1]);
    if(!value || typeof value!=='object')return null;
    if(Object.hasOwn(value,'title')){
      if(!Array.isArray(value.lists)||!value.lists.length)return null;
      value.lists.forEach(segment);
    }else{
      segment(value.list);
    }
    return value;
  }catch{return null;}
}
function encode(value){
  // Escape backticks so user-authored notes cannot terminate the Markdown fence.
  const json=JSON.stringify(value,null,2).replaceAll('`','\\u0060');
  const body=discussionMarker+'\n\n```json\n'+json+'\n```';
  if(new TextEncoder().encode(body).length>65000)throw Error('影片资料超过讨论正文大小限制');
  return body;
}
function catalogFrom(entries){
  const names=[...new Set(entries.flatMap(entry=>Object.hasOwn(entry,'title')?entry.lists:[entry.list]))].sort();
  return {entries,tree:names.map(name=>({path:'lists/'+name,type:'tree'}))};
}

export class DiscussionRepository extends Repository {
  constructor(config,token=''){
    super(config,token);
    this.repoName=config.repository;
    this.category=config.discussionCategory||'Movies';
    this.listCategory='Movie Lists';
  }
  async graphql(query,variables){
    const response=await this.api('/graphql','POST',{query,variables});
    if(response.errors?.length)throw Error(response.errors.map(error=>error.message).join(' · '));
    return response.data;
  }
  async resolveCategory(){
    if(this.categoryId)return;
    const [owner,name]=this.repoName.split('/');
    const {repository}=await this.graphql(`query($owner:String!,$name:String!){
      repository(owner:$owner,name:$name){
        id discussionCategories(first:25){nodes{id name}}
      }
    }`,{owner,name});
    const categories=repository?.discussionCategories.nodes||[];
    const category=categories.find(item=>item.name===this.category);
    const lists=categories.find(item=>item.name===this.listCategory);
    if(!category)throw Error('请启用 GitHub Discussions 并创建分类「'+this.category+'」');
    if(!lists)throw Error('请创建 Movie Lists 讨论分类');
    this.listCategoryId=lists.id;
    this.categoryId=category.id;
    this.repositoryId=repository.id;
  }
  async snapshot(){
    await this.resolveCategory();
    const entries=[];
    const [owner,name]=this.repoName.split('/');
    for(const categoryId of [this.categoryId,this.listCategoryId]){
    let after=null;
    do{
      const {repository}=await this.graphql(`query($owner:String!,$name:String!,$category:ID!,$after:String){
        repository(owner:$owner,name:$name){
          discussions(first:50,categoryId:$category,after:$after){nodes{${discussionFields}} pageInfo{hasNextPage endCursor}}
        }
      }`,{owner,name,category:categoryId,after});
      const {nodes,pageInfo}=repository.discussions;
      for(const node of nodes){
        if(!['OWNER','MEMBER','COLLABORATOR'].includes(node.authorAssociation))continue;
        const item=decode(node.body);
        if(item && Object.hasOwn(item,'title') === (categoryId===this.categoryId))entries.push({...item,id:node.id,authorAssociation:node.authorAssociation});
      }
      after=pageInfo.hasNextPage?pageInfo.endCursor:null;
    }while(after);
    }
    return entries;
  }
  async catalog(){
    if(this.token)return catalogFrom(await this.snapshot());
    const localPreview=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
    const snapshotUrl=localPreview?'./watchlists.json':
      'https://raw.githubusercontent.com/'+this.repoName+'/watchlist-snapshot/watchlists.json';
    let response;
    try{response=await fetch(snapshotUrl,{cache:'no-store'});}
    catch{throw Error('无法读取公开片单，请检查网络后重试');}
    if(!response.ok)throw Error('公开片单正在更新，请稍后刷新');
    const snapshot=await response.json();
    if(!Array.isArray(snapshot.entries))throw Error('片单快照格式无效');
    const entries=snapshot.entries.filter(entry=>
      ['OWNER','MEMBER','COLLABORATOR'].includes(entry.authorAssociation) &&
      (Object.hasOwn(entry,'title')?Array.isArray(entry.lists):typeof entry.list==='string')
    );
    return catalogFrom(entries);
  }
  async movies(catalog,list){
    return catalog.entries.filter(item=>Object.hasOwn(item,'title')&&item.lists.includes(list))
      .map(item=>({...item,title:item.title||''}));
  }
  async create(title,value){
    await this.resolveCategory();
    const {createDiscussion}=await this.graphql(`mutation($input:CreateDiscussionInput!){
      createDiscussion(input:$input){discussion{id}}
    }`,{input:{repositoryId:this.repositoryId,categoryId:Object.hasOwn(value,'title')?this.categoryId:this.listCategoryId,title,body:encode(value)}});
    const {id}=createDiscussion.discussion;
    this.upvoteCleanupWarning='';
    // Creation may return before the automatic vote is visible. Check the stored
    // discussion after removing it, and retry cleanup without recreating the post.
    for(let attempt=0;attempt<2;attempt++){
      try{
        await this.graphql('mutation($id:ID!){removeUpvote(input:{subjectId:$id}){clientMutationId}}',{id});
      }catch{/* A discussion without a vote can reject the removal. Verify below. */}
      try{
        const {node}=await this.graphql('query($id:ID!){node(id:$id){... on Discussion{viewerHasUpvoted}}}',{id});
        if(node?.viewerHasUpvoted===false)return id;
      }catch{/* Retry the vote cleanup separately from the already completed write. */}
    }
    this.upvoteCleanupWarning='讨论已保存，暂未确认是否取消创建者的自动点赞。';
    return id;
  }
  async ensurePersonalList(catalog){
    this.upvoteCleanupWarning='';
    if(!this.writer)return catalog;
    const list=segment(this.writer);
    if(catalog.entries.some(item=>!Object.hasOwn(item,'title')&&item.list.toLowerCase()===list.toLowerCase()))return catalog;
    const entry={list};
    const id=await this.create(list,entry);
    return catalogFrom([...catalog.entries,{...entry,id}]);
  }
  async save(list,movie,remove=false){
    this.upvoteCleanupWarning='';
    if(!this.writer)throw Error('需要仓库写权限');
    segment(list);
    const entries=await this.snapshot();
    const {id,path,sha,legacyPath,authorAssociation,_copy,list:oldList,lists:memberships,...fields}=movie;
    let entry=entries.find(item=>item.id===id && Object.hasOwn(item,'title'));
    if(!entry && !remove)entry=entries.find(item=>Object.hasOwn(item,'title') &&
      ((fields.tmdb && item.tmdb===fields.tmdb)||(fields.url && item.url===fields.url)));
    if(remove&&!entry)throw Error('找不到影片讨论');
    const now=new Date().toISOString();
    if(remove){
      const lists=entry.lists.filter(name=>name!==list);
      if(lists.length)await this.update(entry.id,entry.title||'未命名作品',{...this.record(entry),lists,updatedAt:now});
      else await this.graphql('mutation($id:ID!){deleteDiscussion(input:{id:$id}){clientMutationId}}',{id:entry.id});
      return;
    }
    const record={...this.record(entry||{}),...fields,
      lists:[...new Set([...(entry?.lists||[]),list])],
      createdBy:entry?.createdBy||this.writer,
      createdAt:entry?.createdAt||now,updatedAt:now
    };
    if(entry && (_copy||entry.id!==id)){
      record.watched=entry.watched;
      record.watching=entry.watching;
    }
    record.watching=!record.watched && record.watching===true;
    const title=(record.title||'未命名作品').slice(0,160);
    if(!entry)return {...record,id:await this.create(title,record)};
    await this.update(entry.id,title,record);
    return {...record,id:entry.id};
  }
  record(entry){
    const {id,authorAssociation,...record}=entry;
    return record;
  }
  async update(id,title,value){
    await this.graphql('mutation($input:UpdateDiscussionInput!){updateDiscussion(input:$input){discussion{id}}}',{
      input:{discussionId:id,title,body:encode(value)}
    });
  }
  async move(from,to,movie){
    if(!this.writer)throw Error('需要仓库写权限');
    if(from===to)throw Error('请选择其他清单');
    const entries=await this.snapshot();
    const entry=entries.find(item=>item.id===movie.id&&Object.hasOwn(item,'title')&&item.lists?.includes(from));
    if(!entry||!entries.some(item=>(item.lists||[item.list]).includes(to)))throw Error('来源作品或目标片单已变更，请刷新');
    const record={
      ...this.record(entry),lists:[...new Set([...entry.lists.filter(name=>name!==from),to])],
      updatedAt:new Date().toISOString()
    };
    await this.update(entry.id,entry.title||'未命名作品',record);
    return {...entry,...record};
  }
}

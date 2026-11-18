const encodePath = path => path.split('/').map(encodeURIComponent).join('/');
export function segment(name) {
  if (!name || name.startsWith('.') || /[/\\\x00-\x1f]/.test(name)) throw Error('无效的文件或清单名称');
  return name;
}
export function moviePath(path, list) {
  const parts = path.split('/');
  if (parts[0] !== 'lists' || parts[1] !== segment(list)) return false;
  if (!parts.slice(2).every(s => s && !s.startsWith('.') && !s.includes('\\'))) return false;
  return (parts.length === 3 && parts[2].endsWith('.json')) || (parts.length === 4 && parts[3] === 'movie.json');
}
export function pinColor(login) {
  if (typeof login !== 'string' || !login) return '#777';
  const account = login.toLowerCase();
  if (account === 'youyeyejie') return '#088ae7';
  if (account === 'sensuschung') return '#a1d15e';
  let hash = 2166136261;
  for (const c of account) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return `hsl(${(hash >>> 0) % 360} 78% 56%)`;
}
export function encodeFile(data) {
  return btoa(Array.from(new TextEncoder().encode(data), byte => String.fromCharCode(byte)).join(''));
}
export class Repository {
  constructor({repository, branch}, token = '') {
    this.root = '/repos/' + repository;
    this.branch = branch;
    this.token = token;
    this.cache = new Map();
  }
  async api(path, method = 'GET', body, signal) {
    const response = await fetch('https://api.github.com' + path, {
      method, signal, cache: 'no-store',
      headers: {Accept:'application/vnd.github+json', ...(this.token && {Authorization:'Bearer ' + this.token}), ...(body && {'Content-Type':'application/json'})},
      ...(body && {body:JSON.stringify(body)})
    });
    if (!response.ok) {
      const msg = (await response.json().catch(()=>({}))).message || '';
      const error=Error(response.status === 409 ? '文件版本冲突，请刷新清单后重新编辑。' : `GitHub ${response.status} · ${msg}`);
      error.status=response.status;throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  async identity() {
    const user = await this.api('/user');
    const repo = await this.api(this.root);
    this.writer = repo.permissions?.push ? user.login : '';
    return user.login;
  }
  async catalog() {
    const head = await this.api(this.root+'/commits/'+encodeURIComponent(this.branch));
    const data = await this.api(this.root+'/git/trees/'+head.commit.tree.sha+'?recursive=1');
    if (data.truncated) throw Error('GitHub 返回的目录不完整，请缩小仓库目录规模');
    return {tree:data.tree, revision:head.sha};
  }
  async movies({tree, revision}, list) {
    const entries = tree.filter(e => e.type === 'blob' && e.mode === '100644' && moviePath(e.path,list));
    const results = [];
    for (let i=0;i<entries.length;i+=6) {
      results.push(...await Promise.all(entries.slice(i,i+6).map(async e => {
        const cacheKey = e.sha + ':' + e.path;
        if (!this.cache.has(cacheKey)) {
          const repository = this.root.slice('/repos/'.length);
          const response = await fetch('https://raw.githubusercontent.com/'+repository+'/'+revision+'/'+encodePath(e.path));
          if (!response.ok) throw Error('无法读取 '+e.path);
          const value = await response.json();
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(e.path+' 格式错误');
          if (!value.createdBy) {
            const first = await this.firstCommit(e.path, revision);
            value.createdBy = first?.author?.login || first?.commit?.author?.name || '';
            value.createdAt ||= first?.commit?.author?.date || '';
          }
          this.cache.set(cacheKey,value);
        }
        const value = this.cache.get(cacheKey);
        return {...value,title:value.title || '',id:e.path,path:e.path,sha:e.sha};
      })));
    }
    return results;
  }
  async firstCommit(path, revision) {
    const query = new URLSearchParams({path,sha:revision,per_page:'100'});
    let oldest;
    for(let page=1;;page++) {
      const history = await this.api(this.root+'/commits?'+query+'&page='+page);
      if (history.length) oldest=history.at(-1);
      if (history.length<100) return oldest;
    }
  }
  async commit(list, movie, remove=false, cover=null) {
    if (!this.writer) throw Error('需要仓库写权限');
    const {id,path,sha,...fields} = movie;
    const target = path || id || `lists/${segment(list)}/${crypto.randomUUID()}.json`;
    if (!moviePath(target,list) || ((path || remove) && !sha)) throw Error('文件路径或版本无效');
    const now = new Date().toISOString();
    const data = {...fields,createdBy:path ? fields.createdBy || '' : this.writer,createdAt:fields.createdAt || now,updatedAt:now};
    const action = remove?'移除':path?'更新':'添加';
    if(cover && !remove){
      const message=`feat(list): ${action}《${data.title || '未命名作品'}》与封面`;
      return this.commitWithCover({list,target,expectedSha:sha,data,message,cover});
    }
    const body = {branch:this.branch,message:`feat(list): ${action}《${data.title || '未命名作品'}》`,...(sha && {sha}),...(!remove && {content:encodeFile(JSON.stringify(data,null,2)+'\n')})};
    const result = await this.api(this.root+'/contents/'+encodePath(target),remove?'DELETE':'PUT',body);
    return {...data,id:target,path:target,sha:result.content?.sha};
  }
  async move(from,to,movie){
    if(!this.writer)throw Error('需要仓库写权限');
    segment(to);
    if(from===to || !moviePath(movie.path,from) || !movie.sha)throw Error('移动来源或目标无效');
    const {tree,revision}=await this.catalog();
    if(!tree.some(entry=>entry.type==='tree' && entry.path==='lists/'+to))throw Error('目标清单已不存在，请刷新');
    if(tree.find(entry=>entry.path===movie.path)?.sha!==movie.sha)throw Error('源文件已变更，请刷新后重试');
    const {id,path,sha,...record}=movie;
    const target='lists/'+to+'/'+crypto.randomUUID()+'.json';
    const changes=[
      {path:target,mode:'100644',type:'blob',content:JSON.stringify({...record,updatedAt:new Date().toISOString()},null,2)+'\n'},
      {path,mode:'100644',type:'blob',sha:null}
    ];
    const marker='lists/'+from+'/.gitkeep';
    if(!tree.some(entry=>entry.path===marker))changes.push({path:marker,mode:'100644',type:'blob',content:''});
    const head=await this.api(this.root+'/git/commits/'+revision);
    const next=await this.api(this.root+'/git/trees','POST',{base_tree:head.tree.sha,tree:changes});
    const commit=await this.api(this.root+'/git/commits','POST',{
      message:`feat(list): 将《${record.title||'未命名作品'}》从「${from}」移动到「${to}」`,
      tree:next.sha,parents:[revision]
    });
    await this.api(this.root+'/git/refs/heads/'+encodePath(this.branch),'PATCH',{sha:commit.sha,force:false});
  }
  async commitWithCover({list,target,expectedSha,data,message,cover}) {
    const head = await this.api(this.root+'/commits/'+encodeURIComponent(this.branch));
    const base = head.commit.tree.sha;
    const snapshot = await this.api(this.root+'/git/trees/'+base+'?recursive=1');
    if(snapshot.truncated)throw Error('无法验证当前文件版本');
    const existing = snapshot.tree.find(entry=>entry.path===target);
    if(existing?.sha!==expectedSha)throw Error('影片文件已变更，请刷新后重新编辑');

    const image = await this.api(this.root+'/git/blobs','POST',{encoding:'base64',content:cover.base64});
    const coverPath = `lists/${segment(list)}/.covers/${image.sha}.${cover.ext}`;
    const stored = {...data,cover:`https://raw.githubusercontent.com/${this.root.slice(7)}/${encodeURIComponent(this.branch)}/${encodePath(coverPath)}`};
    const json = await this.api(this.root+'/git/blobs','POST',{encoding:'utf-8',content:JSON.stringify(stored,null,2)+'\n'});
    const tree = await this.api(this.root+'/git/trees','POST',{base_tree:base,tree:[
      {path:coverPath,mode:'100644',type:'blob',sha:image.sha},
      {path:target,mode:'100644',type:'blob',sha:json.sha}
    ]});
    const commit = await this.api(this.root+'/git/commits','POST',{message,tree:tree.sha,parents:[head.sha]});
    // A concurrent push rejects this fast-forward; neither file is published alone.
    await this.api(this.root+'/git/refs/heads/'+encodePath(this.branch),'PATCH',{sha:commit.sha,force:false});
    return {...stored,id:target,path:target,sha:json.sha};
  }

}

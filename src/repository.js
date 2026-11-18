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
  let hash = 2166136261;
  for (const c of login.toLowerCase()) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
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
      throw Error(response.status === 409 ? '文件版本冲突，请刷新清单后重新编辑。' : `GitHub ${response.status} · ${msg}`);
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
  async commit(list, movie, remove=false) {
    if (!this.writer) throw Error('需要仓库写权限');
    const {id,path,sha,...fields} = movie;
    const target = path || `lists/${segment(list)}/${crypto.randomUUID()}.json`;
    if (!moviePath(target,list) || ((path || remove) && !sha)) throw Error('文件路径或版本无效');
    const now = new Date().toISOString();
    const data = {...fields,createdBy:path ? fields.createdBy || '' : this.writer,createdAt:fields.createdAt || now,updatedAt:now};
    const action = remove?'移除':path?'更新':'添加';
    const body = {branch:this.branch,message:`${action}《${data.title || '未命名作品'}》`,...(sha && {sha}),...(!remove && {content:encodeFile(JSON.stringify(data,null,2)+'\n')})};
    const result = await this.api(this.root+'/contents/'+encodePath(target),remove?'DELETE':'PUT',body);
    return {...data,id:target,path:target,sha:result.content?.sha};
  }
  async createList(name) {
    if (!this.writer) throw Error('需要仓库写权限');
    await this.api(this.root+'/contents/'+encodePath('lists/'+segment(name)+'/.gitkeep'),'PUT',{branch:this.branch,message:'创建片单 '+name,content:''});
  }
  async lookup(mode, query, signal) {
    if (!this.writer) throw Error('需要仓库写权限');
    const requestId = crypto.randomUUID();
    const workflow = this.root+'/actions/workflows/metadata.yml';
    await this.api(workflow+'/dispatches','POST',{ref:this.branch,inputs:{request_id:requestId,mode,query}},signal);
    for(let attempt=0;attempt<90;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,4000));
      signal.throwIfAborted();
      const runs = await this.api(workflow+'/runs?event=workflow_dispatch&per_page=50','GET',undefined,signal);
      const run = runs.workflow_runs.find(r=>r.display_title==='metadata-'+requestId);
      if (!run || run.status!=='completed') continue;
      if (run.conclusion!=='success') throw Error('资料查询失败，请检查仓库 Secret 或 Actions 运行记录；仍可手动保存。');
      const checks = await this.api(this.root+'/commits/'+run.head_sha+'/check-runs?check_name=metadata-'+requestId,'GET',undefined,signal);
      const check = checks.check_runs.find(c=>c.external_id===requestId && c.app?.slug==='github-actions');
      if (!check) throw Error('查询结果尚不可用');
      return JSON.parse(check.output.text);
    }
    throw Error('资料查询超时，可重试或手动填写');
  }
}

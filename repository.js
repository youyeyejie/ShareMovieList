export function segment(name) {
  if (!name || name.startsWith('.') || /[/\\\x00-\x1f]/.test(name)) throw Error('无效的文件或清单名称');
  return name;
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
}

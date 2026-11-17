const INVITE_VERSION=1;
export function validateSession(value){
  if(!value||typeof value!=='object'||value.version!==INVITE_VERSION)throw Error('共享链接格式无效');
  for(const k of ['readToken','accessToken','accountId','listId'])if(value[k]!=null&&(typeof value[k]!=='string'||value[k].length>4096))throw Error('共享凭证格式无效');
  if(!value.accessToken||!value.accountId||!/^\d+$/.test(value.listId||''))throw Error('共享链接缺少账号授权或清单 ID');
  return {readToken:value.readToken||'',accessToken:value.accessToken,accountId:value.accountId,listId:value.listId};
}
export function makeInvite(base,session){const data=validateSession({version:INVITE_VERSION,...session});const url=new URL(base);url.search='';url.hash=`access=${btoa(JSON.stringify({version:INVITE_VERSION,...data})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}`;return url.href;}
export function parseInvite(hash){const params=new URLSearchParams(hash.replace(/^#/,''));const encoded=params.get('access');if(!encoded)return null;if(encoded.length>25000)throw Error('共享链接过长');return validateSession(JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/'))));}

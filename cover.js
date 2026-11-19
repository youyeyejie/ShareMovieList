// Accept raster images only; imported bytes are stored separately from movie JSON.
export function coverFile(base64) {
  if(typeof base64!=='string'||!base64.length||base64.length>5592408)throw Error('请选择 4 MB 以内的封面图片');
  const bytes=atob(base64);
  if(bytes.length>4*1024*1024)throw Error('封面超过 4 MB');
  let ext;
  if(bytes.startsWith('\xff\xd8\xff'))ext='jpg';
  else if(bytes.startsWith('\x89PNG\r\n\x1a\n'))ext='png';
  else if(bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP')ext='webp';
  if(!ext)throw Error('封面需为 JPG、PNG 或 WebP 图片');
  return {base64,ext};
}
export function isDoubanCover(value) {
  try{return /(^|\.)(doubanio|douban)\.com$/i.test(new URL(value).hostname);}catch{return false;}
}

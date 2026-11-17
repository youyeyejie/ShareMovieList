// Static hanging-cable approximation: fixed endpoints, gravity, positive point
// loads and uniform cable weight. The Green function below keeps the cable
// concave under gravity; arbitrary clip heights would create unsupported peaks.
const NS='http://www.w3.org/2000/svg';
const ROTATIONS=[-5.5,3.5,-2,5,-3,2.5,-4.5,1.5];
function svgElement(tag,attrs){const el=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);return el;}
export function photoPose(index,inAlbum=false){return `--rotation:${ROTATIONS[index%8]}deg;--drop:0px`;}
export function cableHeight(u,left,right,loads=[],selfSag=10,tension=40){
  return left+(right-left)*u+4*selfSag*u*(1-u)+tension*loads.reduce((sum,load)=>sum+load.mass*Math.min(u,load.u)*(1-Math.max(u,load.u)),0);
}
export function suspensionX(width,height,angle,anchorY){
  // At equilibrium the sheet's centre of mass is vertically below its clip.
  return width/2-Math.tan(angle*Math.PI/180)*(height/2-anchorY);
}
export function drawRopes(wall){
  wall.querySelector('.rope-web')?.remove();
  const rows=[...wall.querySelectorAll('.rope-row')];
  if(!rows.length){
    const w=wall.clientWidth,h=wall.clientHeight;
    const empty=svgElement('svg',{class:'rope-web',width:w,height:h,viewBox:`0 0 ${w} ${h}`,'aria-hidden':'true',focusable:'false'});
    for(const [left,right,sag] of [[18,62,28],[h*.48,h*.35,24],[h-48,h-28,20]]){
      empty.append(svgElement('path',{class:'rope spare-rope',d:`M 0 ${left} Q ${w/2} ${(left+right)/2+2*sag},${w} ${right}`}));
      empty.append(svgElement('circle',{class:'pin',cx:0,cy:left,r:4}),svgElement('circle',{class:'pin',cx:w,cy:right,r:4}));
    }
    wall.prepend(empty);return;
  }
  const width=wall.clientWidth,plans=[];
  rows.forEach((row,index)=>{
    const photos=[...row.querySelectorAll('.photo')];
    const measured=photos.map(photo=>{
      const clip=photo.querySelector('.clip'),angle=parseFloat(getComputedStyle(photo).getPropertyValue('--rotation'))||0;
      const anchorY=parseFloat(getComputedStyle(clip).top)+clip.offsetHeight*.35;
      const anchorX=suspensionX(photo.offsetWidth,photo.offsetHeight,angle,anchorY);
      photo.style.transformOrigin=`${anchorX}px ${anchorY}px`;
      clip.style.left=`${anchorX-clip.offsetWidth/2}px`;clip.style.transform='none';
      return {photo,anchorY,x:row.offsetLeft+photo.offsetLeft+anchorX,mass:photo.offsetWidth*photo.offsetHeight};
    });
    const mean=measured.reduce((s,p)=>s+p.mass,0)/Math.max(measured.length,1);
    const loads=measured.map(p=>({u:p.x/width,mass:p.mass/mean}));
    const left=[24,56,32][index%3],right=[52,18,44][index%3];
    const selfSag=width<600?7:10,tension=width<600?32:40;
    const y=u=>cableHeight(u,left,right,loads,selfSag,tension);
    const topPadding=parseFloat(getComputedStyle(row).paddingTop);
    measured.forEach(p=>p.photo.style.setProperty('--drop',`${y(p.x/width)-topPadding-p.anchorY}px`));
    plans.push({row,loads,left,right,y});
  });
  // Margins above are in normal document flow. Measure rows after applying all
  // loads, so lower ropes move with the actual height of the preceding photos.
  const svg=svgElement('svg',{class:'rope-web',width,height:wall.scrollHeight,viewBox:`0 0 ${width} ${wall.scrollHeight}`,'aria-hidden':'true',focusable:'false'});
  const path=(d,cls='rope')=>svg.append(svgElement('path',{d,class:cls}));
  const pin=(x,y)=>svg.append(svgElement('circle',{cx:x,cy:y,r:4,class:'pin'}));
  const anchors=[];
  plans.forEach(({row,loads,left,right,y})=>{
    const top=row.offsetTop;
    // Sample every load exactly: a weight changes rope slope at the real clip.
    const points=[...new Set([0,1,...loads.map(l=>l.u),...Array.from({length:65},(_,i)=>i/64)])].sort((a,b)=>a-b);
    path(points.map((u,i)=>`${i?'L':'M'} ${u*width} ${top+y(u)}`).join(' '));
    pin(0,top+left);pin(width,top+right);
    // An unused slack rope still has two fixed supports and a gravity sag.
    const slackLeft=top+left+24,slackRight=top+right+55;
    path(`M 0 ${slackLeft} Q ${width*.5} ${(slackLeft+slackRight)/2+85},${width} ${slackRight}`,'rope spare-rope');pin(0,slackLeft);pin(width,slackRight);
    anchors.push({left:top+left,right:top+right});
  });
  for(let i=0;i<anchors.length-1;i+=2){
    const a=anchors[i],b=anchors[i+1],ay=a.left+100,by=b.right-12;
    path(`M 0 ${ay} Q ${width*.5} ${(ay+by)/2+55},${width} ${by}`,'rope cross-rope');pin(0,ay);pin(width,by);
    const cy=b.left-30,dy=a.right+35;
    path(`M 0 ${cy} Q ${width*.5} ${(cy+dy)/2+45},${width} ${dy}`,'rope cross-rope');pin(0,cy);pin(width,dy);
  }
  const last=anchors.at(-1);if(last)path(`M ${width} ${last.right} L ${width} ${last.right+60}`,'rope');
  wall.prepend(svg);
}

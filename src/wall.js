const ANGLES=[-4,2.5,-1.5,4,-3,1.5,-2.5,3];
export function photoPose(index,inAlbum=false){return `--rotation:${inAlbum?0:ANGLES[index%8]}deg;--offset-y:${inAlbum?0:[0,12,4,18,7,15,0,9][index%8]}px`;}
export function boundedMove(x,y,bounds){return {x:Math.max(bounds.minX,Math.min(bounds.maxX,x)),y:Math.max(bounds.minY,Math.min(bounds.maxY,y))};}
function readPositions(key){try{const value=JSON.parse(localStorage.getItem(key));return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
export function initBoard(wall,{key='default'}={}){
  const columns=Number(wall.style.getPropertyValue('--columns'))||2;
  const storageKey=`cinema-board:v1:${key}:${columns}`,saved=readPositions(storageKey);
  const write=()=>{try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}};
  const layerKey=storageKey+':layers';
  const order=readPositions(layerKey);
  const articles=[...wall.querySelectorAll('.photo')];
  let highest=Math.max(articles.length,0,...Object.values(order).filter(Number.isSafeInteger));
  articles.forEach((photo,index)=>{
    const pin=photo.querySelector('.pushpin'),id=photo.dataset.movieId;if(!pin)return;
    let x=0,y=0,gesture=null;
    const move=(nextX,nextY)=>{
      const rect=photo.getBoundingClientRect(),board=wall.getBoundingClientRect();
      const clamped=boundedMove(nextX,nextY,{minX:x+board.left+8-rect.left,maxX:x+board.right-8-rect.right,minY:y+board.top+12-rect.top,maxY:y+board.bottom-12-rect.bottom});
      x=clamped.x;y=clamped.y;photo.style.setProperty('--move-x',`${x}px`);photo.style.setProperty('--move-y',`${y}px`);
    };
    const persist=()=>{saved[id]={x:x/wall.clientWidth,y:y/wall.clientHeight};write();};
    const position=saved[id];if(position&&Number.isFinite(position.x)&&Number.isFinite(position.y))move(position.x*wall.clientWidth,position.y*wall.clientHeight);
    const raise=()=>{
      if(order[id]===highest)return;
      order[id]=++highest;
      photo.style.setProperty('--layer',String(highest));
      try{localStorage.setItem(layerKey,JSON.stringify(order));}catch{}
    };
    photo.style.setProperty('--layer',String(order[id]||index+1));
    photo.onpointerenter=raise;
    photo.addEventListener('focusin',raise);
    pin.onpointerdown=e=>{
      if(e.button!==0||!e.isPrimary)return;
      raise();e.preventDefault();gesture={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x,y};
      photo.classList.add('dragging');pin.setPointerCapture(e.pointerId);pin.focus({preventScroll:true});
    };
    pin.onpointermove=e=>{if(gesture?.pointerId===e.pointerId)move(gesture.x+e.clientX-gesture.startX,gesture.y+e.clientY-gesture.startY);};
    const end=(e,cancel=false)=>{
      if(gesture?.pointerId!==e.pointerId)return;
      if(cancel)move(gesture.x,gesture.y);else persist();
      gesture=null;photo.classList.remove('dragging');if(pin.hasPointerCapture(e.pointerId))pin.releasePointerCapture(e.pointerId);
    };
    pin.onpointerup=e=>end(e);pin.onpointercancel=e=>end(e,true);pin.onlostpointercapture=e=>{if(gesture)end(e,true);};
    pin.onkeydown=e=>{
      const step=e.shiftKey?24:8,directions={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
      if(e.key==='Escape'&&gesture){e.preventDefault();e.stopPropagation();end({pointerId:gesture.pointerId},true);return;}
      if(e.key==='Home'){e.preventDefault();move(0,0);persist();}
      if(directions[e.key]){e.preventDefault();const [dx,dy]=directions[e.key];move(x+dx,y+dy);persist();}
    };
  });
}

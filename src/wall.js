const ANGLES=[-4,2.5,-1.5,4,-3,1.5,-2.5,3];
const ROW_SHIFTS=[12,22,9,18];
export function photoPose(index,inAlbum=false,id=index){
  if(inAlbum)return '--rotation:0deg;--offset-y:0px';
  let hash=2166136261;
  for(const character of String(id))hash=Math.imul(hash^character.codePointAt(0),16777619);
  const offset=(hash>>>0)%21-8;
  return `--rotation:${ANGLES[index%ANGLES.length]}deg;--offset-y:${offset}px`;
}
export function boundedMove(x,y,bounds){return {x:Math.max(bounds.minX,Math.min(bounds.maxX,x)),y:Math.max(bounds.minY,Math.min(bounds.maxY,y))};}
function readPositions(key){try{const value=JSON.parse(localStorage.getItem(key));return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
export function initBoard(wall,{key='default'}={}){
  const columns=Number(wall.style.getPropertyValue('--columns'))||2;
  const storageKey=`cinema-board:v1:${key}:${columns}`,saved=readPositions(storageKey);
  const write=()=>{try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}};
  const layerKey=storageKey+':layers';
  const order=readPositions(layerKey);
  const frame=wall.closest('.board-frame');
  const scroller=frame && getComputedStyle(frame).overflowY==='auto' ? frame : document.scrollingElement;
  const articles=[...wall.querySelectorAll('.photo')];
  const rowStart=articles[0]?.offsetLeft;
  let row=0;
  let highest=Math.max(articles.length,0,...Object.values(order).filter(Number.isSafeInteger));
  articles.forEach((photo,index)=>{
    if(photo.offsetLeft===rowStart){
      photo.style.setProperty('--row-shift-x',`${ROW_SHIFTS[row++%ROW_SHIFTS.length]}px`);
    }
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
    photo.onpointerenter=event=>{if(event.pointerType!=='touch')raise();};
    photo.addEventListener('focusin',raise);
    // Preserve a normal click until the pointer has moved far enough to drag.
    let suppressClick=false,scrollFrame=0;
    function placeAtPointer(){
      const board=wall.getBoundingClientRect();
      move(gesture.x+gesture.clientX-gesture.startX+gesture.boardLeft-board.left,
           gesture.y+gesture.clientY-gesture.startY+gesture.boardTop-board.top);
    }
    function scrollAtEdge(){
      scrollFrame=0;
      if(!gesture?.dragging)return;
      const viewport=scroller===frame?frame.getBoundingClientRect():{top:0,bottom:innerHeight};
      const top=Math.max(0,viewport.top),bottom=Math.min(innerHeight,viewport.bottom);
      const edge=Math.min(56,(bottom-top)/4);
      const y=gesture.clientY;
      const speed=y<top+edge?-Math.min(1,(top+edge-y)/edge):
                  y>bottom-edge?Math.min(1,(y-bottom+edge)/edge):0;
      if(speed){
        const old=scroller.scrollTop;
        scroller.scrollTop+=Math.sign(speed)*Math.ceil(Math.abs(speed)*14);
        if(scroller.scrollTop!==old)placeAtPointer();
      }
      scrollFrame=requestAnimationFrame(scrollAtEdge);
    }
    photo.ondragstart=e=>e.preventDefault();
    photo.onpointerdown=e=>{
      if(e.button!==0 || !e.isPrimary || gesture || wall.dataset.pressed)return;
      suppressClick=false;
      // A swipe on the card scrolls on touch screens. The pin is the drag handle.
      if(e.pointerType==='touch' && !pin.contains(e.target))return;
      raise();
      const board=wall.getBoundingClientRect();
      gesture={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,
        clientX:e.clientX,clientY:e.clientY,boardTop:board.top,boardLeft:board.left,x,y,dragging:false};
      wall.dataset.pressed='true';
      // Capture on the original control so a stationary click still activates it.
      const target=e.target;
      target.setPointerCapture(e.pointerId);
    };
    photo.onpointermove=e=>{
      if(gesture?.pointerId!==e.pointerId)return;
      const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY;
      if(!gesture.dragging && Math.hypot(dx,dy)<6)return;
      gesture.dragging=true;
      photo.classList.add('dragging');
      gesture.clientX=e.clientX;gesture.clientY=e.clientY;
      placeAtPointer();
      if(!scrollFrame)scrollFrame=requestAnimationFrame(scrollAtEdge);
    };
    const end=(e,undo=false)=>{
      if(gesture?.pointerId!==e.pointerId)return;
      if(gesture.dragging){
        if(undo)move(gesture.x,gesture.y);
        persist();
        suppressClick=true;
      }
      cancelAnimationFrame(scrollFrame);scrollFrame=0;
      gesture=null;
      photo.classList.remove('dragging');
      delete wall.dataset.pressed;
      wall.dispatchEvent(new Event('board-release'));
    };
    photo.onpointerup=e=>end(e);
    photo.onpointercancel=e=>end(e,true);
    photo.onlostpointercapture=e=>end(e);
    photo.addEventListener('click',e=>{
      if(suppressClick && e.detail!==0){
        suppressClick=false;e.preventDefault();e.stopImmediatePropagation();
      }
    },true);
    pin.onkeydown=e=>{
      const step=e.shiftKey?24:8,directions={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
      if(e.key==='Escape'&&gesture){e.preventDefault();e.stopPropagation();end({pointerId:gesture.pointerId},true);return;}
      if(e.key==='Home'){e.preventDefault();move(0,0);persist();}
      if(directions[e.key]){e.preventDefault();const [dx,dy]=directions[e.key];move(x+dx,y+dy);persist();}
    };
  });
}

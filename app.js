const {words,check,shuffle,lineIndices,group,canSwap,constrainedShuffle}=Puzzle;
const $=id=>document.getElementById(id);
const MAX_MISTAKES=4;
const storageKey='cross-connections-001-lines-v2';
const fresh=()=>({board:shuffle(words),mistakes:0,status:'playing',orientation:null,locks:{row:[null,null,null,null],col:[null,null,null,null]}});
let state=fresh();
function validState(s){
 if(!s||!Array.isArray(s.board)||s.board.length!==16||new Set(s.board).size!==16||!s.board.every(w=>words.includes(w))||!Number.isInteger(s.mistakes)||s.mistakes<0||s.mistakes>MAX_MISTAKES||!['playing','won','lost'].includes(s.status)||![null,'families','crosses'].includes(s.orientation))return false;
 if(!['row','col'].every(axis=>Array.isArray(s.locks?.[axis])&&s.locks[axis].length===4&&s.locks[axis].every((lock,i)=>{if(lock===null)return true;if(!s.orientation)return false;const g=group(s.board,axis,i,s.orientation);return g&&g.type===lock.type&&g.id===lock.id;})))return false;
 const allLocked=[...s.locks.row,...s.locks.col].every(Boolean);
 return s.status==='won'?allLocked&&check(s.board)&&s.mistakes<MAX_MISTAKES:s.status==='lost'?s.mistakes===MAX_MISTAKES:s.mistakes<MAX_MISTAKES&&!allLocked;
}
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.status==='lost'&&saved.mistakes===3)saved.status='playing';if(validState(saved))state=saved;}catch{}
let selectedTile=null,selection=null,drag=null,suppressClick=false;
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
function message(text,kind=''){const f=$('feedback');f.textContent=text;f.className='feedback '+kind;}
const tile=i=>$('board').children[i];
function lockAt(axis,i){return state.locks[axis][i];}
function selectLine(axis,index){if(state.status!=='playing')return;const deselect=selection?.axis===axis&&selection.index===index;selection=deselect?null:{axis,index};selectedTile=null;render();const lock=lockAt(axis,index);message(deselect?'Tap a triangle to select a row or column.':lock?`${axis==='row'?'Row':'Column'} ${index+1}: ${lock.name} — correct.`:`${axis==='row'?'Row':'Column'} ${index+1} selected. Check these four words.`);$(axis==='row'?'row-arrows':'column-arrows').children[index].focus({preventScroll:true});}
function renderArrows(axis){const host=$(axis==='row'?'row-arrows':'column-arrows');host.replaceChildren();for(let i=0;i<4;i++){const b=document.createElement('button'),lock=lockAt(axis,i),active=selection?.axis===axis&&selection.index===i;b.type='button';b.className='line-arrow'+(active?' active':'')+(lock?' locked':'');b.innerHTML=lock?'<span aria-hidden="true">✓</span>':`<span aria-hidden="true">${axis==='row'?'▶':'▼'}</span>`;b.setAttribute('aria-label',`${axis==='row'?'Row':'Column'} ${i+1}${lock?': '+lock.name+', correct':', select to check'}`);b.setAttribute('aria-pressed',String(active));b.title=lock?lock.name:`Select ${axis==='row'?'row':'column'} ${i+1}`;b.disabled=state.status!=='playing';b.onclick=()=>selectLine(axis,i);host.append(b);}}
function drawOutlines(){const host=$('outlines');host.replaceChildren();for(const axis of ['row','col'])for(let i=0;i<4;i++){const lock=lockAt(axis,i),active=selection?.axis===axis&&selection.index===i;if(!lock&&!active)continue;const box=document.createElement('div');box.className='line-outline'+(lock?' locked':'')+(active?' active':'');box.style.gridRow=axis==='row'?String(i+1):'1 / 5';box.style.gridColumn=axis==='col'?String(i+1):'1 / 5';host.append(box);}}
function render(){
 const board=$('board');board.replaceChildren();
 state.board.forEach((word,i)=>{const b=document.createElement('button');const locked=lockAt('row',Math.floor(i/4))||lockAt('col',i%4);b.className='tile'+(selectedTile===i?' selected':'')+(locked?' grouped':'')+(state.status==='won'?' solved':'');b.textContent=word;b.dataset.index=i;b.type='button';b.disabled=state.status!=='playing';b.setAttribute('aria-label',`${word}, row ${Math.floor(i/4)+1}, column ${i%4+1}${locked?', in a correct group':''}`);b.setAttribute('aria-pressed',String(selectedTile===i));b.addEventListener('click',()=>selectTile(i));b.addEventListener('pointerdown',e=>startDrag(e,i));board.append(b);});
 renderArrows('row');renderArrows('col');drawOutlines();
 const count=[...state.locks.row,...state.locks.col].filter(Boolean).length;
 $('tries').textContent=state.status==='won'?'Solved':`${MAX_MISTAKES-state.mistakes} ${MAX_MISTAKES-state.mistakes===1?'mistake':'mistakes'} left`;
 $('dots').innerHTML=Array.from({length:MAX_MISTAKES},(_,i)=>i).map(i=>`<i class="${i<state.mistakes?'used':''}"></i>`).join('');
 document.querySelector('.attempts').setAttribute('aria-label',`${MAX_MISTAKES-state.mistakes} mistakes remaining`);
 $('submit').disabled=state.status!=='playing'||!selection||!!lockAt(selection.axis,selection.index);
 document.querySelector('.actions').hidden=state.status!=='playing';$('end-actions').hidden=state.status==='playing';
 $('instruction').textContent=state.status==='playing'?`${count} of 8 groups correct`:state.status==='won'?'Eight connections. Beautifully aligned.':'Four mistakes complete';
 $('shuffle').disabled=state.status!=='playing'||!state.board.some((_,a)=>state.board.some((_,b)=>canSwap(state.board,a,b,state.locks)));
 if(state.status==='won')message('You did it! All eight groups are correct.','success');
 if(state.status==='lost')message('Out of mistakes. Explore the solution, or give it another go.','error');
 save();
}
function swap(a,b){if(a===b)return;if(!canSwap(state.board,a,b,state.locks)){message('That swap would break a correct group. Try swapping within it.','error');return;}[state.board[a],state.board[b]]=[state.board[b],state.board[a]];selectedTile=null;render();message(selection?`Check the selected ${selection.axis==='row'?'row':'column'} when you're ready.`:'Tap a triangle to select a row or column.');tile(b).focus({preventScroll:true});}
function selectTile(i){if(suppressClick){suppressClick=false;return;}if(state.status!=='playing')return;if(selectedTile===null){selectedTile=i;render();tile(i).focus({preventScroll:true});}else if(selectedTile===i){selectedTile=null;render();tile(i).focus({preventScroll:true});}else swap(selectedTile,i);}
function targetAt(x,y){const el=document.elementFromPoint(x,y)?.closest('.tile');return el?.parentElement===$('board')?Number(el.dataset.index):null;}
function startDrag(e,i){if(e.button!==0||state.status!=='playing')return;drag={i,x:e.clientX,y:e.clientY,pointer:e.pointerId,el:e.currentTarget,moved:false,ghost:null};e.currentTarget.setPointerCapture(e.pointerId);}
document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;if(!drag.moved){drag.moved=true;drag.ghost=drag.el.cloneNode(true);drag.ghost.className='tile ghost';drag.ghost.setAttribute('aria-hidden','true');drag.ghost.style.width=drag.el.offsetWidth+'px';drag.ghost.style.height=drag.el.offsetHeight+'px';document.body.append(drag.ghost);drag.el.classList.add('dragging');}drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';const target=targetAt(e.clientX,e.clientY);document.querySelectorAll('.tile.target,.tile.blocked').forEach(el=>el.classList.remove('target','blocked'));if(target!==null&&target!==drag.i)tile(target).classList.add(canSwap(state.board,drag.i,target,state.locks)?'target':'blocked');});
function finishDrag(e,cancel=false){if(!drag||e.pointerId!==drag.pointer)return;const d=drag;drag=null;d.ghost?.remove();d.el.classList.remove('dragging');document.querySelectorAll('.tile.target,.tile.blocked').forEach(el=>el.classList.remove('target','blocked'));if(d.moved){suppressClick=true;setTimeout(()=>suppressClick=false,100);if(!cancel){const t=targetAt(e.clientX,e.clientY);if(t!==null&&t!==d.i)swap(d.i,t);}}}
document.addEventListener('pointerup',e=>finishDrag(e));document.addEventListener('pointercancel',e=>finishDrag(e,true));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){selectedTile=null;selection=null;render();}});
$('shuffle').onclick=()=>{if(state.status!=='playing')return;state.board=constrainedShuffle(state.board,state.locks);selectedTile=null;render();message('Tiles shuffled. Every correct group stays intact.');};
$('submit').onclick=()=>{
 if(state.status!=='playing'||!selection||lockAt(selection.axis,selection.index))return;
 const {axis,index}=selection;const g=group(state.board,axis,index,state.orientation);selectedTile=null;
 if(g){if(!state.orientation)state.orientation=axis==='row'?g.type:(g.type==='families'?'crosses':'families');state.locks[axis][index]=g;if([...state.locks.row,...state.locks.col].every(Boolean)&&check(state.board))state.status='won';render();if(state.status==='playing')message(`${g.name} — ${axis==='row'?'row':'column'} is correct!`,'success');}
 else{state.mistakes++;if(state.mistakes===MAX_MISTAKES)state.status='lost';render();if(state.status==='playing')message(`Not a matching group. ${MAX_MISTAKES-state.mistakes} ${MAX_MISTAKES-state.mistakes===1?'mistake':'mistakes'} remaining.`,'error');$('board').classList.remove('shake');void $('board').offsetWidth;$('board').classList.add('shake');}
};
$('reveal').onclick=()=>{$('solution').hidden=false;$('reveal').hidden=true;$('solution').scrollIntoView({behavior:'smooth',block:'start'});};
$('replay').onclick=()=>{state=fresh();selectedTile=null;selection=null;$('solution').hidden=true;$('reveal').hidden=false;render();message('Tap a triangle to select a row or column.');};
$('help').onclick=()=>$('rules').showModal();document.querySelector('.close').onclick=$('got-it').onclick=()=>$('rules').close();$('rules').addEventListener('click',e=>{if(e.target===$('rules')){const r=$('rules').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('rules').close();}});
render();

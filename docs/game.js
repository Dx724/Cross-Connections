(function(root){
 const solution=[['BEAR','LION','LEOPARD','BADGER'],['SWAN','EAGLE','GOOSE','DOVE'],['COD','BASS','CRAB','LOBSTER'],['CHERRY','GRAPE','PEA','MELON']];
 const words=solution.flat();
 const families=solution.map(x=>new Set(x));
 const crosses=solution[0].map((_,i)=>new Set(solution.map(row=>row[i])));
 const match=(line,sets)=>sets.findIndex(set=>line.length===4&&new Set(line).size===4&&line.every(w=>set.has(w)));
 function check(board){
  if(board.length!==16||new Set(board).size!==16||!board.every(w=>words.includes(w)))return false;
  const rows=Array.from({length:4},(_,r)=>board.slice(r*4,r*4+4));
  const cols=Array.from({length:4},(_,c)=>[0,1,2,3].map(r=>board[r*4+c]));
  const partition=(lines,sets)=>new Set(lines.map(line=>match(line,sets))).size===4&&lines.every(line=>match(line,sets)>=0);
  return (partition(rows,families)&&partition(cols,crosses))||(partition(rows,crosses)&&partition(cols,families));
 }
 function shuffle(input){const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 const names={families:['Mammals','Birds','Fish & shellfish','Fruits & vegetables'],crosses:['BLACK ___','SEA ___','SNOW ___','ROCK ___']};
 function lineIndices(axis,index){return [0,1,2,3].map(n=>axis==='row'?index*4+n:n*4+index);}
 function group(board,axis,index,orientation=null){
  const line=lineIndices(axis,index).map(i=>board[i]);
  const types=orientation?[axis==='row'?orientation:(orientation==='families'?'crosses':'families')]:['families','crosses'];
  for(const type of types){const id=match(line,type==='families'?families:crosses);if(id>=0)return {type,id,name:names[type][id]};}return null;
 }
 function canSwap(board,a,b,locks){
  if(a===b)return false;
  const next=[...board];[next[a],next[b]]=[next[b],next[a]];
  return ['row','col'].every(axis=>locks[axis].every((lock,i)=>!lock||lineIndices(axis,i).every(pos=>(lock.type==='families'?families:crosses)[lock.id].has(next[pos]))));
 }
 function constrainedShuffle(board,locks){const next=[...board];for(let n=0;n<160;n++){const a=Math.floor(Math.random()*16),b=Math.floor(Math.random()*16);if(canSwap(next,a,b,locks))[next[a],next[b]]=[next[b],next[a]];}return next;}
 const api={solution,words,families,crosses,check,shuffle,names,lineIndices,group,canSwap,constrainedShuffle};
 if(typeof module!=='undefined')module.exports=api;else root.Puzzle=api;
})(typeof window!=='undefined'?window:globalThis);

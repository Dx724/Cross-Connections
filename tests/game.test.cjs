const assert=require('node:assert/strict');
const p=require('../docs/game.js');
const empty=()=>({row:[null,null,null,null],col:[null,null,null,null]});
const locks=empty(),board=p.words.slice();
assert.equal(p.group(board,'row',0).name,'Mammals');assert.equal(p.group(board,'col',0).name,'BLACK ___');
locks.row[0]=p.group(board,'row',0);assert(p.canSwap(board,0,1,locks));assert(!p.canSwap(board,0,4,locks));assert(p.canSwap(board,4,5,locks));
locks.col[0]=p.group(board,'col',0);assert(!p.canSwap(board,0,1,locks));assert(!p.canSwap(board,0,4,locks));assert(p.canSwap(board,4,8,locks));assert(!p.canSwap(board,4,5,locks));assert(p.canSwap(board,5,6,locks));
for(let n=0;n<25;n++){const mixed=p.constrainedShuffle(board,locks);assert.equal(p.group(mixed,'row',0,'families').id,0);assert.equal(p.group(mixed,'col',0,'families').id,0);assert.deepEqual([...mixed].sort(),[...board].sort());}
const transpose=[0,1,2,3].flatMap(r=>[0,1,2,3].map(c=>board[c*4+r]));assert.equal(p.group(transpose,'row',0).type,'crosses');assert.equal(p.group(transpose,'col',0,'crosses').type,'families');assert(p.check(transpose));
const perm=a=>a.length?a.flatMap((x,i)=>perm(a.filter((_,j)=>i!==j)).map(y=>[x,...y])):[[]];let checks=0;
for(const r of perm([0,1,2,3]))for(const c of perm([0,1,2,3])){const b=r.flatMap(i=>c.map(j=>p.solution[i][j]));assert(p.check(b));for(const axis of ['row','col'])for(let i=0;i<4;i++)assert(p.group(b,axis,i,'families'));checks++;}
// Exercise the actual application handlers with an in-memory DOM and storage.
class El {constructor(){this.children=[];this.classList={add(){},remove(){}};this.dataset={};this.style={};}replaceChildren(){this.children=[];}append(x){this.children.push(x)}setAttribute(){}addEventListener(){}focus(){}showModal(){}close(){}scrollIntoView(){}}
const vm=require('node:vm'),fs=require('node:fs'),els=new Map();const get=id=>{if(!els.has(id))els.set(id,new El());return els.get(id)};
const document={getElementById:get,querySelector:get,querySelectorAll:()=>[],createElement:()=>new El(),addEventListener(){},body:new El()};let saved;
const ctx={Puzzle:p,document,localStorage:{getItem:()=>saved,setItem(k,v){saved=v}},setTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../docs/app.js'),'utf8'),ctx);const run=s=>vm.runInContext(s,ctx),snapshot=()=>JSON.parse(saved);
run('state.board=Puzzle.words.slice();render();selectLine("row",0)');assert.equal(run('selection.axis'),'row');run('selectLine("row",0)');assert.equal(run('selection'),null);assert(get('submit').disabled);run('selectLine("col",1);selectLine("col",1)');assert.equal(run('selection'),null);run('selectLine("row",0)');get('submit').onclick();assert.equal(snapshot().mistakes,0);assert.equal(snapshot().locks.row[0].name,'Mammals');assert(get('submit').disabled);
run('swap(0,1)');assert.equal(snapshot().board[0],'LION');run('swap(0,4)');assert.equal(snapshot().board[0],'LION');assert.equal(snapshot().mistakes,0);
get('replay').onclick();run('state.board=Puzzle.words.slice();render()');for(const axis of ['row','col'])for(let i=0;i<4;i++){run(`selectLine('${axis}',${i})`);get('submit').onclick();}assert.equal(snapshot().status,'won');assert.equal(snapshot().mistakes,0);assert(snapshot().locks.row.every(Boolean));assert(snapshot().locks.col.every(Boolean));assert(run('validState(state)'));
get('replay').onclick();run('state.board=Puzzle.words.slice();[state.board[0],state.board[5]]=[state.board[5],state.board[0]];render();selectLine("row",0)');for(let i=0;i<3;i++)get('submit').onclick();assert.equal(snapshot().mistakes,3);assert.equal(snapshot().status,'lost');get('submit').onclick();assert.equal(snapshot().mistakes,3);assert(run('validState(state)'));
get('replay').onclick();assert.equal(snapshot().mistakes,0);assert.equal(snapshot().status,'playing');assert(!run('validState({...state,mistakes:3})'));
run('state.board=Puzzle.words.slice();render();selectLine("col",0)');get('submit').onclick();assert.equal(snapshot().orientation,'families');assert.equal(snapshot().locks.col[0].type,'crosses');assert(run('validState(state)'));
console.log(`Passed ${checks} row/column permutations, constrained swaps and shuffle, transposition, all-eight-group win, three-mistake loss, replay, and persisted-state validation.`);

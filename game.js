(function(root){
 const puzzles=[
  {
    "id": "001",
    "number": 1,
    "published": "2026-10-04",
    "solution": [
      [
        "BEAR",
        "LION",
        "LEOPARD",
        "BADGER"
      ],
      [
        "SWAN",
        "EAGLE",
        "GOOSE",
        "DOVE"
      ],
      [
        "COD",
        "BASS",
        "CRAB",
        "LOBSTER"
      ],
      [
        "CHERRY",
        "GRAPE",
        "PEA",
        "MELON"
      ]
    ],
    "names": {
      "families": [
        "Mammals",
        "Birds",
        "Fish & shellfish",
        "Fruits & vegetables"
      ],
      "crosses": [
        "BLACK ___",
        "SEA ___",
        "SNOW ___",
        "ROCK ___"
      ]
    },
    "note": "A few uncommon connections: a rock badger is a hyrax, rockmelon is cantaloupe, and sea grape is a coastal plant with edible fruit. Black cod is also known as sablefish."
  },
  {
    "id": "002",
    "number": 2,
    "published": "2026-10-14",
    "solution": [
      [
        "ROWAN",
        "PALM",
        "PINE",
        "OLIVE"
      ],
      [
        "JAY",
        "TIT",
        "SWALLOW",
        "TEAL"
      ],
      [
        "RAY",
        "SOLE",
        "SMELT",
        "SALMON"
      ],
      [
        "LILY",
        "IRIS",
        "ROSE",
        "VIOLET"
      ]
    ],
    "names": {
      "families": [
        "Trees",
        "Birds",
        "Fish",
        "Flowers"
      ],
      "crosses": [
        "Given names",
        "Body parts",
        "Verbs",
        "Colors"
      ]
    },
    "note": "A new puzzle. Find all eight connections."
  },
  {
    "id": "004",
    "number": 3,
    "published": "2026-10-14",
    "solution": [
      [
        "LIP",
        "HEAD",
        "EYE",
        "SHOULDER"
      ],
      [
        "CARROT",
        "CHARCUTERIE",
        "MATZO",
        "TEA"
      ],
      [
        "CHOP",
        "KICK",
        "DODGE",
        "GRAB"
      ],
      [
        "DRUM",
        "KEY",
        "DISCO",
        "GIG"
      ]
    ],
    "names": {
      "families": [
        "Body parts",
        "Foods and drinks",
        "Combat actions",
        "Music terms"
      ],
      "crosses": [
        "___STICK",
        "___BOARD",
        "___BALL",
        "___BAG"
      ]
    },
    "note": "A new puzzle. Find all eight connections."
  }
];
 function create(definition){
 const {solution,names}=definition;
 const words=solution.flat();
 const families=solution.map(x=>new Set(x));
 const crosses=solution[0].map((_,i)=>new Set(solution.map(row=>row[i])));
 const match=(line,sets)=>sets.findIndex(set=>line.length===4&&new Set(line).size===4&&line.every(w=>set.has(w)));
 function bestMatch(line){
  const selected=new Set(line);
  return Math.max(...[...families,...crosses].map(set=>[...selected].filter(word=>set.has(word)).length));
 }
 function check(board){
  if(board.length!==16||new Set(board).size!==16||!board.every(w=>words.includes(w)))return false;
  const rows=Array.from({length:4},(_,r)=>board.slice(r*4,r*4+4));
  const cols=Array.from({length:4},(_,c)=>[0,1,2,3].map(r=>board[r*4+c]));
  const partition=(lines,sets)=>new Set(lines.map(line=>match(line,sets))).size===4&&lines.every(line=>match(line,sets)>=0);
  return (partition(rows,families)&&partition(cols,crosses))||(partition(rows,crosses)&&partition(cols,families));
 }
 function shuffle(input){const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
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
 return {...definition,solution,words,families,crosses,check,shuffle,names,lineIndices,group,bestMatch,canSwap,constrainedShuffle};
 }
 puzzles.sort((a,b)=>a.published.localeCompare(b.published)||a.number-b.number);
 const api={...create(puzzles[puzzles.length-1]),puzzles,create};
 if(typeof module!=='undefined')module.exports=api;else root.Puzzle=api;
})(typeof window!=='undefined'?window:globalThis);

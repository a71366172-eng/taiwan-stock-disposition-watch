const key='stock-watch.favorites',eventName='stock-watch-favorites-changed';
let fallback='[]';
export function readFavorites(){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
export function subscribeFavorites(callback:()=>void){window.addEventListener('storage',callback);window.addEventListener(eventName,callback);return()=>{window.removeEventListener('storage',callback);window.removeEventListener(eventName,callback);};}
export function parseFavorites(value:string):string[]{try{const data=JSON.parse(value);return Array.isArray(data)?data.filter(v=>typeof v==='string'):[];}catch{return [];}}
export function toggleFavorite(code:string){const current=parseFavorites(readFavorites()),next=current.includes(code)?current.filter(c=>c!==code):[...current,code];fallback=JSON.stringify(next);let saved=true;try{localStorage.setItem(key,fallback);}catch{saved=false;}window.dispatchEvent(new Event(eventName));return saved;}

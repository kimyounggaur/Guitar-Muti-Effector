import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root = 'dist';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name)))).flat();
}
const files = (await walk(root)).filter(f => !f.endsWith('/sw.js')).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const cacheName = `guitar-multieffector-${hash.digest('hex').slice(0, 16)}`;
const assets = files.map(f => `./${relative(root, f).replaceAll('\\', '/')}`);
const source = `const CACHE=${JSON.stringify(cacheName)};
const ASSETS=${JSON.stringify(assets)};
const scope=new URL('./',self.location.href);
const urls=ASSETS.map(path=>new URL(path,scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('guitar-multieffector-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.match(new URL('./index.html',scope).href)));
 }else if(urls.includes(url.href)){
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request))||fetch(request)));
 }
});
`;
await writeFile(join(root,'sw.js'),source);
console.log(`Offline cache prepared: ${assets.length} application files`);

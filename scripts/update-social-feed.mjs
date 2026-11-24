// Read-only Meta feed. The token is supplied by GitHub Actions, never by the browser.
import {writeFile} from 'node:fs/promises';
const token=process.env.META_PAGE_ACCESS_TOKEN, page=process.env.META_PAGE_ID||'869344019766232', version=process.env.META_GRAPH_VERSION||'v27.0';
if(!token||!/^\d+$/.test(page)||!/^v\d+\.\d+$/.test(version)) throw Error('Configurazione Meta mancante o non valida');
async function graph(path,fields,limit){
 const url=new URL('https://graph.facebook.com/'+version+'/'+path);
 url.searchParams.set('fields',fields);if(limit)url.searchParams.set('limit',String(limit));
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});
 const body=await r.json();if(!r.ok||body.error)throw Error('Meta API: richiesta non riuscita ('+r.status+', codice '+(body.error?.code||'n/d')+')');
 return body;
}
function safeURL(value,domains){try{const u=new URL(value);return u.protocol==='https:'&&domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d))&&!u.username&&!u.password&&!u.searchParams.has('access_token')&&!value.includes(token)?u.href:null}catch{return null}}
const mediaURL=u=>safeURL(u,['fbcdn.net','cdninstagram.com','fbsbx.com']);
function item(source,id,date,caption,photo,link){
 const img=mediaURL(photo),href=safeURL(link,source==='Instagram'?['instagram.com']:['facebook.com','fb.com']);
 if(!img||!href||!Number.isFinite(Date.parse(date)))return null;
 return {source,id:String(id),date,caption:String(caption||'').replace(/\s+/g,' ').trim().slice(0,180),image:img,url:href};
}
const account=await graph(page,'id,name,instagram_business_account{id,username}');
if(account.id!==page||!account.instagram_business_account?.id)throw Error('La pagina non ha un account Instagram professionale collegato');
if(account.instagram_business_account.username?.toLowerCase()!=='pizzerialanticoarco')throw Error('Il profilo Instagram collegato non corrisponde a quello previsto');
const ig=account.instagram_business_account.id;if(!/^\d+$/.test(ig))throw Error('ID Instagram non valido');
const [f,g]=await Promise.all([
 graph(page+'/posts','id,message,created_time,permalink_url,full_picture,attachments{media_type,type}',18),
 graph(ig+'/media','id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}',18)
]);
if(!Array.isArray(f.data)||!Array.isArray(g.data))throw Error('Risposta Meta inattesa');
const fb=f.data.filter(p=>(p.attachments?.data||[]).some(a=>['photo','video','album'].includes(a.media_type)||['photo','video','album','video_inline','multi_share'].includes(a.type))).map(p=>item('Facebook',p.id,p.created_time,p.message,p.full_picture,p.permalink_url)).filter(Boolean);
const ins=g.data.map(p=>{let img=p.media_type==='VIDEO'?p.thumbnail_url:p.media_url; if(!img&&p.children?.data?.length){const ch=p.children.data[0];img=ch.media_type==='VIDEO'?ch.thumbnail_url:ch.media_url}return item('Instagram',p.id,p.timestamp,p.caption,img,p.permalink)}).filter(Boolean);
const items=[...fb.slice(0,5),...ins.slice(0,5)].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
if(!items.length)throw Error('Nessun contenuto fotografico disponibile; il sito conserva la galleria locale');
await writeFile(process.argv[2]||'social-feed.json',JSON.stringify({version:1,updatedAt:new Date().toISOString(),items},null,2)+'\n');
console.log('Feed generato: '+items.length+' pubblicazioni, senza credenziali.');

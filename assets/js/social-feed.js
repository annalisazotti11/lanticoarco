(function(){
 var root=document.getElementById('socialLatest');if(!root)return;
 var url='https://raw.githubusercontent.com/annalisazotti11/lanticoarco/social-feed/social-feed.json',started=false;
 function safe(s,hosts){try{var u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.searchParams.has('access_token')&&hosts.some(function(h){return u.hostname===h||u.hostname.endsWith('.'+h)})?u.href:null}catch(e){return null}}
 async function load(){if(started)return;started=true;try{
 var r=await fetch(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)return;var d=await r.json();
 var age=Date.now()-Date.parse(d.updatedAt);if(d.version!==1||!Number.isFinite(age)||age< -300000||age>86400000||!Array.isArray(d.items))return;
 var grid=root.querySelector('.social-latest-grid');
 d.items.slice(0,6).forEach(function(it){if(!it||!['Facebook','Instagram'].includes(it.source))return;
 var photo=safe(it.image,['fbcdn.net','cdninstagram.com','fbsbx.com']),href=safe(it.url,it.source==='Instagram'?['instagram.com']:['facebook.com','fb.com']);if(!photo||!href)return;
 var a=document.createElement('a');a.className='social-latest-card';a.href=href;a.target='_blank';a.rel='noopener noreferrer';
 var im=document.createElement('img');im.src=photo;im.alt='';im.loading='lazy';im.referrerPolicy='no-referrer';im.decoding='async';
 var text=document.createElement('span'),b=document.createElement('b'),p=document.createElement('span');b.textContent=it.source+' ↗';p.textContent=String(it.caption||'').slice(0,140)||'Guarda il post';text.append(b,p);a.append(im,text);grid.append(a);
 im.addEventListener('error',function(){a.remove();if(!grid.children.length)root.hidden=true},{once:true});
 });
 root.hidden=!grid.children.length;
 }catch(e){/* Keep the original gallery on any network/API failure. */}}
 // Fetch only near the gallery; no Meta SDK, tracking widget or authentication in the browser.
 var album=document.getElementById('album');if('IntersectionObserver'in window&&album){var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting})){io.disconnect();load()}},{rootMargin:'300px'});io.observe(album)}else load();
})();
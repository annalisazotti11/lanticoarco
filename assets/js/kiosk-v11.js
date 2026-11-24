/* L'Antico Arco: kiosk selection only, in-memory. No orders are transmitted. */
(function () {
 'use strict';
 if (!document.documentElement.classList.contains('kiosk-v11')) return;
 var AA = window.AA, root = document.documentElement, lines = [], lastFocus = null, timer = 0, exitTimer = 0, countdown = 0, toastTimer = 0, waiterMode = false;
 if (!AA) return;
 var params = new URLSearchParams(location.search), rawIdle = Number(params.get('attesa'));
 var idleMs = (rawIdle > 0 ? Math.max(20, Math.min(rawIdle,3600)) : 150) * 1000;
 var esc = AA.esc;
 function el(id){return document.getElementById(id);}
 function price(v){return AA.price(Math.round(v*100)/100);}
 function total(){return lines.reduce(function(t,l){return t+l.unit*l.qty;},0);}
 function count(){return lines.reduce(function(n,l){return n+l.qty;},0);}
 function unknown(){return lines.some(function(l){return l.unknown;});}
 function totalText(){return price(total())+(unknown()?' + da confermare':'');}
 function key(l){return JSON.stringify([l.id,l.unit,l.unknown,l.details,l.allergens,l.review]);}
 var prevCount=0; var bar=document.createElement('div');bar.id='k11Bar';bar.className='k11-bottom';bar.innerHTML='<button type="button" class="k11-back-tv" data-k11-action="exit"><span aria-hidden="true">⌂</span><span>Cartellone</span></button><div class="k11-bottom-copy"><span>La mia selezione · <b id="k11Count">0 piatti</b></span><strong id="k11Total" aria-live="polite">€ 0</strong></div><button type="button" class="k11-cart-open" data-k11-action="cart"><svg class="k13-basket" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-2 10H6L4 9Zm4 0 4-5 4 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Apri selezione</span><span aria-hidden="true">→</span></button>';
 document.body.appendChild(bar);
 var toast=document.createElement('div');toast.id='k11Toast';toast.className='k11-toast';toast.setAttribute('role','status');toast.hidden=true;document.body.appendChild(toast);
 var cart=document.createElement('div');cart.id='k11Cart';cart.className='k11-modal';cart.hidden=true;cart.setAttribute('role','dialog');cart.setAttribute('aria-modal','true');cart.setAttribute('aria-labelledby','k11CartTitle');cart.innerHTML='<div class="k11-modal-bg" data-k11-action="close"></div><section class="k11-modal-card" tabindex="-1"><header class="k11-modal-head"><div><p>LA TUA SERATA ALL’ANTICO ARCO</p><h2 id="k11CartTitle">La mia selezione</h2></div><button type="button" class="k11-close" data-k11-action="close" aria-label="Chiudi selezione">×</button></header><div id="k11CartBody" class="k11-cart-body"></div><footer id="k11CartFoot" class="k11-cart-foot"></footer></section>';
 document.body.appendChild(cart);
 var exit=document.createElement('div');exit.id='k11Exit';exit.className='k11-modal k11-exit-modal';exit.hidden=true;exit.setAttribute('role','dialog');exit.setAttribute('aria-modal','true');exit.setAttribute('aria-labelledby','k11ExitTitle');exit.innerHTML='<div class="k11-modal-bg"></div><section class="k11-exit-card"><p class="k11-eyebrow">L’ANTICO ARCO</p><h2 id="k11ExitTitle">Stai ancora scegliendo?</h2><p id="k11ExitText"></p><strong id="k11Countdown" hidden></strong><div class="k11-exit-buttons"><button type="button" class="k11-cart-open" data-k11-action="continue">Continua a esplorare</button><button type="button" class="b-ghost" data-k11-action="finish">Torna al cartellone</button></div></section>';
 document.body.appendChild(exit);

 function updateBar(){var n=count();el('k11Count').textContent=n+' '+(n===1?'piatto':'piatti');el('k11Total').textContent=totalText();bar.classList.toggle('k13-has-selection',n>0);if(n!==prevCount){bar.classList.remove('k13-cart-pulse');void bar.offsetWidth;bar.classList.add('k13-cart-pulse');prevCount=n;}}
 function renderCart(){
  el('k11CartTitle').textContent=waiterMode?'Mostra al cameriere':'La mia selezione';
  var h=lines.length?lines.map(function(l,i){
   var photo=l.image?'<img src="'+esc(AA.src(l.image))+'" alt="" loading="lazy">':'<span class="k11-cart-no-photo" aria-hidden="true">'+AA.archSVG()+'</span>';
   return '<article class="k11-cart-line"><div class="k11-line-photo">'+photo+'</div><div class="k11-line-main"><h3><span class="k11-qty-label">'+l.qty+'×</span> '+esc(l.name)+'</h3>'+(l.details.length?'<ul>'+l.details.map(function(d){return '<li>'+esc(d)+'</li>';}).join('')+'</ul>':'<p>Come da ricetta</p>')+((l.review||l.allergens.length)?'<p class="k11-line-allergens">'+(l.review?'Allergeni da confermare con il personale. ':'')+(l.allergens.length?'Indicati e/o possibili tracce: '+esc(l.allergens.join(', ')):'')+'</p>':'')+'</div><div class="k11-line-end"><strong class="num">'+price(l.unit*l.qty)+(l.unknown?' + ?':'')+'</strong>'+(!waiterMode?'<div class="k11-quantity"><button type="button" data-k11-action="minus" data-index="'+i+'" aria-label="Diminuisci '+esc(l.name)+'">−</button><b>'+l.qty+'</b><button type="button" data-k11-action="plus" data-index="'+i+'" aria-label="Aumenta '+esc(l.name)+'">+</button></div><button type="button" class="k11-remove" data-k11-action="remove" data-index="'+i+'" aria-label="Rimuovi '+esc(l.name)+'">Rimuovi</button>':'')+'</div></article>';
  }).join(''):'<div class="k11-cart-empty"><span aria-hidden="true">✦</span><h3>Non hai ancora scelto nulla</h3><p>Apri un piatto, scegli le opzioni e aggiungilo qui. Puoi mostrare la selezione al personale.</p><button type="button" class="k11-cart-open" data-k11-action="close">Esplora il menù</button></div>';
  if(lines.length)h+='<p class="k11-cart-warning">Allergie o intolleranze? Conferma sempre ingredienti, varianti e possibili tracce con il personale. La selezione non garantisce l’assenza di allergeni.</p>';
  el('k11CartBody').innerHTML=h;
  el('k11CartFoot').innerHTML='<div><span>'+(unknown()?'Parziale noto · prezzi da confermare':'Totale piatti')+'</span><strong class="num">'+totalText()+'</strong><small>Coperto escluso. Nessun ordine è stato inviato.</small></div><div class="k11-cart-foot-actions">'+(waiterMode?'<button type="button" class="k11-cart-open" data-k11-action="edit">Torna alla selezione</button>':lines.length?'<button type="button" class="b-ghost" data-k11-action="clear">Svuota</button><button type="button" class="k11-cart-open" data-k11-action="waiter">Mostra al cameriere</button>':'')+'</div>';
 }
 function openCart(){lastFocus=document.activeElement;waiterMode=false;renderCart();cart.hidden=false;document.body.style.overflow='hidden';cart.querySelector('.k11-modal-card').focus({preventScroll:true});el('k11CartBody').scrollTop=0;}
 function closeCart(){cart.hidden=true;waiterMode=false;document.body.style.overflow='';if(lastFocus&&lastFocus.isConnected)lastFocus.focus({preventScroll:true});}
 function add(l){
  if(!l||!l.id||!l.name||!Number.isFinite(Number(l.unit))||Number(l.unit)<0)return;
  var clean={id:String(l.id),name:String(l.name),image:l.image||'',unit:Number(l.unit),unknown:!!l.unknown,details:(l.details||[]).slice(),allergens:(l.allergens||[]).slice(),review:!!l.review,qty:1};
  var k=key(clean), old=lines.find(function(x){return key(x)===k;});if(old)old.qty=Math.min(99,old.qty+1);else lines.push(clean);
  updateBar();toast.textContent=clean.name+' · aggiunto alla selezione';toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){toast.hidden=true;},2400);wake();
 }
 function reset(){lines=[];location.href='../totem/';}
 function openExit(isIdle){
  clearTimeout(timer);clearInterval(exitTimer);exit.hidden=false;
  el('k11ExitTitle').textContent=isIdle?'Stai ancora scegliendo?':'Tornare al cartellone?';
  el('k11ExitText').textContent=lines.length?'La selezione contiene '+count()+' '+(count()===1?'piatto':'piatti')+'. Tornando al cartellone verrà cancellata.':'Il menù verrà riportato alla schermata iniziale.';
  el('k11Countdown').hidden=!isIdle;
  if(isIdle){countdown=25;el('k11Countdown').textContent='Ritorno tra '+countdown+' s';exitTimer=setInterval(function(){countdown--;el('k11Countdown').textContent='Ritorno tra '+countdown+' s';if(countdown<=0)reset();},1000);}
  exit.querySelector('[data-k11-action="continue"]').focus({preventScroll:true});
 }
 function wake(){if(!exit.hidden)return;clearTimeout(timer);timer=setTimeout(function(){if(lines.length||document.querySelector('#builder:not([hidden]),#sheet:not([hidden]),#k11Cart:not([hidden])'))openExit(true);else reset();},idleMs);}
 function requestExit(){if(lines.length||document.querySelector('#builder:not([hidden]),#sheet:not([hidden]),#k11Cart:not([hidden])'))openExit(false);else reset();}
 window.AAKiosk11={add:add,requestExit:requestExit,count:count};
 document.addEventListener('click',function(e){
  var b=e.target.closest('[data-k11-action]');if(!b)return;var action=b.dataset.k11Action,i=Number(b.dataset.index);
  if(action==='cart')openCart();else if(action==='close')closeCart();else if(action==='exit')requestExit();
  else if(action==='continue'){exit.hidden=true;clearInterval(exitTimer);wake();}
  else if(action==='finish')reset();
  else if(action==='waiter'){waiterMode=true;renderCart();el('k11CartBody').scrollTop=0;}
  else if(action==='edit'){waiterMode=false;renderCart();}
  else if(action==='clear'){if(!lines.length)return;var foot=el('k11CartFoot');foot.innerHTML='<p><b>Svuotare tutta la selezione?</b></p><div class="k11-cart-foot-actions"><button class="b-ghost" type="button" data-k11-action="cancel-clear">Annulla</button><button class="k11-cart-open" type="button" data-k11-action="confirm-clear">Svuota</button></div>';}
  else if(action==='cancel-clear')renderCart();else if(action==='confirm-clear'){lines=[];renderCart();updateBar();}
  else if(lines[i]){if(action==='plus')lines[i].qty=Math.min(99,lines[i].qty+1);else if(action==='minus'&&lines[i].qty>1)lines[i].qty--;else if(action==='minus'||action==='remove')lines.splice(i,1);else return;var scroll=el('k11CartBody').scrollTop;renderCart();updateBar();el('k11CartBody').scrollTop=scroll;}
 });
 document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;if(!exit.hidden){exit.hidden=true;clearInterval(exitTimer);wake();}else if(!cart.hidden)closeCart();});
 ['pointerdown','touchstart','keydown','wheel','scroll','input'].forEach(function(event){window.addEventListener(event,wake,{capture:true,passive:true});});
 updateBar();wake();
})();

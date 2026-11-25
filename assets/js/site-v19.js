/* V19.2 — photo-registered motion driven by real flame footage, not a periodic whole-image wave. */
(function(){
"use strict";
var pref=window.matchMedia("(prefers-reduced-motion: reduce)");
var canvas=document.getElementById("v19Fire"),fire=document.getElementById("fire");
var heroLoop=document.getElementById("heroLoop"),realPlaying=false;
if(heroLoop){
 function heroState(active){realPlaying=active&&!pref.matches;heroLoop.classList.toggle("is-playing",realPlaying);}
 heroLoop.muted=true;heroLoop.defaultMuted=true;
 heroLoop.addEventListener("playing",function(){heroState(true);});
 ["waiting","stalled","pause","error","emptied"].forEach(function(event){heroLoop.addEventListener(event,function(){heroState(false);});});
 function heroPreference(){if(pref.matches){heroLoop.pause();heroState(false);}else{var play=heroLoop.play();if(play&&play.catch)play.catch(function(){heroState(false);});}}
 if(pref.addEventListener)pref.addEventListener("change",heroPreference);
 heroPreference();
}
if(canvas&&fire&&!pref.matches)try{
 var gl=canvas.getContext("webgl",{alpha:false,antialias:false,powerPreference:"low-power"});
 if(gl){
  var vert="attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}";
  var frag=[
   "precision mediump float;",
   "uniform sampler2D photo,flameVideo;uniform vec2 resolution,photoSize,anchor;uniform float time;",
   "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
   "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}",
   "float bright(vec3 c){return max(c.r,max(c.g,c.b));}",
   "float fireMask(vec3 c){return smoothstep(.72,.96,c.r)*smoothstep(.27,.85,c.g);}",
   "void main(){",
   "vec2 xy=vec2(gl_FragCoord.x/resolution.x,1.-gl_FragCoord.y/resolution.y);",
   "float sc=max(resolution.x/photoSize.x,resolution.y/photoSize.y);vec2 covered=resolution/(photoSize*sc);",
   "vec2 uv=xy*covered+(1.-covered)*anchor;vec3 base=texture2D(photo,uv).rgb;",
   // Flame area in the actual photo. The wood and bricks remain geometrically stable.
   "float zone=1.-smoothstep(.76,1.1,length((uv-vec2(.547,.36))/vec2(.205,.38)));",
   "float root=1.-smoothstep(.22,.72,uv.y);float strength=zone*fireMask(base);",
   // Actual filmed fire is mapped into the existing flame silhouette, following an upward flow.
   "vec2 fv=(uv-vec2(.395,.015))/vec2(.305,.68);",
   "vec2 vt=clamp(fv,vec2(.003),vec2(.997));",
   "vec3 film=texture2D(flameVideo,vt).rgb;",
   "float filmed=dot(film,vec3(.32,.55,.13));",
   "float fEdge=smoothstep(.16,.42,filmed);",
   "float n=noise(uv*vec2(16.,12.)+vec2(0.,time*2.3));",
   "float fine=noise(uv*vec2(27.,22.)+vec2(time*.35,time*3.6));",
   "vec2 flow=vec2((n-.5)*.052+(filmed-.45)*.027,(fine-.5)*.028+.013*(filmed-.5));",
   "vec2 move=uv+flow*strength*(.24+.76*root);",
   "vec3 warped=texture2D(photo,clamp(move,vec2(.001),vec2(.999))).rgb;",
   "vec3 col=mix(base,warped,strength);",
   "float pulse=.79+.32*filmed+.12*fine;",
   "col*=1.+strength*(pulse-1.);",
   "vec3 light=vec3(1.,.57,.15)*smoothstep(.26,.83,filmed)*fEdge;",
   "col+=light*strength*(.045+.045*root)*(1.-col*.68);",
   // Reflections respond to the real film but remain still.
   "float reflected=(1.-smoothstep(.1,.25,abs(uv.x-.55)))*smoothstep(.69,.8,uv.y);",
   "float glow=dot(texture2D(flameVideo,vec2(.5,.62)).rgb,vec3(.3,.55,.15));",
   "col*=1.+reflected*(glow-.45)*.12;",
   "gl_FragColor=vec4(col,1.);}"
  ].join("\n");
  function shader(type,source){var sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
  var pr=gl.createProgram();gl.attachShader(pr,shader(gl.VERTEX_SHADER,vert));gl.attachShader(pr,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error("fire shader link");gl.useProgram(pr);
  var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var pos=gl.getAttribLocation(pr,"position");gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  function texture(unit){var tx=gl.createTexture();gl.activeTexture(unit);gl.bindTexture(gl.TEXTURE_2D,tx);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return tx;}
  var photo=texture(gl.TEXTURE0),videoTex=texture(gl.TEXTURE1);
  var uniform={};["photo","flameVideo","resolution","photoSize","anchor","time"].forEach(function(n){uniform[n]=gl.getUniformLocation(pr,n);});gl.uniform1i(uniform.photo,0);gl.uniform1i(uniform.flameVideo,1);
  var video=document.createElement("video");video.muted=true;video.defaultMuted=true;video.playsInline=true;video.loop=true;video.preload="metadata";video.setAttribute("aria-hidden","true");video.style.cssText="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none";fire.appendChild(video);
  ["webm","mp4"].forEach(function(ext){var s=document.createElement("source");s.src=new URL("assets/video/fiamma."+ext,document.baseURI).href;s.type="video/"+ext;video.appendChild(s);});
  var img=new Image(),loaded=false,onScreen=true,failed=false,raf=0,last=0,clock=0,lastVideo=-1;
  function size(){var w=fire.clientWidth,h=fire.clientHeight;if(!w||!h)return;var k=Math.min(1,Math.sqrt(1200000/(w*h)));canvas.width=Math.max(1,Math.round(w*k));canvas.height=Math.max(1,Math.round(h*k));gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(uniform.resolution,canvas.width,canvas.height);var p=getComputedStyle(fire).backgroundPosition.split(" ");function a(v){return /%$/.test(v)?parseFloat(v)/100:.5;}gl.uniform2f(uniform.anchor,a(p[0]),a(p[1]));}
  function draw(now){
   raf=0;if(!loaded||failed||!onScreen||document.hidden||pref.matches||realPlaying||video.paused)return;
   if(video.readyState>=2&&(!last||now-last>=32)){
    try{if(lastVideo!==video.currentTime){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,videoTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);lastVideo=video.currentTime;}clock+=last?Math.min((now-last)/1000,.08):0;last=now;gl.uniform1f(uniform.time,clock);gl.drawArrays(gl.TRIANGLES,0,3);canvas.classList.add("ready");}catch(e){failed=true;canvas.classList.remove("ready");video.pause();return;}
   }
   raf=requestAnimationFrame(draw);
  }
  function sync(){if(loaded&&!failed&&onScreen&&!document.hidden&&!pref.matches&&!realPlaying){var p=video.play();if(p&&p.catch)p.catch(function(){canvas.classList.remove("ready");});if(!raf&&!video.paused){last=0;raf=requestAnimationFrame(draw);}}else{video.pause();if(raf){cancelAnimationFrame(raf);raf=0;}if(pref.matches)canvas.classList.remove("ready");}}
  if(heroLoop)["playing","waiting","stalled","pause","error","emptied"].forEach(function(e){heroLoop.addEventListener(e,sync);});
  video.addEventListener("playing",sync);video.addEventListener("error",function(){failed=true;sync();canvas.classList.remove("ready");});
  img.onload=function(){try{gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,photo);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.uniform2f(uniform.photoSize,img.naturalWidth,img.naturalHeight);size();loaded=true;sync();}catch(e){canvas.classList.remove("ready");}};
  img.src=new URL("assets/video/forno-hero-v8.webp",document.baseURI).href;
  window.addEventListener("resize",size,{passive:true});if("ResizeObserver" in window)new ResizeObserver(size).observe(fire);
  if("IntersectionObserver" in window)new IntersectionObserver(function(es){onScreen=es[0].isIntersecting;sync();},{threshold:.02}).observe(fire);
  document.addEventListener("visibilitychange",sync);if(pref.addEventListener)pref.addEventListener("change",sync);
  canvas.addEventListener("webglcontextlost",function(e){e.preventDefault();failed=true;sync();canvas.classList.remove("ready");});
 }
}catch(e){canvas.classList.remove("ready");}
/* Curated review carousel: pause on interaction, reduced motion and offscreen. */
var box=document.querySelector("[data-review-carousel]");if(!box)return;
var slides=Array.from(box.querySelectorAll("figure")),count=box.querySelector("[data-review-count]"),pause=box.querySelector("[data-review-pause]"),stage=box.querySelector("[data-review-slide]"),index=0,timer=0,manual=pref.matches,hover=false,focus=false,visible=false;
function stop(){clearInterval(timer);timer=0;}
function update(){stop();if(!manual&&!hover&&!focus&&visible&&!document.hidden&&!pref.matches)timer=setInterval(function(){show(index+1,false);},6500);}
function show(n,announce){index=(n+slides.length)%slides.length;stage.setAttribute("aria-live",announce?"polite":"off");slides.forEach(function(el,i){el.hidden=i!==index;el.classList.remove("v19-enter");});void stage.offsetWidth;slides[index].classList.add("v19-enter");count.textContent=String(index+1).padStart(2,"0")+" / "+String(slides.length).padStart(2,"0");}
function syncPause(){pause.setAttribute("aria-pressed",String(manual));pause.setAttribute("aria-label",manual?"Avvia scorrimento":"Ferma scorrimento");pause.textContent=manual?"▶":"Ⅱ";update();}
box.querySelector("[data-review-prev]").addEventListener("click",function(){show(index-1,true);update();});
box.querySelector("[data-review-next]").addEventListener("click",function(){show(index+1,true);update();});
pause.addEventListener("click",function(){manual=!manual;syncPause();});
box.addEventListener("pointerenter",function(){hover=true;update();});
box.addEventListener("pointerleave",function(){hover=false;update();});
box.addEventListener("focusin",function(){focus=true;update();});
box.addEventListener("focusout",function(e){if(!box.contains(e.relatedTarget)){focus=false;update();}});
document.addEventListener("visibilitychange",update);
if("IntersectionObserver" in window)new IntersectionObserver(function(es){visible=es[0].isIntersecting;update();},{threshold:.2}).observe(box);else visible=true;
if(pref.addEventListener)pref.addEventListener("change",function(){manual=pref.matches;syncPause();});
syncPause();
})();

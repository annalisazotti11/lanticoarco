/* Fire: animate the original photograph, not the text or the oven masonry. */
(function(){
"use strict";
var pref=window.matchMedia("(prefers-reduced-motion: reduce)");
var canvas=document.getElementById("v19Fire"),fire=document.getElementById("fire");
if(canvas&&fire&&!pref.matches)try{
  var gl=canvas.getContext("webgl",{alpha:false,antialias:false,powerPreference:"low-power"});
  if(gl){
    var vert="attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}";
    var frag=[
      "precision mediump float;",
      "uniform sampler2D photo;uniform vec2 resolution,photoSize,anchor;uniform float time;",
      "float wave(vec2 p,float t){return sin(p.x*32.+p.y*18.-t*4.2)*.55+sin(p.x*71.-p.y*27.+t*2.8)*.28+sin(p.x*19.+p.y*39.-t*1.9)*.17;}",
      "void main(){",
      "vec2 xy=vec2(gl_FragCoord.x/resolution.x,1.-gl_FragCoord.y/resolution.y);",
      "float sc=max(resolution.x/photoSize.x,resolution.y/photoSize.y);vec2 covered=resolution/(photoSize*sc);",
      "vec2 uv=xy*covered+(1.-covered)*anchor;vec3 base=texture2D(photo,uv).rgb;",
      "float lum=max(base.r,max(base.g,base.b));float flame=smoothstep(.43,.9,base.r)*smoothstep(.16,.58,base.g)*(1.-smoothstep(.82,1.,base.b));",
      "float hot=smoothstep(.57,.9,lum)*smoothstep(.16,.53,base.g);float mask=max(flame*.78,hot*.52);",
      "float w=wave(uv,time);vec2 moving=uv+vec2(w*.012,-.009*sin(uv.y*29.+uv.x*15.-time*3.7))*mask;",
      "vec3 col=texture2D(photo,clamp(moving,vec2(.001),vec2(.999))).rgb;",
      "float flicker=.94+.11*sin(time*5.1)+.055*sin(time*8.3+uv.y*14.);",
      "col*=1.+mask*(flicker-1.);col+=vec3(.045,.014,.002)*flame*(.5+.5*sin(time*3.8+uv.y*21.));",
      "gl_FragColor=vec4(col,1.);}"
    ].join("\n");
    function shader(type,source){var sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
    var pr=gl.createProgram();gl.attachShader(pr,shader(gl.VERTEX_SHADER,vert));gl.attachShader(pr,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error("fire shader link");gl.useProgram(pr);
    var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    var pos=gl.getAttribLocation(pr,"position");gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    var tx=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tx);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    var uniform={};["photo","resolution","photoSize","anchor","time"].forEach(function(n){uniform[n]=gl.getUniformLocation(pr,n);});gl.uniform1i(uniform.photo,0);
    var img=new Image(),loaded=false,onScreen=true,raf=0,last=0,clock=0;
    function size(){
      var w=fire.clientWidth,h=fire.clientHeight;if(!w||!h)return;
      var k=Math.min(1,Math.sqrt(1200000/(w*h)));
      canvas.width=Math.max(1,Math.round(w*k));canvas.height=Math.max(1,Math.round(h*k));gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(uniform.resolution,canvas.width,canvas.height);
      var p=getComputedStyle(fire).backgroundPosition.split(" ");function anchor(v){return /%$/.test(v)?parseFloat(v)/100:.5;}gl.uniform2f(uniform.anchor,anchor(p[0]),anchor(p[1]));
    }
    function draw(now){
      raf=0;if(!loaded||!onScreen||document.hidden||pref.matches)return;
      if(now-last>=32||!last){clock+=last?Math.min((now-last)/1000,.07):0;last=now;gl.uniform1f(uniform.time,clock);gl.drawArrays(gl.TRIANGLES,0,3);canvas.classList.add("ready");}
      raf=requestAnimationFrame(draw);
    }
    function sync(){if(loaded&&onScreen&&!document.hidden&&!pref.matches){if(!raf){last=0;raf=requestAnimationFrame(draw);}}else if(raf){cancelAnimationFrame(raf);raf=0;}}
    img.onload=function(){try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.uniform2f(uniform.photoSize,img.naturalWidth,img.naturalHeight);size();loaded=true;sync();}catch(e){canvas.classList.remove("ready");}};
    img.src=new URL("assets/video/forno-hero-v8.webp",document.baseURI).href;
    window.addEventListener("resize",size,{passive:true});
    if("ResizeObserver" in window)new ResizeObserver(size).observe(fire);
    if("IntersectionObserver" in window)new IntersectionObserver(function(es){onScreen=es[0].isIntersecting;sync();},{threshold:.02}).observe(fire);
    document.addEventListener("visibilitychange",sync);
    if(pref.addEventListener)pref.addEventListener("change",sync);
    canvas.addEventListener("webglcontextlost",function(e){e.preventDefault();loaded=false;sync();canvas.classList.remove("ready");});
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

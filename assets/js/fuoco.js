/* Il fuoco dell'apertura, sintetizzato dal nostro forno.
   Si è dentro il forno: volta e piano disegnati al momento sul modello del nostro,
   al centro brucia la nostra legna vera (dal video del forno, in HD), sopra salgono fiamme vere filmate.
   La luce della volta segue la brace vera, fotogramma per fotogramma. */
(function () {
  'use strict';
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 R;uniform float T;uniform vec2 F0;uniform float SC;',
    'uniform sampler2D HB;uniform sampler2D FL;uniform float HOK;uniform float FOK;',
    'float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    // il colore del vostro video (rosa-rosso) portato verso un fuoco caldo
    'vec3 grade(vec3 c){c=pow(max(c,0.),vec3(1.,1.35,1.7));return c*vec3(1.08,.86,.62);}',
    'vec3 heart(vec2 tc){return grade(texture2D(HB,vec2(tc.x,tc.y)).rgb);}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/R; float a=R.x/R.y;',
    ' vec2 q=vec2((uv.x-.5)*a,uv.y);',
    ' vec2 F=F0; float t=T;',
    // quanto è acceso il fuoco vero adesso: guida la luce della volta
    ' float Ih=HOK>.5?dot(heart(vec2(.55,.45))+heart(vec2(.5,.55))+heart(vec2(.62,.5)),vec3(.25,.55,.2))/3.:.6;',
    ' float I=.7+.55*Ih+.05*(vn(vec2(t*7.,1.))-.5);',
    ' float hz=F.y+.01;',
    ' vec3 col=vec3(0.);',
    // ---- la volta: bassa e larga come la vostra, refrattario rosso, scurita dalla fuliggine
    ' vec2 e=vec2(q.x/max(.7*a,.85),(q.y-hz)/(.75*SC+.12));',
    ' float rr=length(e);',
    ' float inside=smoothstep(1.03,.94,rr)*step(hz,q.y);',
    ' vec2 d=(q-F-vec2(0.,.08*SC))/SC;',
    ' float L=I*(.5+1.7*exp(-length(d*vec2(.8,1.1))*1.5));',
    ' float tex=fbm(q*vec2(6.,10.)/SC)*.5+fbm(q*vec2(26.,19.)/SC)*.25+fbm(q*vec2(90.,70.)/SC)*.1;',
    ' float soot=smoothstep(.5,.92,fbm(q*vec2(2.2,3.4)/SC+3.))*.5;',
    ' float curve=mix(1.,.3,smoothstep(.3,1.,rr));',
    ' vec3 brick=mix(vec3(.3,.05,.022),vec3(.88,.21,.07),tex)*(1.-soot);',
    ' col=brick*L*curve*inside;',
    // ---- il piano: pietra con cenere, in prospettiva, con il riflesso del fuoco
    ' if(q.y<hz){',
    '  float z=1./(hz-q.y+.03);',
    '  vec2 fp=vec2((q.x-F.x)*z*.9,z*.5);',
    '  float ash=fbm(fp*vec2(5.,3.))*.55+.45*fbm(fp*vec2(19.,11.));',
    '  float dx=(q.x-F.x)/SC, dy=(hz-q.y)/SC;',
    '  float Lf=I*(.15+1.1*exp(-sqrt(dx*dx*.7+dy*dy*5.)*2.));',
    '  col=vec3(.36,.12,.065)*ash*Lf;',
    '  col+=vec3(.95,.26,.06)*exp(-abs(dx)*3.2-dy*9.)*I*.55;',
    '  col*=smoothstep(0.,.3*SC,q.y);',
    '  col=mix(col,brick*L*curve*(1.-.45*smoothstep(0.,.12,hz-q.y)),pow(smoothstep(.16,0.,hz-q.y),1.4));',
    ' }',
    ' col+=vec3(.55,.09,.03)*exp(-abs(q.y-hz)*28.)*I*.1*exp(-abs(q.x-F.x)/SC*1.5);',
    // ---- il cuore: la vostra legna e la vostra brace, dal video
    ' if(HOK>.5){',
    '  float hw=.85*SC;',                                                  // larghezza del riquadro della brace
    '  vec2 tc=vec2(.55+(q.x-F.x)/hw,.74-(q.y-F.y)/(hw*580./720.));',
    '  if(tc.x>0.&&tc.x<1.&&tc.y>0.&&tc.y<1.){',
    '   vec2 m=(tc-vec2(.54,.56))/vec2(.36,.3);',
    '   float mk=smoothstep(1.,.45,length(m))*smoothstep(.97,.85,tc.x);',
    '   vec3 h=heart(tc);',
    '   float hl=dot(h,vec3(.3,.5,.2));',
    '   mk*=smoothstep(.1,.35,hl)*.6+.4;',                                // le zone spente sfumano nel buio, la brace resta
    '   col=mix(col,max(col,h*1.2),mk);',
    '  }',
    ' }',
    // ---- le fiamme: fuoco vero filmato, che sale libero dalla vostra brace
    ' if(FOK>.5){',
    '  float fh=1.05*SC, fw=fh*560./480.;',
    '  vec2 ft=vec2((q.x-F.x)/fw+.5,(q.y-F.y)/fh+.1);',
    '  if(ft.x>0.&&ft.x<1.&&ft.y>0.&&ft.y<1.){',
    '   vec3 fl=texture2D(FL,vec2(ft.x,1.-ft.y)).rgb;',
    '   float k=smoothstep(.58,.88,max(fl.r,max(fl.g,fl.b)));',
    '   float fm=smoothstep(.12,.36,ft.x)*smoothstep(.88,.64,ft.x)*smoothstep(.13,.24,ft.y)*smoothstep(1.,.62,ft.y);',
    '   vec3 c=pow(fl,vec3(1.,1.2,1.55))*vec3(1.15,1.,.85)*k*fm*(.85+.4*Ih);',
    '   col+=c*(1.-col*.5);',
    '  }',
    ' }',
    // ---- bagliore attorno al fuoco
    ' col+=vec3(1.,.32,.07)*exp(-length((q-F-vec2(0.,.22*SC))/SC*vec2(.9,.75))*3.)*I*.22;',
    ' col*=1.-.32*pow(length(uv-vec2(.5,.45))*1.12,2.2);',
    ' col=col/(1.+col*.18);',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function FireS(canvas, heartV, flameV, place) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    this.ok = !!gl; if (!gl) return;
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    function mk() { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
    var tH = mk(), tF = mk(), hok = 0, fok = 0;
    var U = {}; ['R', 'T', 'F0', 'SC', 'HB', 'FL', 'HOK', 'FOK'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    gl.uniform1i(U.HB, 0); gl.uniform1i(U.FL, 1);
    var running = false, raf = null, t0 = performance.now();
    // risoluzione di calcolo: nitida ma leggera (al massimo ~1,4 milioni di punti)
    function size() { var cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1, d = Math.min(window.devicePixelRatio || 1, 2);
      var s = Math.min(.75 * d, Math.sqrt(1.4e6 / (cw * ch))); canvas.width = Math.max(1, Math.round(cw * s)); canvas.height = Math.max(1, Math.round(ch * s)); gl.viewport(0, 0, canvas.width, canvas.height); }
    function up(v, unit, tex) { if (v.readyState < 2) return 0; gl.activeTexture(unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); return 1; }
    function frame(now) {
      raf = null;
      if (!running) return;
      hok = up(heartV, gl.TEXTURE0, tH) || hok; fok = up(flameV, gl.TEXTURE1, tF) || fok;
      var a = canvas.width / canvas.height, P = place(a);
      gl.uniform2f(U.R, canvas.width, canvas.height); gl.uniform1f(U.T, (now - t0) / 1000);
      gl.uniform2f(U.F0, P.x * a, P.y); gl.uniform1f(U.SC, P.s);
      gl.uniform1f(U.HOK, hok); gl.uniform1f(U.FOK, fok);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    size(); window.addEventListener('resize', size);
    this.play = function () { if (!running) { running = true; [heartV, flameV].forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }); raf = requestAnimationFrame(frame); } };
    this.pause = function () { running = false; if (raf !== null) { cancelAnimationFrame(raf); raf = null; } heartV.pause(); flameV.pause(); };
  }
  window.FireS = FireS;
})();

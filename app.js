(function(){
"use strict";
var $ = function(id){ return document.getElementById(id); };
var L = Logic;

// ---------- Ajustes guardados en el móvil ----------
var cfg = {nombre:"", siempre:false, voz:"", tono:1.4, vel:0.9, ia:true};
try { var g = JSON.parse(localStorage.getItem("nuca_cfg")||"{}"); for (var k in g) cfg[k]=g[k]; } catch(e){}
function guardar(){ try{ localStorage.setItem("nuca_cfg", JSON.stringify(cfg)); }catch(e){} }

var modo = null;          // null | 'nombre' | 'mates' | 'dibujo'
var mates = {level: cfg.nivel||1, racha:0, fallos:0, q:null, intentos:0};
var historial = [];       // para la IA
var colores = "";         // colores del último dibujo

// ---------- Interfaz ----------
function decir(txt){ $("bocadillo").textContent = txt; }
function estado(txt){ $("estado").textContent = txt; }
function extra(html){ $("extra").innerHTML = html||""; }
function saludo(){ $("hola").textContent = cfg.nombre ? "¡Hola, "+cfg.nombre+"!" : "¡Hola!"; }
saludo();
$("chkSiempre").checked = !!cfg.siempre;

// ---------- Voz (hablar) ----------
var synth = window.speechSynthesis;
var voces = [];
var hablando = false;
var cola = [], colaFin = null, cuento = null, turno = 0;

function cargarVoces(){
  if (!synth) return;
  voces = synth.getVoices().filter(function(v){ return /^es/i.test(v.lang); });
  // es-ES primero, y dentro de ellas voces femeninas conocidas
  var fem = /(monica|mónica|helena|laura|elvira|lucia|lucía|paulina|marisol|conchita|female|mujer|google español$)/i;
  voces.sort(function(a,b){
    function p(v){ return (/es[-_]ES/i.test(v.lang)?0:10) + (fem.test(v.name)?0:3) + (v.localService?0:1); }
    return p(a)-p(b);
  });
  var sel = $("selVoz"); sel.innerHTML = "";
  voces.forEach(function(v){ var o=document.createElement("option"); o.value=v.name; o.textContent=v.name+" ("+v.lang+")"; sel.appendChild(o); });
  if (cfg.voz) sel.value = cfg.voz;
}
if (synth){ cargarVoces(); if (typeof synth.onvoiceschanged!=="undefined") synth.onvoiceschanged = cargarVoces; }
function vozElegida(){
  for (var i=0;i<voces.length;i++) if (voces[i].name===cfg.voz) return voces[i];
  return voces[0] || null;
}
function limpiarParaVoz(t){
  return (t||"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu,"").replace(/[*_#`>]/g,"").trim();
}
function trocear(t){
  var partes = limpiarParaVoz(t).match(/[^.!?¡¿:]+[.!?:]*|[¡¿][^.!?]+[.!?]*/g) || [t];
  var out=[];
  partes.forEach(function(p){ p=p.trim(); if (!p) return; if (out.length && (out[out.length-1].length + p.length) < 140) out[out.length-1] += " " + p; else out.push(p); });
  return out;
}
// Habla un texto (troceado en frases para que Android no se corte). fin() al acabar.
function hablar(texto, fin, mostrar){
  if (mostrar!==false) decir(texto);
  pararEscucha();
  if (!synth){ if (fin) setTimeout(fin, 500); return; }
  turno++; hablando=false; synth.cancel();
  cola = trocear(texto); colaFin = fin || null;
  var mio = turno;
  setTimeout(function(){ if (mio===turno) siguienteFrase(); }, 60);
}
function siguienteFrase(){
  if (!cola.length){ hablando=false; $("nuca").className="nuca"; var f=colaFin; colaFin=null; if (f) f(); else escucharSiToca(); return; }
  var u = new SpeechSynthesisUtterance(cola.shift()), mio = turno;
  u.lang = "es-ES"; var v=vozElegida(); if (v){ u.voice=v; u.lang=v.lang; }
  u.pitch = cfg.tono; u.rate = cfg.vel;
  u.onend = function(){ if (hablando && mio===turno) siguienteFrase(); };
  u.onerror = function(){ if (hablando && mio===turno) siguienteFrase(); };
  hablando = true; $("nuca").className="nuca habla";
  synth.speak(u);
}
function callar(){ turno++; hablando=false; cola=[]; colaFin=null; if (synth) synth.cancel(); $("nuca").className="nuca"; }

// ---------- Escuchar ----------
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
var rec = null, escuchando = false, videoAbierto = false;
function pararEscucha(){ if (rec && escuchando){ try{ rec.abort(); }catch(e){} } escuchando=false; $("btnHablar").className="hablar"; }
function escuchar(){
  if (!SR){ estado("Este navegador no puede escuchar. Usa Chrome. Puedes escribir en Ajustes ⚙️"); return; }
  if (hablando) callar();
  if (escuchando) return;
  rec = new SR(); rec.lang="es-ES"; rec.interimResults=false; rec.maxAlternatives=1; rec.continuous=false;
  rec.onstart = function(){ escuchando=true; $("btnHablar").className="hablar activo"; $("nuca").className="nuca escucha"; estado("Te escucho…"); };
  rec.onresult = function(e){ var t = e.results[0][0].transcript; estado("Has dicho: «"+t+"»"); entender(t); };
  rec.onerror = function(e){
    if (e.error==="not-allowed"||e.error==="service-not-allowed") { estado("Necesito permiso para usar el micrófono."); cfg.siempre=false; $("chkSiempre").checked=false; }
    else if (e.error==="network") estado("Para escuchar necesito internet.");
    else if (e.error==="no-speech") estado("No te he oído. Toca el botón y habla.");
  };
  rec.onend = function(){ escuchando=false; $("btnHablar").className="hablar"; if (!hablando) $("nuca").className="nuca"; if (!hablando && !ocupado) escucharSiToca(400); };
  try { rec.start(); } catch(e){}
}
var ocupado = false;
function escucharSiToca(ms){
  if (cfg.siempre && !videoAbierto && !cuento && !camAbierta && !hablando && !ocupado) setTimeout(function(){ if (cfg.siempre && !hablando && !escuchando && !ocupado && !videoAbierto && !cuento && !camAbierta) escuchar(); }, ms||300);
}

// ---------- Cerebro ----------
function entender(texto){
  var it = L.intent(texto);
  if (it.tipo==="nada") return;
  if (it.tipo==="parar"){ pararCuento(); cerrarVideo(); modo=null; hablar("Vale, paro."); return; }
  if (it.tipo==="pausa"){ pausarCuento(); return; }
  if (it.tipo==="seguir" && cuento){ seguirCuento(); return; }
  if (modo==="nombre"){ return ponerNombre(texto); }
  if (modo==="mates" && it.tipo!=="salir" && it.tipo!=="cuento" && it.tipo!=="musica" && it.tipo!=="dibujo"){ return comprobar(texto); }
  if (modo==="dibujo" && it.tipo==="charla"){ return comentarDibujo(texto); }
  if (it.tipo==="salir"){ modo=null; extra(""); hablar("¡Vale! Lo has hecho muy bien. ¿Qué quieres hacer ahora?"); return; }
  if (it.tipo==="nombre"){ cfg.nombre=it.nombre; guardar(); saludo(); $("inNombre").value=cfg.nombre; hablar("¡Qué nombre tan bonito, "+cfg.nombre+"! Ya me lo sé."); return; }
  if (it.tipo==="deberes") return empezarMates();
  if (it.tipo==="cuenta"){ var r=L.localMath(texto); return hablar(r); }
  if (it.tipo==="cuento") return pedirCuento(texto);
  if (it.tipo==="musica") return ponerMusica(it.q, texto);
  if (it.tipo==="dibujo") return abrirCamara();
  charla(texto);
}

function ponerNombre(texto){
  var t = L.norm(texto).replace(/^(me llamo|mi nombre es|soy|yo soy|pues)\s+/,"").split(" ")[0]||"";
  if (!t){ hablar("¿Cómo te llamas?"); return; }
  cfg.nombre = t.charAt(0).toUpperCase()+t.slice(1); guardar(); saludo(); $("inNombre").value=cfg.nombre; modo=null;
  hablar("¡Encantada, "+cfg.nombre+"! Puedo ayudarte con los deberes, contarte cuentos, poner música o mirar tus dibujos. ¿Qué quieres hacer?");
}

// ---------- Deberes ----------
function empezarMates(){
  modo="mates"; mates.intentos=0;
  hablar("¡Vamos a hacer cuentas! Si quieres parar, di «ya no quiero». Ahí va la primera.", nuevaPregunta);
}
function teclado(){
  var h='<div class="nums">'; for (var i=0;i<=20;i++) h+='<button data-n="'+i+'">'+i+'</button>'; return h+'</div>';
}
function nuevaPregunta(){
  if (modo!=="mates") return;
  mates.q = L.makeQuestion(mates.level); mates.intentos=0;
  var dib = "";
  if (mates.q.tipo==="contar") dib = L.apples(mates.q.a);
  else if (mates.q.tipo==="suma" && mates.q.res<=10) dib = L.apples(mates.q.a)+" ➕ "+L.apples(mates.q.b);
  else if (mates.q.tipo==="resta" && mates.q.a<=10) dib = L.apples(mates.q.a);
  extra('<div>'+dib+'</div>'+teclado());
  hablar(mates.q.texto);
}
function comprobar(texto){
  var n = L.parseNumber(texto);
  if (n===null){ hablar("Dime el número, por ejemplo: «cinco». "+mates.q.texto); return; }
  var ok = n===mates.q.res;
  var cambio = L.adapt(mates, ok); cfg.nivel = mates.level; guardar();
  if (ok){
    var e = L.ELOGIOS[Math.floor(Math.random()*L.ELOGIOS.length)];
    if (cambio==="sube") e += " ¡Ahora un poquito más difícil!";
    extra('<div>⭐🎉⭐</div>');
    hablar(e, function(){ setTimeout(nuevaPregunta, 400); });
  } else {
    mates.intentos++;
    if (mates.intentos===1){
      hablar("Casi, casi. Has dicho "+n+". Piénsalo otra vez con calma. "+mates.q.texto);
    } else {
      var ex = L.explain(mates.q);
      extra('<div>'+ex.dibujo+'</div>');
      hablar("No pasa nada, ¡equivocarse es aprender! "+ex.texto+(cambio==="baja"?" Vamos a practicar con unas más fáciles.":""), function(){ setTimeout(nuevaPregunta, 1200); });
    }
  }
}
$("extra").addEventListener("click", function(e){
  var n = e.target.getAttribute && e.target.getAttribute("data-n");
  if (n!==null && n!==undefined && modo==="mates"){ callar(); comprobar(String(n)); }
  var c = e.target.getAttribute && e.target.getAttribute("data-cuento");
  if (c){ for (var i=0;i<CUENTOS.length;i++) if (CUENTOS[i].id===c) contarCuento(CUENTOS[i]); }
});

// ---------- Cuentos ----------
function listaCuentos(){
  var h='<div class="lista">'; CUENTOS.forEach(function(c){ h+='<button data-cuento="'+c.id+'">📖 '+c.titulo+'</button>'; }); return h+'</div>';
}
function pedirCuento(texto){
  modo=null;
  var c = L.findStory(texto, CUENTOS);
  if (c) return contarCuento(c);
  var t = L.norm(texto).replace(/.*(cuento|historia)( de| del| sobre)?\s*/,"").trim();
  if (t && t.length>2 && cfg.ia && navigator.onLine){
    return preguntarIA("Cuéntame el cuento clásico de "+t+" en su versión tradicional verdadera, en unas 12 frases sencillas para una niña de 6 años, terminando con 'y colorín colorado, este cuento se ha acabado'.", function(r){
      if (r){ cuento={frases:trocear(r), i:0, pausado:false, titulo:t}; $("filaCuento").style.display=""; decir(r); leerCuento(); }
      else { extra(listaCuentos()); hablar("Ese cuento no me lo sé. Elige uno de estos."); }
    }, 900);
  }
  extra(listaCuentos());
  hablar("Me sé estos cuentos: "+CUENTOS.map(function(c){return c.titulo;}).join(", ")+". ¿Cuál quieres?");
}
function contarCuento(c){
  callar(); extra("");
  cuento = {frases: trocear(c.titulo+". "+c.texto), i:0, pausado:false, titulo:c.titulo};
  $("filaCuento").style.display=""; $("btnPausa").textContent="⏸️ Pausa";
  decir("📖 "+c.titulo);
  leerCuento();
}
function leerCuento(){
  if (!cuento || cuento.pausado) return;
  if (cuento.i >= cuento.frases.length){ cuento=null; $("filaCuento").style.display="none"; hablar("¿Te ha gustado? ¿Quieres otro cuento?"); return; }
  var f = cuento.frases[cuento.i];
  $("bocadillo").textContent = f;
  hablar(f, function(){ if (cuento && !cuento.pausado){ cuento.i++; leerCuento(); } }, false);
}
function pausarCuento(){ if (!cuento) return; cuento.pausado=true; callar(); $("btnPausa").textContent="▶️ Seguir"; estado("Cuento en pausa"); }
function seguirCuento(){ if (!cuento) return; cuento.pausado=false; $("btnPausa").textContent="⏸️ Pausa"; leerCuento(); }
function pararCuento(){ if (!cuento) return; cuento=null; callar(); $("filaCuento").style.display="none"; }
$("btnPausa").onclick = function(){ if (cuento && cuento.pausado) seguirCuento(); else pausarCuento(); };
$("btnParar").onclick = function(){ pararCuento(); decir("Cuento parado."); };

// ---------- Música ----------
function embeber(id){
  videoAbierto = true; pararEscucha();
  $("ytbox").innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0&modestbranding=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  $("video").className="";
}
function cerrarVideo(){ if (!videoAbierto) return; videoAbierto=false; $("ytbox").innerHTML=""; $("video").className="oculto"; escucharSiToca(); }
$("btnCerrarVideo").onclick = function(){ cerrarVideo(); };
function botonYouTube(q){
  return '<div class="lista"><button onclick="window.open(\'https://www.youtube.com/results?search_query='+encodeURIComponent(q+" canción infantil")+'\',\'_blank\')">▶️ Buscar «'+q.replace(/[<>"']/g,"")+'» en YouTube</button></div>';
}
function ponerMusica(q, texto){
  modo=null; pararCuento();
  var s = L.findSong(texto);
  if (s){ hablar("¡Vamos a cantar «"+s.t+"»!", function(){ embeber(s.id); }); return; }
  if (!q || q.length<2){
    var h='<div class="lista">'; L.CANCIONES.forEach(function(c){ h+='<button data-song="'+c.id+'">🎵 '+c.t+'</button>'; }); h+='</div>';
    extra(h); hablar("¿Qué canción quieres? Puedes decir, por ejemplo, «pon la vaca Lola», o tocar una."); return;
  }
  if (L.unsafe(q)){ hablar("Esa canción no es para niños. ¿Ponemos «La vaca Lola»?"); return; }
  ocupado = true; estado("Buscando la canción…");
  var ctrl = window.AbortController ? new AbortController() : null;
  var tm = setTimeout(function(){ if (ctrl) ctrl.abort(); }, 8000);
  fetch("https://api.piped.private.coffee/search?filter=videos&q="+encodeURIComponent(q+" canción infantil para niños"), ctrl?{signal:ctrl.signal}:{})
    .then(function(r){ return r.json(); })
    .then(function(d){
      clearTimeout(tm); ocupado=false;
      var it = (d.items||[]).filter(function(x){ return x.url && x.duration>0 && x.duration<1500 && !L.unsafe(x.title||""); })[0];
      if (!it) throw new Error("nada");
      var id = it.url.split("v=")[1];
      hablar("¡Aquí tienes «"+q+"»!", function(){ embeber(id); });
    })
    .catch(function(){ clearTimeout(tm); ocupado=false; extra(botonYouTube(q)); hablar("No la encuentro aquí dentro. Toca el botón para buscarla en YouTube."); });
}
$("extra").addEventListener("click", function(e){
  var id = e.target.getAttribute && e.target.getAttribute("data-song");
  if (id){ extra(""); embeber(id); }
});

// ---------- Cámara: mirar el dibujo ----------
var camAbierta=false, stream=null, mirarAtras=true;
function abrirCamara(){
  modo=null; pararCuento(); cerrarVideo(); callar(); pararEscucha();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ $("foto").click(); return; }
  camAbierta = true; $("camara").className="panel camara";
  arrancarCamara();
  hablar("¡A ver, a ver! Enséñame tu dibujo y toca el botón grande de la foto.", function(){}, true);
}
function arrancarCamara(){
  if (stream){ stream.getTracks().forEach(function(t){ t.stop(); }); stream=null; }
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal: mirarAtras?"environment":"user"}, width:{ideal:640}, height:{ideal:480}}, audio:false})
    .then(function(s){ stream=s; var v=$("camVideo"); v.srcObject=s; var p=v.play(); if (p&&p.catch) p.catch(function(){}); })
    .catch(function(err){
      cerrarCamara();
      estado("No puedo abrir la cámara aquí ("+(err&&err.name||"error")+"). Abro la cámara del móvil.");
      $("foto").click();
    });
}
function cerrarCamara(){
  camAbierta=false; $("camara").className="panel camara oculto";
  if (stream){ stream.getTracks().forEach(function(t){ t.stop(); }); stream=null; }
}
$("btnGirar").onclick = function(){ mirarAtras=!mirarAtras; arrancarCamara(); };
$("btnCerrarCam").onclick = function(){ cerrarCamara(); escucharSiToca(); };
$("btnFoto").onclick = function(){
  var v=$("camVideo"); if (!v.videoWidth){ estado("La cámara aún se está encendiendo…"); return; }
  var c=$("camCanvas"), w=320, h=Math.round(v.videoHeight*320/v.videoWidth);
  c.width=w; c.height=h; c.getContext("2d").drawImage(v,0,0,w,h);
  cerrarCamara(); analizarFoto(c);
};
$("foto").onchange = function(e){
  var f=e.target.files && e.target.files[0]; if (!f) return;
  var img=new Image();
  img.onload=function(){ var c=$("camCanvas"), w=320, h=Math.round(img.height*320/img.width); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h); URL.revokeObjectURL(img.src); analizarFoto(c); };
  img.src=URL.createObjectURL(f); e.target.value="";
};
// Mira qué colores hay en el dibujo (sin internet).
function coloresDe(c){
  var d=c.getContext("2d").getImageData(0,0,c.width,c.height).data, cuenta={}, total=0;
  var nombres=[[0,"rojo"],[20,"naranja"],[45,"amarillo"],[70,"verde"],[160,"verde"],[175,"azul clarito"],[200,"azul"],[250,"morado"],[290,"rosa"],[335,"rojo"]];
  for (var i=0;i<d.length;i+=16){
    var r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, s=mx===mn?0:(mx-mn)/(1-Math.abs(2*l-1));
    var n;
    if (s<0.28 || mx<0.18){ if (l<0.22) n="negro"; else continue; }
    else {
      var hh; if (mx===r) hh=60*(((g-b)/(mx-mn))%6); else if (mx===g) hh=60*((b-r)/(mx-mn)+2); else hh=60*((r-g)/(mx-mn)+4); if (hh<0) hh+=360;
      n="rojo"; for (var k=0;k<nombres.length;k++) if (hh>=nombres[k][0]) n=nombres[k][1];
      if (n==="naranja" && l<0.35) n="marrón";
    }
    cuenta[n]=(cuenta[n]||0)+1; total++;
  }
  var lista=Object.keys(cuenta).filter(function(k){ return cuenta[k]>total*0.06; }).sort(function(a,b){ return cuenta[b]-cuenta[a]; });
  return lista.slice(0,3);
}
function analizarFoto(c){
  var url=c.toDataURL("image/jpeg",0.7);
  extra('<img id="fotoHecha" src="'+url+'" alt="Tu dibujo">');
  var cols=[]; try{ cols=coloresDe(c); }catch(e){}
  colores = cols.join(", ");
  var frase = "¡Oooh, qué dibujo tan bonito"+(cfg.nombre?", "+cfg.nombre:"")+"! ";
  if (cols.length>=2) frase += "Me encantan los colores que has usado: "+cols.slice(0,-1).join(", ")+" y "+cols[cols.length-1]+". ";
  else if (cols.length===1) frase += "¡Cuánto "+cols[0]+"! ";
  else frase += "Has trabajado mucho. ";
  frase += "Cuéntame, ¿qué has dibujado?";
  modo="dibujo";
  hablar(frase);
}
function comentarDibujo(texto){
  modo=null;
  if (L.unsafe(texto)){ hablar("¡Qué imaginación! ¿Me haces otro dibujo de algo bonito?"); return; }
  if (cfg.ia && navigator.onLine){
    preguntarIA("He hecho un dibujo con estos colores: "+(colores||"varios")+". He dibujado: "+texto+". Dime algo bonito y concreto sobre mi dibujo y hazme una pregunta sobre él.", function(r){
      hablar(r || ("¡Qué bonito! Me encanta "+texto+". ¿Me haces otro dibujo?"));
    });
  } else hablar("¡Qué bonito! Me encanta. Eres una artista. ¿Me haces otro dibujo?");
}

// ---------- Charla con IA (gratis, sin clave) ----------
var IA_URL = "https://text.pollinations.ai/openai";
function preguntarIA(texto, cb, maxLen, reintento){
  ocupado = true; estado("Nuca está pensando…"); $("nuca").className="nuca escucha";
  var msgs=[{role:"system", content:L.SYSTEM}].concat(historial.slice(-6)).concat([{role:"user", content:texto}]);
  var ctrl = window.AbortController ? new AbortController() : null;
  var tm = setTimeout(function(){ if (ctrl) ctrl.abort(); }, 25000);
  fetch(IA_URL, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({model:"openai", messages:msgs, referrer:"nuca"}), signal: ctrl?ctrl.signal:undefined})
    .then(function(r){ if (!r.ok) throw new Error("http "+r.status); return r.json(); })
    .then(function(d){
      clearTimeout(tm); ocupado=false; estado("");
      var r = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
      r = limpiarParaVoz(r).replace(/\n+/g," ").trim();
      if (!r || L.unsafe(r)) return cb(null);
      if (r.length > (maxLen||420)) { var corte=r.lastIndexOf(".", maxLen||420); r = r.slice(0, corte>50?corte+1:(maxLen||420)); }
      historial.push({role:"user",content:texto},{role:"assistant",content:r});
      cb(r);
    })
    .catch(function(){ clearTimeout(tm); ocupado=false; estado("");
      if (!reintento && navigator.onLine) setTimeout(function(){ preguntarIA(texto, cb, maxLen, true); }, 3000); else cb(null); });
}
function charla(texto){
  modo=null;
  if (L.unsafe(texto)) return hablar("Eso es mejor que se lo preguntes a papá, a mamá o a un mayor de confianza. ¿Quieres que te cuente un cuento?");
  if (L.asksPersonal(texto)) return hablar("Eso es un secreto que no hay que contar a nadie por aquí. ¡Hablemos de otra cosa!");
  if (cfg.ia && navigator.onLine){
    preguntarIA(texto, function(r){ hablar(r || L.fallback(texto, cfg.nombre)); });
  } else hablar(L.fallback(texto, cfg.nombre));
}

// ---------- Botones ----------
var arrancado = false;
function arrancar(){
  if (arrancado) return true; arrancado = true;
  if (!cfg.nombre){ modo="nombre"; hablar("¡Hola! Me llamo Nuca y voy a ser tu amiga. ¿Y tú, cómo te llamas?", function(){ escuchar(); }); return false; }
  return true;
}
$("btnHablar").onclick = function(){
  if (!arrancar()) return;
  if (cuento){ pausarCuento(); }
  if (escuchando){ pararEscucha(); return; }
  escuchar();
};
var ops = document.querySelectorAll(".op[data-cmd]");
for (var i=0;i<ops.length;i++) ops[i].onclick = function(){
  arrancado = true; callar();
  var c=this.getAttribute("data-cmd");
  if (c==="deberes") empezarMates();
  else if (c==="cuentos"){ pararCuento(); modo=null; extra(listaCuentos()); hablar("¿Qué cuento quieres? Toca uno o dímelo."); }
  else if (c==="musica") ponerMusica("", "");
  else if (c==="dibujo") abrirCamara();
};
$("chkSiempre").onchange = function(){ cfg.siempre=this.checked; guardar(); if (cfg.siempre){ arrancado=true; escuchar(); } else pararEscucha(); };

// Ajustes
function abrirAjustes(){
  $("inNombre").value=cfg.nombre; $("inTono").value=cfg.tono; $("inVel").value=cfg.vel; $("chkIA").checked=cfg.ia;
  $("vTono").textContent=cfg.tono; $("vVel").textContent=cfg.vel; cargarVoces();
  $("ajustes").className="panel";
}
$("btnAjustes").onclick = abrirAjustes;
$("inTono").oninput = function(){ cfg.tono=parseFloat(this.value); $("vTono").textContent=cfg.tono; guardar(); };
$("inVel").oninput = function(){ cfg.vel=parseFloat(this.value); $("vVel").textContent=cfg.vel; guardar(); };
$("selVoz").onchange = function(){ cfg.voz=this.value; guardar(); };
$("chkIA").onchange = function(){ cfg.ia=this.checked; guardar(); };
$("inNombre").onchange = function(){ cfg.nombre=this.value.trim(); guardar(); saludo(); if (modo==="nombre") modo=null; };
$("btnProbarVoz").onclick = function(){ hablar("¡Hola! Soy Nuca. ¿Jugamos?"); };
$("btnEnviar").onclick = function(){ var t=$("inTexto").value.trim(); if (!t) return; $("inTexto").value=""; $("ajustes").className="panel oculto"; arrancado=true; estado("Has escrito: «"+t+"»"); entender(t); };
$("btnCerrarAjustes").onclick = function(){ $("ajustes").className="panel oculto"; };

if (!cfg.nombre) decir("¡Hola! Soy Nuca. Toca el botón rosa para empezar.");
else decir("¡Hola, "+cfg.nombre+"! Toca el botón rosa y dime qué quieres hacer.");

// Exponer para pruebas
window.NucaApp = {entender:entender, estadoMates:function(){return mates;}, cuento:function(){return cuento;}, analizarFoto:analizarFoto, coloresDe:coloresDe, cfg:cfg};

if ("serviceWorker" in navigator) window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
})();

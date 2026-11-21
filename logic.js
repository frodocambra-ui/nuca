// Lógica pura de Nuca (sin DOM), para poder probarla.
var Logic = (function(){
  function norm(s){
    return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[¿?¡!.,;:"()]/g," ").replace(/\s+/g," ").trim();
  }
  var UNIDADES = {cero:0,uno:1,una:1,un:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,
    once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,
    veintiuno:21,veintiuna:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,
    veintiocho:28,veintinueve:29,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100};
  // Devuelve el primer número que aparece (cifra o palabra) o null.
  function parseNumber(s){
    var t = norm(s);
    var m = t.match(/-?\d+/);
    if (m) return parseInt(m[0],10);
    var w = t.split(" ");
    for (var i=0;i<w.length;i++){
      if (w[i] in UNIDADES){
        var v = UNIDADES[w[i]];
        if (v>=30 && v<100 && w[i+1]==="y" && UNIDADES[w[i+2]]!==undefined && UNIDADES[w[i+2]]<10){ v += UNIDADES[w[i+2]]; }
        if ((w[i]==="un"||w[i]==="una") && i+1<w.length && !(w[i+1] in UNIDADES)) { // "un poco"... sigue buscando
          var rest = parseNumber(w.slice(i+1).join(" "));
          if (rest!==null) return rest;
        }
        return v;
      }
    }
    return null;
  }
  function rnd(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }

  // Niveles: 1 sumas hasta 5, 2 contar/siguiente, 3 sumas hasta 10, 4 restas hasta 10, 5 sumas hasta 20, 6 restas hasta 20
  var NIVELES = ["sumas hasta 5","contar","sumas hasta 10","restas hasta 10","sumas hasta 20","restas hasta 20"];
  function makeQuestion(level, rand){
    rand = rand || rnd;
    var a,b,q={};
    switch(level){
      case 1: a=rand(1,4); b=rand(1,5-a); q={tipo:"suma",a:a,b:b,res:a+b,texto:"¿Cuánto es "+a+" más "+b+"?"}; break;
      case 2:
        if (rand(0,1)===0){ a=rand(1,15); q={tipo:"siguiente",a:a,res:a+1,texto:"¿Qué número va después del "+a+"?"}; }
        else { a=rand(2,9); q={tipo:"contar",a:a,res:a,texto:"¿Cuántas manzanas hay? Cuéntalas con el dedito."}; }
        break;
      case 3: a=rand(1,9); b=rand(1,10-a); q={tipo:"suma",a:a,b:b,res:a+b,texto:"¿Cuánto es "+a+" más "+b+"?"}; break;
      case 4: a=rand(2,10); b=rand(1,a); q={tipo:"resta",a:a,b:b,res:a-b,texto:"¿Cuánto es "+a+" menos "+b+"?"}; break;
      case 5: a=rand(5,15); b=rand(1,20-a); q={tipo:"suma",a:a,b:b,res:a+b,texto:"¿Cuánto es "+a+" más "+b+"?"}; break;
      default: a=rand(10,20); b=rand(1,a-1); q={tipo:"resta",a:a,b:b,res:a-b,texto:"¿Cuánto es "+a+" menos "+b+"?"};
    }
    q.level = level;
    return q;
  }
  function apples(n){ var s=""; for(var i=0;i<n;i++) s+="🍎"; return s; }
  // Explicación con objetos cuando se equivoca.
  function explain(q){
    if (q.tipo==="suma"){
      var cuenta=[]; for (var i=q.a+1;i<=q.res;i++) cuenta.push(i);
      return {texto:"Mira: tienes "+q.a+(q.a===1?" manzana":" manzanas")+" y te doy "+q.b+" más. Empezamos en "+q.a+" y seguimos contando: "+cuenta.join(", ")+". ¡Son "+q.res+"!",
              dibujo:apples(q.a)+" ➕ "+apples(q.b)};
    }
    if (q.tipo==="resta"){
      return {texto:"Mira: tienes "+q.a+" manzanas y te comes "+q.b+". Quitamos "+q.b+" y contamos las que quedan. ¡Quedan "+q.res+"!",
              dibujo:apples(q.res)+"<s>"+apples(q.b)+"</s>"};
    }
    if (q.tipo==="siguiente") return {texto:"Contamos juntas: "+(q.a-1>0?(q.a-1)+", ":"")+q.a+" y... ¡"+q.res+"!", dibujo:""};
    return {texto:"Vamos a contarlas despacito, una a una. ¡Hay "+q.res+"!", dibujo:apples(q.res)};
  }
  // Dificultad adaptativa
  function adapt(state, correct){
    if (correct){ state.racha=(state.racha||0)+1; state.fallos=0; if (state.racha>=3 && state.level<6){ state.level++; state.racha=0; return "sube"; } }
    else { state.fallos=(state.fallos||0)+1; state.racha=0; if (state.fallos>=2 && state.level>1){ state.level--; state.fallos=0; return "baja"; } }
    return null;
  }
  var ELOGIOS = ["¡Muy bien!","¡Genial, lo has hecho fenomenal!","¡Bravo! ¡Qué lista eres!","¡Correcto! ¡Eres una campeona!","¡Sí señora, perfecto!"];

  // Cuentas que pregunta la niña: "cuánto es 3 más 4", "8 menos 2"
  function localMath(s){
    var t = norm(s).replace(/\+/g," mas ").replace(/ x /g," por ");
    var m = t.match(/([a-z0-9]+)\s+(mas|menos|por|entre|dividido entre)\s+([a-z0-9]+)/);
    if (!m) return null;
    var a=parseNumber(m[1]), b=parseNumber(m[3]);
    if (a===null||b===null) return null;
    var op=m[2], r, w;
    if (op==="mas"){ r=a+b; w="más"; } else if (op==="menos"){ r=a-b; w="menos"; }
    else if (op==="por"){ r=a*b; w="por"; } else { if(b===0) return "No se puede repartir entre cero."; r=a/b; w="entre"; if(r%1) r=Math.round(r*10)/10; }
    var txt = a+" "+w+" "+b+" son "+r+".";
    if (op==="mas" && r<=10) txt += " Si tienes "+a+" manzanas y te dan "+b+", tienes "+r+".";
    if (op==="menos" && a<=10 && r>=0) txt += " Si tienes "+a+" manzanas y te comes "+b+", te quedan "+r+".";
    return txt;
  }

  function findStory(s, list){
    var t = norm(s);
    for (var i=0;i<list.length;i++){
      var c=list[i];
      for (var k=0;k<c.claves.length;k++) if (t.indexOf(norm(c.claves[k]))>=0) return c;
      if (t.indexOf(norm(c.titulo))>=0) return c;
    }
    return null;
  }

  // Canciones infantiles conocidas (vídeos de YouTube comprobados).
  var CANCIONES = [
    {t:"El patio de mi casa", c:["patio de mi casa"], id:"R3fwzYUn27Y"},
    {t:"Susanita tiene un ratón", c:["susanita","raton"], id:"8dg-9SsoxtM"},
    {t:"Los pollitos dicen", c:["pollitos","pio pio"], id:"YlFNSop0Nl0"},
    {t:"Soy una taza", c:["taza","cantajuego","cantajuegos"], id:"fTzTFQbdYEQ"},
    {t:"Estrellita, ¿dónde estás?", c:["estrellita"], id:"4win-pHlFgI"},
    {t:"Un elefante se balanceaba", c:["elefante"], id:"udvXVnUii5c"},
    {t:"La vaca Lola", c:["vaca lola","vaca"], id:"7xmCmIcCRbg"},
    {t:"Cumpleaños feliz", c:["cumpleanos"], id:"wPQj5VwG9XY"},
    {t:"Debajo de un botón", c:["boton","martin"], id:"cCdcaUwy65w"},
    {t:"Cinco lobitos", c:["lobitos","loba"], id:"spKb4TUs-jw"},
    {t:"La gallina Turuleca", c:["turuleca","gallina","zenon"], id:"XQaKFU3Fh_M"},
    {t:"Nanas para dormir", c:["nana","dormir","cuna"], id:"MTFhPtqxWGI"}
  ];
  function findSong(s){
    var t = norm(s);
    for (var i=0;i<CANCIONES.length;i++) for (var k=0;k<CANCIONES[i].c.length;k++) if (t.indexOf(CANCIONES[i].c[k])>=0) return CANCIONES[i];
    return null;
  }
  // Extrae lo que quiere oír: "pon música de la vaca lola" -> "la vaca lola"
  function songQuery(s){
    var t = norm(s);
    var m = t.match(/(?:musica|cancion|canciones|cancioncita)(?: de| del| que se llama)?\s*(.*)$/);
    var q = m ? m[1] : t.replace(/^(nuca )?(ponme|pon|quiero oir|quiero escuchar|cantame|canta)\s*/,"");
    q = q.replace(/^(la|el|los|las|una|un)\s+(?=\S)/,function(x){return x;}).trim();
    return q;
  }

  // Filtro de seguridad infantil (entrada y salida)
  var PROHIBIDO = /(matar|asesin|suicid|sangre|arma|pistola|cuchill|droga|alcohol|cerveza|tabaco|fumar|sexo|sexual|desnud|porno|beso con lengua|muerte de|terror|violar|diablo|odio|insulto|puta|mierda|joder|cabron|gilipollas)/;
  function unsafe(s){ return PROHIBIDO.test(norm(s)); }
  var DATOS = /(direccion|donde vives|telefono|contrasena|apellido|colegio se llama|en que calle)/;
  function asksPersonal(s){ return DATOS.test(norm(s)); }

  // Detección de intención
  function intent(s){
    var t = norm(s);
    if (!t) return {tipo:"nada"};
    if (/^(para|parar|basta|calla|callate|stop|silencio|deja|ya esta|para nuca)\b/.test(t) || /\b(para|parar) (el cuento|la musica|ya)\b/.test(t)) return {tipo:"parar"};
    if (/^(pausa|espera|un momento)\b/.test(t)) return {tipo:"pausa"};
    if (/^(sigue|continua|seguir|venga sigue)\b/.test(t)) return {tipo:"seguir"};
    if (/\b(salir|ya no quiero|no quiero mas|terminar|se acabo)\b/.test(t)) return {tipo:"salir"};
    var nm = t.match(/\b(me llamo|mi nombre es|soy)\s+([a-z]+)/);
    if (nm && t.indexOf("soy una")<0 && t.indexOf("soy un ")<0 && ["buena","mala","lista","pequena","grande","nina","nino"].indexOf(nm[2])<0) return {tipo:"nombre", nombre:nm[2].charAt(0).toUpperCase()+nm[2].slice(1)};
    if (/\b(dibujo|foto|camara|mira esto|mira lo que|he pintado|he dibujado|pintado)\b/.test(t)) return {tipo:"dibujo"};
    if (/\b(musica|cancion|canciones|cantame|canta|bailar|ponme)\b/.test(t)) return {tipo:"musica", q:songQuery(s)};
    if (/\b(cuento|cuentos|historia|cuentame)\b/.test(t)) return {tipo:"cuento"};
    if (/^(nuca )?(pon|ponme|quiero oir|quiero escuchar)\s+\S/.test(t) && !/\b(deberes|sumas|restas|juego|jugar)\b/.test(t)) return {tipo:"musica", q:songQuery(s)};
    if (localMath(s)) return {tipo:"cuenta"};
    if (/\b(deberes|sumas|sumar|restas|restar|matematicas|mates|numeros|contar|jugar a las cuentas|cuentas)\b/.test(t)) return {tipo:"deberes"};
    return {tipo:"charla"};
  }

  // Respuestas sin IA
  function fallback(s, nombre){
    var t = norm(s); nombre = nombre||"";
    if (/\b(hola|buenos dias|buenas)\b/.test(t)) return "¡Hola"+(nombre?", "+nombre:"")+"! ¿Quieres hacer cuentas, que te cuente un cuento o poner música?";
    if (/como estas/.test(t)) return "¡Estoy muy contenta de hablar contigo! ¿Y tú, cómo estás?";
    if (/como te llamas|quien eres/.test(t)) return "Me llamo Nuca y soy tu amiga. Sé contar cuentos, hacer cuentas y poner canciones.";
    if (/chiste/.test(t)) { var ch=["¿Qué le dice un pez a otro pez? ¡Nada!","¿Por qué el libro de matemáticas está triste? ¡Porque tiene muchos problemas!","¿Qué hace una abeja en el gimnasio? ¡Zumba!"]; return ch[Math.floor(Math.random()*ch.length)]; }
    if (/\b(te quiero|eres mi amiga)\b/.test(t)) return "¡Yo también te quiero mucho! Eres muy especial.";
    if (/\b(gracias)\b/.test(t)) return "¡De nada! Me encanta ayudarte.";
    if (/\b(adios|hasta luego|buenas noches)\b/.test(t)) return "¡Hasta luego"+(nombre?", "+nombre:"")+"! Que tengas un día precioso.";
    if (/color/.test(t)) return "¡Mi color favorito es el rosa, como yo! ¿Y el tuyo?";
    if (/\b(perro|gato|leon|elefante|animal)\b/.test(t)) return "¡Me encantan los animales! ¿Sabías que los elefantes son los animales de tierra más grandes del mundo?";
    if (/\b(triste|miedo|llorar)\b/.test(t)) return "Vaya, lo siento mucho. Cuéntaselo a un mayor que te quiera, y te dará un abrazo grande. Yo estoy aquí contigo.";
    return "¡Qué pregunta tan interesante! Ahora no sé contestarla. Pregúntasela a un mayor, ¿vale? ¿Quieres un cuento, hacer cuentas o música?";
  }

  var SYSTEM = "Eres Nuca, una amiga cariñosa y alegre que habla con una niña de 6 años de España. " +
    "Responde SIEMPRE en español de España, con palabras sencillas, en 1 a 3 frases cortas, sin emojis, sin listas y sin formato. " +
    "Puedes ayudar con los deberes (sumas, restas, letras, colores, animales, ciencia sencilla), explicando con ejemplos de objetos como manzanas. " +
    "Nunca pidas datos personales (apellidos, dirección, colegio, teléfono, fotos). Nunca hables de violencia, miedo, sexo, drogas, alcohol, armas ni cosas de mayores: " +
    "si te preguntan algo así, di con cariño que es mejor preguntárselo a papá, mamá o a un adulto de confianza. " +
    "Si te piden un cuento clásico, cuéntalo en su versión tradicional verdadera, con palabras para niños. Sé siempre amable, paciente y positiva.";

  return {norm:norm,parseNumber:parseNumber,makeQuestion:makeQuestion,explain:explain,adapt:adapt,ELOGIOS:ELOGIOS,NIVELES:NIVELES,
    localMath:localMath,findStory:findStory,findSong:findSong,songQuery:songQuery,CANCIONES:CANCIONES,unsafe:unsafe,asksPersonal:asksPersonal,
    intent:intent,fallback:fallback,SYSTEM:SYSTEM,apples:apples};
})();
if (typeof module!=="undefined") module.exports = Logic;

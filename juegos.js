// Juegos por voz de Nuca (datos y comprobación, sin DOM).
var Juegos = (function(){
  var N = function(s){ return (typeof Logic!=="undefined"?Logic:require("./logic.js")).norm(s); };
  var ADIVINANZAS = [
    {p:"Blanca por dentro, verde por fuera. Si quieres que te lo diga, espera.", r:["pera"]},
    {p:"Tengo agujas y no sé coser, tengo números y no sé leer.", r:["reloj"]},
    {p:"Oro parece, plata no es. Adivina, adivina, ¿qué fruta es?", r:["platano","platanos"]},
    {p:"Vuela sin alas, silba sin boca, y no se ve.", r:["viento","aire"]},
    {p:"Tiene dientes y no come, tiene cabeza y no es hombre.", r:["ajo"]},
    {p:"Tengo cuatro patas y no puedo andar, tengo cabecera y no sé hablar.", r:["cama"]},
    {p:"Lleva su casa a cuestas, va muy despacito y saca los cuernos cuando llueve.", r:["caracol"]},
    {p:"Redondo, redondo, sale por la mañana y nos da calor.", r:["sol"]},
    {p:"Soy alto, tengo hojas y en mis ramas cantan los pájaros.", r:["arbol"]},
    {p:"Tiene orejas largas, salta y salta y le encantan las zanahorias.", r:["conejo"]},
    {p:"Cuanto más lavo, más sucia me pongo.", r:["agua"]},
    {p:"Me pongo en los pies para salir a la calle, y tengo cordones.", r:["zapato","zapatos","zapatilla","zapatillas"]},
    {p:"Es el rey de la selva y tiene una gran melena.", r:["leon"]},
    {p:"Doy leche, hago muuu y vivo en la granja.", r:["vaca"]}
  ];
  var ANIMALES = [
    {s:"muuu", r:["vaca"]},{s:"guau guau", r:["perro","perrito"]},{s:"miau", r:["gato","gatito"]},
    {s:"cua cua", r:["pato","patito"]},{s:"beee", r:["oveja","cabra"]},{s:"oinc oinc", r:["cerdo","cerdito","cochino","chancho"]},
    {s:"quiquiriquí", r:["gallo"]},{s:"pío pío", r:["pollito","pajaro","pollo"]},{s:"iiiá", r:["burro"]},
    {s:"croac croac", r:["rana"]},{s:"grrr, y es el rey de la selva", r:["leon"]},{s:"jiiii, y tiene crines y galopa", r:["caballo"]},
    {s:"uuu uuu por la noche", r:["buho","lechuza"]},{s:"bzzz y hace miel", r:["abeja"]}
  ];
  var VEOVEO = [
    {c:"amarillo", pista:"Es una fruta alargada que comen los monos.", r:["platano"]},
    {c:"rojo", pista:"Es una fruta redonda, y a veces es verde.", r:["manzana","fresa","tomate"]},
    {c:"naranja", pista:"Es una verdura larga que les encanta a los conejos.", r:["zanahoria"]},
    {c:"azul", pista:"Está muy alto, y por el día lo vemos encima de nosotros.", r:["cielo","mar"]},
    {c:"verde", pista:"Crece en el jardín y la pisamos en el parque.", r:["hierba","cesped","arbol","hoja","hojas"]},
    {c:"blanco", pista:"Cae del cielo en invierno y con ella hacemos muñecos.", r:["nieve"]},
    {c:"amarillo", pista:"Brilla en el cielo y nos da calor.", r:["sol"]},
    {c:"rosa", pista:"Es un animal de la granja que hace oinc oinc.", r:["cerdo","cerdito"]},
    {c:"negro", pista:"Es cuando no hay sol y salen las estrellas.", r:["noche"]},
    {c:"rojo", pista:"Es un camión que apaga fuegos.", r:["camion de bomberos","bomberos","camion"]}
  ];
  var NOMBRES = {adivinanzas:"adivinanzas", veoveo:"veo veo", numeros:"números", animales:"qué animal hace"};
  function elegir(t){
    t = N(t);
    if (/adivin/.test(t)) return "adivinanzas";
    if (/veo/.test(t)) return "veoveo";
    if (/numero|contar|cuenta/.test(t)) return "numeros";
    if (/animal/.test(t)) return "animales";
    return null;
  }
  function pick(arr, prev){ var i; do { i=Math.floor(Math.random()*arr.length); } while (arr.length>1 && arr[i]===prev); return arr[i]; }
  // Devuelve {texto, item, juego}
  function pregunta(juego, prev){
    if (juego==="adivinanzas"){ var a=pick(ADIVINANZAS,prev); return {juego:juego,item:a,texto:"Adivina, adivinanza: "+a.p+" ¿Qué es?"}; }
    if (juego==="animales"){ var b=pick(ANIMALES,prev); return {juego:juego,item:b,texto:"¿Qué animal hace "+b.s+"?"}; }
    if (juego==="veoveo"){ var c=pick(VEOVEO,prev); return {juego:juego,item:c,texto:"Veo, veo. ¿Qué ves? Una cosita de color "+c.c+". "+c.pista}; }
    var q = Logic.makeQuestion(2); return {juego:"numeros", item:q, texto:q.texto};
  }
  function acierta(juego, item, texto){
    if (juego==="numeros"){ var n=Logic.parseNumber(texto); return n===item.res; }
    var t = " "+N(texto)+" ";
    for (var i=0;i<item.r.length;i++){ var r=item.r[i]; if (t.indexOf(" "+r+" ")>=0 || t.indexOf(" "+r+"s ")>=0) return true; }
    return false;
  }
  function solucion(juego, item){
    if (juego==="numeros") return "Era el "+item.res+".";
    var r=item.r[0]; r = ({platano:"plátano",leon:"león",arbol:"árbol",buho:"búho",camion:"camión",cesped:"césped",pajaro:"pájaro"})[r] || r; return "¡Era "+(/a$/.test(r)?"una ":"un ")+r+"!";
  }
  function siNo(texto){
    var t=N(texto);
    if (/^(si|vale|venga|claro|vamos|si quiero|bueno|ok|yupi)\b/.test(t) || /\bquiero jugar\b/.test(t)) return "si";
    if (/^(no|ahora no|luego|no quiero)\b/.test(t)) return "no";
    return null;
  }
  return {ADIVINANZAS:ADIVINANZAS,ANIMALES:ANIMALES,VEOVEO:VEOVEO,NOMBRES:NOMBRES,elegir:elegir,pregunta:pregunta,acierta:acierta,solucion:solucion,siNo:siNo};
})();
if (typeof module!=="undefined") module.exports = Juegos;

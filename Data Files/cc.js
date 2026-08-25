/* SCE command-center shared engine: header, builders, movable/resizable widgets */
function fmt(n){return Math.round(n).toLocaleString('en-US');}

function ccHeader(active,title,subtitle){
  var pages=[['index.html','ECOSYSTEM'],['field-survey.html','FIELD VERIFICATION'],['kpis.html','KPI LIBRARY'],['bigscreen.html','BIG SCREEN']];
  var nav='';pages.forEach(function(p){nav+='<a class="sc'+(p[0]===active?' on':'')+'" href="'+p[0]+'">'+p[1]+'</a>';});
  var h='<div class="hd"><div class="lt"><div class="t1">'+title+'</div><div class="t2">'+subtitle+'</div></div>'+
   '<img src="assets/sce_logo_dark.png" alt="SCE">'+
   '<div class="rt"><div class="t1">LEAP 2026</div><div class="t2" id="ccClock">·</div></div>'+
   '<div class="navrow">'+nav+'<span class="sc rst" id="ccReset">⟲ RESET LAYOUT</span></div></div>';
  document.body.insertAdjacentHTML('afterbegin',h);
  setInterval(function(){var d=new Date();var el=document.getElementById('ccClock');
    if(el)el.textContent=d.toLocaleDateString('en-GB')+' · '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});},1000);
}

/* ---- content builders ---- */
function bKpis(items){var h='<div class="krow k'+items.length+'">';items.forEach(function(t){h+='<div class="kpi"><div class="n '+t[2]+'">'+t[0]+'</div><div class="l">'+t[1]+'</div></div>';});return h+'</div>';}
function bBars(data,color){var mx=0;data.forEach(function(x){if(x[1]>mx)mx=x[1];});var h='';
 data.forEach(function(x){h+='<div class="hbar"><div class="hl"><span class="ht">'+x[0]+'</span><span class="hv">'+fmt(x[1])+'</span></div><div class="tr"><div class="fl" style="width:'+(100*x[1]/mx)+'%;background:'+color+'"></div></div></div>';});return h;}
function bDonut(pairs){var tot=0;pairs.forEach(function(p){tot+=p[1];});var acc=0,st=[];
 pairs.forEach(function(p){var v=p[1]/tot*360;st.push(p[2]+' '+acc+'deg '+(acc+v)+'deg');acc+=v;});
 var lg='';pairs.forEach(function(p){lg+='<div><span class="sw" style="background:'+p[2]+'"></span>'+p[0]+' · <b>'+fmt(p[1])+'</b></div>';});
 return '<div class="donutwrap"><div class="donut" style="background:conic-gradient('+st.join(',')+')"></div><div class="dleg">'+lg+'</div></div>';}
function bSpark(series,color){var mx=0;series.forEach(function(s){if(s[1]>mx)mx=s[1];});
 var w=520,h=110,pts=series.map(function(s,i){return (i/(series.length-1)*w).toFixed(1)+','+(h-6-(s[1]/mx)*(h-18)).toFixed(1);}).join(' ');
 return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2.5"/><polyline points="0,'+h+' '+pts+' '+w+','+h+'" fill="'+color+'22" stroke="none"/></svg>'+
 '<div class="sprange"><span>'+series[0][0]+'</span><span>'+series[series.length-1][0]+'</span></div>';}
function bTable(rows){var h='<table class="tbl">';rows.forEach(function(r){h+='<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>';});return h+'</table>';}
function bGauge(pct,color,note){return '<div class="gauge"><div class="gring" style="background:conic-gradient('+color+' 0deg '+(pct*3.6)+'deg,#06253c '+(pct*3.6)+'deg 360deg)"><div class="gval" style="color:'+color+'">'+pct+'%</div></div><div class="gnote">'+note+'</div></div>';}

/* ---- widget engine ---- */
function ccDash(key,defs,canvasH){
  var cv=document.createElement('div');cv.className='canvas';cv.style.height=(canvasH||1000)+'px';
  document.body.appendChild(cv);
  var store='ccl_'+key;
  var saved={};try{saved=JSON.parse(localStorage.getItem(store)||'{}');}catch(e){}
  var Ws=[];
  defs.forEach(function(d){
    var pos=saved[d.id]||{x:d.x,y:d.y,w:d.w,h:d.h};
    var el=document.createElement('div');el.className='widget';
    el.style.left=pos.x+'px';el.style.top=pos.y+'px';el.style.width=pos.w+'px';el.style.height=pos.h+'px';
    var chipsHtml='';
    if(d.chips){d.chips.forEach(function(c,i){chipsHtml+='<div class="ch'+(i===0?' on':'')+'" data-i="'+i+'">'+c+'</div>';});}
    el.innerHTML='<div class="whead"><h3>'+d.title+'</h3><div class="chips">'+chipsHtml+'</div></div><div class="wbody"></div><div class="wresize">◢</div>';
    cv.appendChild(el);
    var body=el.querySelector('.wbody'),cur=0;
    function render(){d.views[cur](body);}
    el.querySelectorAll('.ch').forEach(function(c){c.onclick=function(e){e.stopPropagation();cur=+c.dataset.i;
      el.querySelectorAll('.ch').forEach(function(x){x.classList.toggle('on',x===c);});render();};});
    render();
    function save(){saved[d.id]={x:parseInt(el.style.left),y:parseInt(el.style.top),w:el.offsetWidth,h:el.offsetHeight};
      try{localStorage.setItem(store,JSON.stringify(saved));}catch(e){}}
    /* drag */
    var hd=el.querySelector('.whead');
    hd.addEventListener('pointerdown',function(e){
      if(e.target.classList.contains('ch'))return;
      e.preventDefault();var sx=e.clientX,sy=e.clientY,ox=parseInt(el.style.left),oy=parseInt(el.style.top);
      el.classList.add('moving');
      function mv(ev){el.style.left=Math.max(0,ox+ev.clientX-sx)+'px';el.style.top=Math.max(0,oy+ev.clientY-sy)+'px';}
      function up(){removeEventListener('pointermove',mv);removeEventListener('pointerup',up);el.classList.remove('moving');save();}
      addEventListener('pointermove',mv);addEventListener('pointerup',up);
    });
    /* resize */
    var rz=el.querySelector('.wresize');
    rz.addEventListener('pointerdown',function(e){
      e.preventDefault();e.stopPropagation();
      var sx=e.clientX,sy=e.clientY,ow=el.offsetWidth,oh=el.offsetHeight;
      el.classList.add('moving');
      function mv(ev){el.style.width=Math.max(d.minw||260,ow+ev.clientX-sx)+'px';el.style.height=Math.max(d.minh||140,oh+ev.clientY-sy)+'px';
        if(d.onResize)d.onResize();}
      function up(){removeEventListener('pointermove',mv);removeEventListener('pointerup',up);el.classList.remove('moving');save();if(d.onResize)d.onResize();}
      addEventListener('pointermove',mv);addEventListener('pointerup',up);
    });
    Ws.push({def:d,el:el});
  });
  var rst=document.getElementById('ccReset');
  if(rst)rst.onclick=function(){try{localStorage.removeItem(store);}catch(e){}location.reload();};
  return Ws;
}

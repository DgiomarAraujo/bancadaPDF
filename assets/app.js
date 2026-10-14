(function(G){
"use strict";
var CFG=G.BANCADA||{ads:{}},ADS=CFG.ads||{},TL=G.BancadaTools,IC=G.BancadaIcons.ic;
var TOOLS=TL.TOOLS,fmt=TL.fmt,base=TL.base;
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var ROOT=new URL('.',document.currentScript.src).href+'../';

/* ---------- carregador de bibliotecas (sob demanda) ---------- */
var LIBS={pdflib:'vendor/pdf-lib.min.js',pdfjs:'vendor/pdf.min.js',jszip:'vendor/jszip.min.js',mammoth:'vendor/mammoth.browser.min.js'};
var loaded={};
G.BancadaLoad=function(names){
  return Promise.all(names.map(function(n){
    return loaded[n]||(loaded[n]=new Promise(function(res,rej){
      var s=document.createElement('script');s.src=ROOT+'assets/'+LIBS[n];
      s.onload=function(){if(n==='pdfjs')G.pdfjsLib.GlobalWorkerOptions.workerSrc=ROOT+'assets/vendor/pdf.worker.min.js';res()};
      s.onerror=function(){delete loaded[n];rej(new Error('Não foi possível carregar um componente. Verifique sua conexão e tente de novo.'))};
      document.head.appendChild(s);
    }));
  }));
};

/* ---------- utilidades ---------- */
function toast(msg){
  $$('.toast').forEach(function(t){t.remove()});
  var t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;
  document.body.appendChild(t);setTimeout(function(){t.remove()},3400);
}
function accOf(f){
  var n=f.name||'';
  if(f.type==='application/pdf'||/\.pdf$/i.test(n))return 'pdf';
  if(/\.docx$/i.test(n)||f.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return 'docx';
  if((f.type||'').indexOf('image/')===0)return 'img';
  return null;
}
var ACCEPT={pdf:'application/pdf,.pdf',img:'image/*',docx:'.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
function pickFiles(accept,multiple,cb){
  var p=$('#picker');if(!p){p=document.createElement('input');p.type='file';p.id='picker';p.hidden=true;document.body.appendChild(p)}
  p.multiple=!!multiple;p.accept=accept;
  p.onchange=function(){var fs=[].slice.call(p.files);p.value='';if(fs.length)cb(fs)};
  p.click();
}
/* ponte de arquivos entre páginas (IndexedDB, só no aparelho) */
var idb={
  open:function(){return new Promise(function(res,rej){var r=indexedDB.open('bancada',1);r.onupgradeneeded=function(){r.result.createObjectStore('pending',{keyPath:'k',autoIncrement:true})};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})},
  put:function(files){return idb.open().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('pending','readwrite'),st=tx.objectStore('pending');st.clear();files.forEach(function(f){st.add({name:f.name,type:f.type,blob:f})});tx.oncomplete=res;tx.onerror=function(){rej(tx.error)}})})},
  take:function(){return idb.open().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('pending','readwrite'),st=tx.objectStore('pending'),q=st.getAll();q.onsuccess=function(){var rows=q.result;st.clear();tx.oncomplete=function(){res(rows.map(function(r){return new File([r.blob],r.name,{type:r.type})}))}};tx.onerror=function(){rej(tx.error)}})})},
  clear:function(){return idb.open().then(function(db){var tx=db.transaction('pending','readwrite');tx.objectStore('pending').clear()}).catch(function(){})}
};

/* ---------- anúncios + consentimento ---------- */
function adsInit(){
  var slots=$$('.adslot');
  if(!ADS.enabled){
    if(ADS.preview){slots.forEach(function(el){el.classList.add('ph');el.textContent='Espaço publicitário ('+(el.dataset.slot==='side'?'300×600':'responsivo')+')'})}
    else document.documentElement.classList.add('ads-off');
    return;
  }
  var c=null;try{c=localStorage.getItem('bancada-consent')}catch(e){}
  if(c)loadAds(c);else showConsent();
}
function showConsent(){
  var d=document.createElement('div');d.className='consent';d.setAttribute('role','dialog');d.setAttribute('aria-label','Cookies e publicidade');
  d.innerHTML='<p>Usamos cookies para exibir anúncios, o que mantém o site gratuito. Você escolhe se eles podem ser personalizados. Veja a <a href="privacidade.html">Política de Privacidade</a>.</p><div><button class="ok">Aceitar</button><button class="no">Só o essencial</button></div>';
  document.body.appendChild(d);
  d.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    var v=b.classList.contains('ok')?'all':'essential';
    try{localStorage.setItem('bancada-consent',v)}catch(x){}
    d.remove();loadAds(v);
  });
}
function loadAds(c){
  if(c==='essential'&&ADS.onDecline==='none'){document.documentElement.classList.add('ads-off');return}
  G.adsbygoogle=G.adsbygoogle||[];
  if(c==='essential')G.adsbygoogle.requestNonPersonalizedAds=1;
  var s=document.createElement('script');s.async=true;s.crossOrigin='anonymous';
  s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(ADS.client);
  document.head.appendChild(s);
  $$('.adslot').forEach(function(el){
    if(el.offsetParent===null)return; /* bloco escondido (ex.: coluna lateral no celular) */
    var ins=document.createElement('ins');ins.className='adsbygoogle';ins.style.display='block';
    ins.setAttribute('data-ad-client',ADS.client);ins.setAttribute('data-ad-slot',(ADS.slots||{})[el.dataset.slot]||'');
    ins.setAttribute('data-ad-format','auto');ins.setAttribute('data-full-width-responsive','true');
    el.appendChild(ins);
    try{(G.adsbygoogle=G.adsbygoogle||[]).push({})}catch(e){}
  });
}

/* ---------- página inicial ---------- */
function initHome(){
  idb.clear();
  var cards=$$('.tool'),state={cat:'Todas',q:'',kind:null};
  function apply(){
    var n=0;
    cards.forEach(function(c){
      var ok=(state.cat==='Todas'||c.dataset.cat===state.cat)&&(!state.q||c.dataset.search.indexOf(state.q)>-1)&&(!state.kind||c.dataset.accept===state.kind);
      c.hidden=!ok;if(ok)n++;
    });
    $('#empty').hidden=n>0;
  }
  $$('#chips button').forEach(function(b){b.addEventListener('click',function(){
    state.cat=b.dataset.cat;$$('#chips button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});apply();
  })});
  $('#q').addEventListener('input',function(e){state.q=e.target.value.trim().toLowerCase();apply()});
  var pend=$('#pending');
  function setPending(files){
    var kind=accOf(files[0]);
    if(!kind){toast('Formato não suportado. Use PDF, Word (.docx) ou imagens.');return}
    files=files.filter(function(f){return accOf(f)===kind});
    idb.put(files).then(function(){
      state.kind=kind;
      $('#pendtxt').textContent=files.length+' arquivo(s) pronto(s). Escolha a ferramenta abaixo.';
      pend.hidden=false;apply();$('.filters').scrollIntoView({behavior:'smooth',block:'start'});
    }).catch(function(){toast('Não foi possível guardar o arquivo. Abra a ferramenta e envie por lá.')});
  }
  $('#dz').addEventListener('click',function(){pickFiles('application/pdf,.pdf,.docx,image/*',true,setPending)});
  $('#pendclear').addEventListener('click',function(){idb.clear();state.kind=null;pend.hidden=true;apply()});
  ['dragover','drop'].forEach(function(ev){document.addEventListener(ev,function(e){
    if(!e.dataTransfer||[].indexOf.call(e.dataTransfer.types,'Files')<0)return;
    e.preventDefault();if(ev==='drop'&&e.dataTransfer.files.length)setPending([].slice.call(e.dataTransfer.files));
  })});
}

/* ---------- página de ferramenta ---------- */
function initTool(root){
  var def=TOOLS.filter(function(t){return t.id===root.dataset.tool})[0];if(!def)return;
  var S={files:[],opts:{},busy:false,out:null,err:'',pages:null,loading:false,prog:'',frac:0,tok:0,urls:[]};
  def.fields.forEach(function(f){S.opts[f.k]=f.def});
  var label={pdf:def.multiple?'Adicionar PDFs':'Escolher PDF',img:'Adicionar imagens',docx:'Escolher documento Word'}[def.accept];
  root.innerHTML='<div class="panel"><div id="t-files"></div></div><div id="t-opts"></div><div id="t-run"></div><div id="t-out"></div>';

  function renderFiles(){
    var list=S.files.length?'<ul class="files">'+S.files.map(function(f,i){
      return '<li><span style="color:var(--accent)">'+IC(def.accept==='docx'?'doc':'file')+'</span><span class="n"><b>'+esc(f.file.name)+'</b><small>'+fmt(f.file.size)+(f.pages?' · '+f.pages+' pág.':'')+(f.bad?' · não foi possível ler':'')+'</small></span>'+
      (def.multiple?'<button class="sq" data-act="mv" data-i="'+i+'" data-d="-1" aria-label="Subir" '+(i===0?'disabled':'')+'>'+IC('up')+'</button><button class="sq" data-act="mv" data-i="'+i+'" data-d="1" aria-label="Descer" '+(i===S.files.length-1?'disabled':'')+'>'+IC('down')+'</button>':'')+
      '<button class="sq" data-act="rm" data-i="'+i+'" aria-label="Remover">'+IC('x')+'</button></li>';
    }).join('')+'</ul>':'';
    var dz=S.files.length&&!def.multiple?'<button class="btn ghost" data-act="pick">'+IC('plus')+' Trocar arquivo</button>':
      S.files.length?'<button class="btn ghost" data-act="pick">'+IC('plus')+' '+label+'</button>':
      '<button class="drop" id="dz" data-act="pick"><span class="plus">'+IC('plus')+'</span><span><b>'+label+'</b><span class="s">ou arraste e solte aqui</span></span></button>';
    $('#t-files').innerHTML=list+dz;
  }
  function fieldHTML(f){
    var v=S.opts[f.k];
    if(f.type==='select')return '<label class="fld"><span>'+f.label+'</span><select data-opt="'+f.k+'">'+f.options.map(function(o){return '<option value="'+esc(o[0])+'" '+(o[0]==v?'selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></label>';
    if(f.type==='check')return '<label class="fld chk"><input type="checkbox" data-opt="'+f.k+'" '+(v?'checked':'')+'><span>'+f.label+'</span></label>';
    return '<label class="fld"><span>'+f.label+'</span><input data-opt="'+f.k+'" type="'+f.type+'" value="'+esc(v)+'" '+(f.min!=null?'min="'+f.min+'" max="'+f.max+'" step="'+f.step+'"':'')+'></label>';
  }
  function pagesGrid(){
    if(S.loading&&!S.pages.length)return '<p class="msg">Gerando miniaturas…</p>';
    if(!S.pages||!S.pages.length)return S.files.length&&!S.loading?'<p class="msg err">Nenhuma página restante.</p>':'';
    return '<div class="pgrid">'+S.pages.map(function(p,i){
      return '<figure class="pg"><div class="pgimg" style="--r:'+p.rot+'deg"><img src="'+p.thumb+'" alt="Página '+(p.n+1)+'"></div><figcaption>pág. '+(p.n+1)+'</figcaption><div class="pgbtns">'+
      '<button data-act="o-l" data-i="'+i+'" aria-label="Mover para trás" '+(i===0?'disabled':'')+'>'+IC('back')+'</button><button data-act="o-r" data-i="'+i+'" aria-label="Mover para frente" '+(i===S.pages.length-1?'disabled':'')+'>'+IC('right')+'</button>'+
      '<button data-act="o-rot" data-i="'+i+'" aria-label="Girar">'+IC('rotate')+'</button><button data-act="o-del" data-i="'+i+'" aria-label="Excluir">'+IC('x')+'</button></div></figure>';
    }).join('')+'</div>'+(S.loading?'<p class="msg">Carregando mais páginas…</p>':'');
  }
  function renderOpts(){
    var el=$('#t-opts');
    if(def.custom){el.innerHTML=S.files.length?'<div class="panel"><h3>Páginas</h3>'+pagesGrid()+'</div>':'';return}
    var fs=def.fields.filter(function(f){return !f.when||f.when(S.opts)});
    el.innerHTML=fs.length&&S.files.length?'<div class="panel"><h3>Opções</h3><div class="opts">'+fs.map(fieldHTML).join('')+'</div></div>':'';
  }
  function renderRun(){
    $('#t-run').innerHTML='<button class="go" data-act="run" '+(S.busy?'disabled':'')+'>'+(S.busy?'Processando…':'Processar')+'</button>'+
      (S.busy?'<div class="prog" role="progressbar" aria-valuenow="'+Math.round(S.frac*100)+'"><i id="pbar" style="width:'+Math.round(S.frac*100)+'%"></i></div><p class="msg" id="pmsg">'+esc(S.prog)+'</p>':'')+
      (S.err?'<p class="msg err" role="alert">'+esc(S.err)+'</p>':'');
  }
  function renderOut(){
    var el=$('#t-out');S.urls.forEach(function(u){URL.revokeObjectURL(u)});S.urls=[];
    if(!S.out){el.innerHTML='';return}
    var o=S.out,single=o.length===1&&o[0].blob.type==='application/pdf';
    var next=single?TOOLS.filter(function(t){return t.accept==='pdf'&&t.id!==def.id}).slice(0,8):[];
    el.innerHTML='<div class="panel" style="margin-top:14px"><h3>'+(o.length>1?o.length+' arquivos gerados':'Pronto! Seu arquivo está aqui')+'</h3><div class="out">'+
      o.map(function(f){var u=URL.createObjectURL(f.blob);S.urls.push(u);
        return '<div class="row"><span style="color:var(--accent)">'+IC('file')+'</span><span class="n"><b>'+esc(f.name)+'</b><small>'+fmt(f.blob.size)+(f.note?' · '+esc(f.note):'')+'</small></span><a class="btn" href="'+u+'" download="'+esc(f.name)+'">'+IC('download')+' Baixar</a></div>'}).join('')+
      (o.length>1?'<button class="btn" data-act="zip">'+IC('download')+' Baixar tudo (.zip)</button>':'')+'</div>'+
      (next.length?'<div class="next"><b>Continuar com este arquivo:</b><div class="row2">'+next.map(function(t){return '<button data-chain="'+t.slug+'">'+t.name+'</button>'}).join('')+'</div></div>':'')+'</div>';
  }
  function addFiles(list){
    var fs=[].slice.call(list).filter(function(f){return accOf(f)===def.accept});
    if(!fs.length){toast(def.accept==='pdf'?'Esta ferramenta usa arquivos PDF.':def.accept==='docx'?'Esta ferramenta usa documentos Word (.docx).':'Esta ferramenta usa imagens (JPG, PNG, WebP).');return}
    if(!def.multiple){fs=fs.slice(0,1);S.files=[]}
    var added=fs.map(function(file){return {file:file}});
    S.files=S.files.concat(added);S.out=null;S.err='';
    renderFiles();renderOpts();renderOut();renderRun();
    if(def.accept==='pdf'){
      G.BancadaLoad(['pdflib']).then(function(){
        return added.reduce(function(p,a){return p.then(function(){return a.file.arrayBuffer()}).then(function(buf){return G.PDFLib.PDFDocument.load(buf,{ignoreEncryption:true})}).then(function(d){a.pages=d.getPageCount()},function(){a.bad=true}).then(renderFiles)},Promise.resolve());
      });
    }
    if(def.custom)loadThumbs();
  }
  function loadThumbs(){
    var tok=++S.tok;S.pages=[];S.loading=true;renderOpts();
    var f=S.files[0].file;
    G.BancadaLoad(['pdfjs']).then(function(){return f.arrayBuffer()}).then(function(buf){return G.pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise}).then(function(doc){
      var i=1;
      (function step(){
        if(S.tok!==tok)return;
        if(i>doc.numPages){S.loading=false;renderOpts();return}
        doc.getPage(i).then(function(page){
          var vp=page.getViewport({scale:.35}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
          var ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
          return page.render({canvasContext:ctx,viewport:vp}).promise.then(function(){S.pages.push({n:i-1,rot:0,thumb:c.toDataURL('image/jpeg',.6)});page.cleanup()});
        }).then(function(){if(i%6===0||i===doc.numPages)renderOpts();i++;setTimeout(step,0)});
      })();
    }).catch(function(){S.loading=false;S.err='Não foi possível ler este PDF.';renderRun();renderOpts()});
  }
  function run(){
    if(S.busy)return;
    if(!S.files.length){toast('Adicione um arquivo primeiro.');return}
    S.busy=true;S.out=null;S.err='';S.frac=0;S.prog='Preparando…';renderRun();renderOut();
    var t0=Date.now();
    def.run({files:S.files.map(function(f){return f.file}),opts:S.opts,T:S,progress:function(m,f){
      S.prog=m;S.frac=f;var b=$('#pbar'),p=$('#pmsg');if(b)b.style.width=Math.round(f*100)+'%';if(p)p.textContent=m}})
    .then(function(outs){S.out=outs})
    .catch(function(e){console.error(e);S.err=e&&e.message?e.message:'Algo deu errado ao processar este arquivo.'})
    .then(function(){S.busy=false;renderRun();renderOut();if(S.out){var r=$('#t-out');if(r&&r.scrollIntoView)r.scrollIntoView({behavior:'smooth',block:'nearest'})}});
  }
  root.addEventListener('click',function(e){
    var ch=e.target.closest('[data-chain]');
    if(ch){var o=S.out[0];idb.put([new File([o.blob],o.name,{type:o.blob.type})]).then(function(){location.href=ch.dataset.chain+'.html'});return}
    var a=e.target.closest('[data-act]');if(!a)return;
    var i=+a.dataset.i;
    switch(a.dataset.act){
      case 'pick':pickFiles(ACCEPT[def.accept],def.multiple,addFiles);break;
      case 'rm':S.files.splice(i,1);S.out=null;if(def.custom){S.tok++;S.pages=[];S.loading=false}renderFiles();renderOpts();renderOut();break;
      case 'mv':{var j=i+ +a.dataset.d,t=S.files[i];S.files[i]=S.files[j];S.files[j]=t;renderFiles();break}
      case 'o-l':case 'o-r':{var k=i+(a.dataset.act==='o-l'?-1:1),x=S.pages[i];S.pages[i]=S.pages[k];S.pages[k]=x;renderOpts();break}
      case 'o-rot':S.pages[i].rot=(S.pages[i].rot+90)%360;renderOpts();break;
      case 'o-del':S.pages.splice(i,1);renderOpts();break;
      case 'run':run();break;
      case 'zip':
        G.BancadaLoad(['jszip']).then(function(){var z=new G.JSZip();S.out.forEach(function(o){z.file(o.name,o.blob)});return z.generateAsync({type:'blob'})}).then(function(b){
          var u=URL.createObjectURL(b),l=document.createElement('a');l.href=u;l.download=base(S.out[0].name).replace(/_pag.*$/,'')+'_arquivos.zip';document.body.appendChild(l);l.click();l.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000);
        });break;
    }
  });
  root.addEventListener('input',function(e){
    var k=e.target.dataset&&e.target.dataset.opt;if(!k)return;var el=e.target;
    S.opts[k]=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?'':+el.value):el.value;
    if(el.tagName==='SELECT'||el.type==='checkbox')renderOpts();
  });
  /* arrastar e soltar / colar */
  ['dragover','dragleave','drop'].forEach(function(ev){document.addEventListener(ev,function(e){
    if(!e.dataTransfer||[].indexOf.call(e.dataTransfer.types,'Files')<0)return;
    e.preventDefault();var dz=$('#dz');
    if(ev==='dragover'&&dz)dz.classList.add('over');
    if(ev==='dragleave'&&dz)dz.classList.remove('over');
    if(ev==='drop'){if(dz)dz.classList.remove('over');addFiles(e.dataTransfer.files)}
  })});
  document.addEventListener('paste',function(e){if(e.clipboardData&&e.clipboardData.files.length)addFiles(e.clipboardData.files)});
  renderFiles();renderOpts();renderRun();renderOut();
  idb.take().then(function(fs){if(fs.length)addFiles(fs)}).catch(function(){});
}

/* ---------- PWA ---------- */
function initPwa(){
  if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0)navigator.serviceWorker.register(ROOT+'sw.js').catch(function(){});
  var ev=null,btn=$('#install');
  G.addEventListener('beforeinstallprompt',function(e){e.preventDefault();ev=e;if(btn)btn.hidden=false});
  if(btn)btn.addEventListener('click',function(){if(ev){ev.prompt();ev=null;btn.hidden=true}});
}

document.addEventListener('click',function(e){
  if(e.target.id==='resetconsent'){e.preventDefault();try{localStorage.removeItem('bancada-consent')}catch(x){}location.reload()}
});
document.addEventListener('DOMContentLoaded',function(){
  var page=document.body.dataset.page;
  if(page==='home')initHome();
  var t=$('#tool');if(t)initTool(t);
  adsInit();initPwa();
});
})(window);

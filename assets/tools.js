/* Bancada PDF — núcleo das ferramentas.
   Roda no navegador e também no Node (para testes). Depende de G.BancadaLoad(nomes). */
(function(G){
"use strict";
const fmt=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB';
const base=n=>n.replace(/\.[^.]+$/,'');
const sleep=()=>new Promise(r=>setTimeout(r,0));
const PL=()=>G.PDFLib;
const load=(...n)=>G.BancadaLoad(n);
async function loadPdf(f){await load('pdflib');return PL().PDFDocument.load(await f.arrayBuffer(),{ignoreEncryption:true})}
const pdfBlob=b=>new Blob([b],{type:'application/pdf'});

function parseRanges(str,total){
  str=(str||'').trim();
  if(!str) throw new Error('Informe as páginas, por exemplo: 1-3, 5, 8-');
  const groups=[];
  for(const tok of str.split(/[,;]+/).map(s=>s.trim()).filter(Boolean)){
    const m=tok.includes('-')?tok.match(/^(\d+)?\s*-\s*(\d+)?$/):tok.match(/^(\d+)$/);
    if(!m) throw new Error('Trecho inválido: "'+tok+'"');
    let a,b;
    if(tok.includes('-')){a=m[1]?+m[1]:1;b=m[2]?+m[2]:total}else{a=b=+m[1]}
    if(a>b) throw new Error('Intervalo invertido: "'+tok+'"');
    if(a<1||b>total) throw new Error('A página '+(a<1?a:b)+' não existe (o PDF tem '+total+').');
    const g=[];for(let i=a;i<=b;i++)g.push(i-1);
    groups.push({a,b,idx:g});
  }
  return groups;
}
async function openPdfJs(f){await load('pdfjs');return G.pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise}
async function pdfRender(doc,i,scale,type,q){
  const page=await doc.getPage(i),vp=page.getViewport({scale});
  const c=document.createElement('canvas');
  c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
  const ctx=c.getContext('2d');
  if(type!=='png'){ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height)}
  await page.render({canvasContext:ctx,viewport:vp}).promise;
  const blob=await new Promise(r=>c.toBlob(r,type==='png'?'image/png':'image/jpeg',q));
  const w=vp.width/scale,h=vp.height/scale;
  page.cleanup();c.width=c.height=0;
  return {blob,w,h};
}
const hex=h=>PL().rgb(parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255);
async function toImg(file){
  const bmp=await createImageBitmap(file);
  const k=Math.min(1,2600/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
  const ctx=c.getContext('2d'),png=file.type==='image/png';
  if(!png){ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height)}
  ctx.drawImage(bmp,0,0,c.width,c.height);bmp.close();
  const blob=await new Promise(r=>c.toBlob(r,png?'image/png':'image/jpeg',.92));
  return {blob,png,w:c.width,h:c.height};
}

/* =====================================================================
   WORD -> PDF  (HTML do mammoth -> PDF com texto selecionável)
   ===================================================================== */
async function htmlToPdf(html,o){
  o=o||{};
  const {PDFDocument,StandardFonts,rgb}=PL();
  const progress=o.progress||(()=>{});
  const doc=await PDFDocument.create();
  const F={r:await doc.embedFont(StandardFonts.Helvetica),b:await doc.embedFont(StandardFonts.HelveticaBold),
           i:await doc.embedFont(StandardFonts.HelveticaOblique),bi:await doc.embedFont(StandardFonts.HelveticaBoldOblique)};
  const cs=new Set(F.r.getCharacterSet());
  const MAP={'\u2192':'->','\u2190':'<-','\u2265':'>=','\u2264':'<=','\u00a0':' ','\u200b':'','\u2011':'-','\u2212':'-','\t':'    ','\u2713':'v','\u2022':'\u2022'};
  const clean=s=>{let out='';for(const ch of s){if(MAP[ch]!==undefined)out+=MAP[ch];else if(cs.has(ch.codePointAt(0)))out+=ch;else if(/\s/.test(ch))out+=' ';else out+='?'}return out};
  const fontOf=st=>F[(st.b?'b':'')+(st.i?'i':'')||'r'];
  const PW=595.28,PH=841.89,M=o.margin||56.7,CW=PW-2*M;
  let page=null,y=0;
  const newPage=()=>{page=doc.addPage([PW,PH]);y=PH-M};
  const ensure=h=>{if(!page||y-h<M)newPage()};
  const BLACK=rgb(0,0,0),LINK=rgb(.05,.27,.75);

  const parser=new G.DOMParser();
  const dom=parser.parseFromString('<!doctype html><body>'+html+'</body>','text/html');
  const isEl=n=>n.nodeType===1,isTxt=n=>n.nodeType===3;
  const tag=n=>isEl(n)?n.tagName.toLowerCase():'';
  const BLOCKS=new Set(['p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','div','blockquote','pre','section','tr','td','th','thead','tbody']);

  /* --- itens inline --- */
  function inline(nodes,st,out){
    for(const n of nodes){
      if(isTxt(n)){
        const t=clean(n.nodeValue.replace(/\s+/g,' '));
        t.split(/( )/).forEach(w=>{if(w==='')return;out.push(w===' '?{t:'sp',text:' ',st}:{t:'w',text:w,st})});
      }else if(isEl(n)){
        const tg=tag(n);
        if(tg==='br'){out.push({t:'br'});continue}
        if(tg==='img'){out.push({t:'img',el:n});continue}
        if(BLOCKS.has(tg)&&tg!=='li'){ // bloco dentro de inline: quebra de linha
          if(out.length&&out[out.length-1].t!=='br')out.push({t:'br'});
          inline(n.childNodes,st,out);
          if(out.length&&out[out.length-1].t!=='br')out.push({t:'br'});
          continue;
        }
        const s2=Object.assign({},st);
        if(tg==='strong'||tg==='b')s2.b=true;
        if(tg==='em'||tg==='i')s2.i=true;
        if(tg==='u')s2.u=true;
        if(tg==='sup')s2.sup=true;
        if(tg==='sub')s2.sub=true;
        if(tg==='a'&&n.getAttribute('href')){s2.link=true;s2.u=true}
        inline(n.childNodes,s2,out);
      }
    }
    return out;
  }
  function breakLines(items,width){
    const lines=[];let cur={segs:[],w:0,size:0};
    const push=()=>{
      while(cur.segs.length&&cur.segs[cur.segs.length-1].sp)cur.w-=cur.segs.pop().w;
      lines.push(cur);cur={segs:[],w:0,size:0};
    };
    for(const it of items){
      if(it.t==='br'){push();continue}
      const size=it.st.size*((it.st.sup||it.st.sub)?.7:1),font=fontOf(it.st);
      const w=font.widthOfTextAtSize(it.text,size);
      if(it.t==='sp'){if(cur.segs.length){cur.segs.push({sp:true,text:' ',font,size,w,st:it.st});cur.w+=w}continue}
      if(cur.w+w>width&&cur.segs.length)push();
      if(w>width){ // palavra gigante: quebra por caracteres
        let chunk='';
        for(const ch of it.text){
          if(font.widthOfTextAtSize(chunk+ch,size)>width&&chunk){cur.segs.push({text:chunk,font,size,w:font.widthOfTextAtSize(chunk,size),st:it.st});cur.w+=font.widthOfTextAtSize(chunk,size);cur.size=Math.max(cur.size,it.st.size);push();chunk=''}
          chunk+=ch;
        }
        if(chunk){cur.segs.push({text:chunk,font,size,w:font.widthOfTextAtSize(chunk,size),st:it.st});cur.w+=font.widthOfTextAtSize(chunk,size);cur.size=Math.max(cur.size,it.st.size)}
        continue;
      }
      cur.segs.push({text:it.text,font,size,w,st:it.st});cur.w+=w;cur.size=Math.max(cur.size,it.st.size);
    }
    if(cur.segs.length)push();
    return lines.filter(l=>l.segs.length);
  }
  function drawSegs(line,x,baseline){
    let cx=x;
    for(const s of line.segs){
      if(!s.sp||s.st.u){
        const by=baseline+(s.st.sup?s.size*.55:s.st.sub?-s.size*.2:0);
        if(!s.sp)page.drawText(s.text,{x:cx,y:by,size:s.size,font:s.font,color:s.st.link?LINK:BLACK});
        if(s.st.u)page.drawLine({start:{x:cx,y:by-1.4},end:{x:cx+s.w,y:by-1.4},thickness:.6,color:s.st.link?LINK:BLACK});
      }
      cx+=s.w;
    }
  }
  const LH=1.3;
  function paragraph(items,x,w,opt){
    opt=opt||{};
    const lines=breakLines(items,w);
    lines.forEach((ln,i)=>{
      const lh=(ln.size||opt.size||11)*LH;
      ensure(lh+(i===0&&opt.keep?lh:0));
      y-=lh;
      const baseline=y+(ln.size||11)*.28;
      if(i===0&&opt.bullet)page.drawText(clean(opt.bullet),{x:opt.bx,y:baseline,size:opt.size||11,font:F[opt.bold?'b':'r'],color:BLACK});
      drawSegs(ln,x,baseline);
    });
    if(lines.length)y-=opt.after==null?5:opt.after;
  }

  /* --- imagens --- */
  async function image(el,x,w){
    const src=el.getAttribute('src')||'';
    const m=src.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if(!m)return;
    try{
      const bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));
      const img=/png/i.test(m[1])?await doc.embedPng(bytes):await doc.embedJpg(bytes);
      let iw=img.width*.75,ih=img.height*.75;
      const maxH=PH-2*M-10,k=Math.min(1,w/iw,maxH/ih);iw*=k;ih*=k;
      ensure(ih);y-=ih;
      page.drawImage(img,{x,y,width:iw,height:ih});y-=6;
    }catch(e){/* imagem inválida: ignora */}
  }
  async function flush(items,x,w,opt){
    // separa o inline em grupos por imagem
    let buf=[];
    for(const it of items){
      if(it.t==='img'){if(buf.length){paragraph(buf,x,w,opt);buf=[];opt=Object.assign({},opt,{bullet:null})}await image(it.el,x,w)}
      else buf.push(it);
    }
    if(buf.length)paragraph(buf,x,w,opt);
  }

  /* --- tabelas --- */
  async function table(el,x,w){
    const trs=[...el.querySelectorAll('tr')].filter(tr=>tr.closest('table')===el);
    if(!trs.length)return;
    const occ=[],cells=[];let ncols=0;
    trs.forEach((tr,r)=>{
      occ[r]=occ[r]||[];let c=0;
      [...tr.children].filter(n=>/^(td|th)$/.test(tag(n))).forEach(cell=>{
        while(occ[r][c])c++;
        const cspan=Math.max(1,+cell.getAttribute('colspan')||1),rspan=Math.max(1,+cell.getAttribute('rowspan')||1);
        for(let i=0;i<rspan;i++){occ[r+i]=occ[r+i]||[];for(let j=0;j<cspan;j++)occ[r+i][c+j]=true}
        cells.push({el:cell,r,c,cspan,rspan,th:tag(cell)==='th'});
        c+=cspan;ncols=Math.max(ncols,c);
      });
    });
    const weight=Array(ncols).fill(6);
    cells.forEach(ce=>{if(ce.cspan===1)weight[ce.c]=Math.max(weight[ce.c],Math.min(40,(ce.el.textContent||'').trim().length))});
    const sum=weight.reduce((a,b)=>a+b,0),colW=weight.map(v=>w*v/sum);
    const PAD=4,rowH=Array(trs.length).fill(0);
    for(const ce of cells){
      const cw=colW.slice(ce.c,ce.c+ce.cspan).reduce((a,b)=>a+b,0);
      const items=inline(ce.el.childNodes,{size:10,b:ce.th},[]).filter(i=>i.t!=='img');
      ce.cw=cw;ce.lines=breakLines(items,cw-2*PAD);
      ce.h=ce.lines.reduce((a,l)=>a+(l.size||10)*LH,0)+2*PAD;
      for(let i=0;i<ce.rspan;i++)rowH[ce.r+i]=Math.max(rowH[ce.r+i],ce.h/ce.rspan);
    }
    for(let r=0;r<trs.length;r++){
      const h=Math.max(rowH[r],16);
      ensure(h);
      const top=y;
      for(const ce of cells.filter(c=>c.r===r)){
        const cx=x+colW.slice(0,ce.c).reduce((a,b)=>a+b,0);
        let ch=0;for(let i=0;i<ce.rspan;i++)ch+=Math.max(rowH[r+i]||0,16);
        page.drawRectangle({x:cx,y:top-ch,width:ce.cw,height:ch,borderColor:rgb(.55,.55,.55),borderWidth:.5,color:ce.th?rgb(.93,.93,.93):undefined});
        let ty=top-PAD;
        for(const ln of ce.lines){const lh=(ln.size||10)*LH;ty-=lh;drawSegs(ln,cx+PAD,ty+(ln.size||10)*.28)}
      }
      y=top-h;
    }
    y-=8;
  }

  /* --- blocos --- */
  const HS={h1:[20,12],h2:[16,10],h3:[13.5,8],h4:[12,6],h5:[11,6],h6:[11,6]};
  async function list(el,level,x,w){
    const ordered=tag(el)==='ol';let n=0;
    for(const li of [...el.children].filter(c=>tag(c)==='li')){
      n++;
      const ind=18*(level+1),label=ordered?n+'.':(level%2?'\u2013':'\u2022');
      const inl=[...li.childNodes].filter(c=>!(isEl(c)&&/^(ul|ol)$/.test(tag(c))));
      await flush(inline(inl,{size:11},[]),x+ind,w-ind,{bullet:label,bx:x+ind-14,size:11,after:2});
      for(const sub of [...li.children].filter(c=>/^(ul|ol)$/.test(tag(c))))await list(sub,level+1,x,w);
    }
    y-=4;
  }
  async function block(n,x,w){
    if(isTxt(n)){if(n.nodeValue.trim())await flush(inline([n],{size:11},[]),x,w,{size:11});return}
    if(!isEl(n))return;
    const tg=tag(n);
    if(HS[tg]){
      y-=HS[tg][1]*.6;
      await flush(inline(n.childNodes,{size:HS[tg][0],b:true},[]),x,w,{size:HS[tg][0],after:HS[tg][1]*.5,keep:true,bold:true});
    }else if(tg==='ul'||tg==='ol')await list(n,0,x,w);
    else if(tg==='table')await table(n,x,w);
    else if(tg==='img')await image(n,x,w);
    else if(tg==='hr'){ensure(10);y-=5;page.drawLine({start:{x,y},end:{x:x+w,y},thickness:.5,color:rgb(.6,.6,.6)});y-=6}
    else if(tg==='div'||tg==='section'||tg==='blockquote'){
      const hasBlock=[...n.children].some(c=>BLOCKS.has(tag(c))||tag(c)==='img');
      if(hasBlock)for(const c of n.childNodes)await block(c,tg==='blockquote'?x+18:x,tg==='blockquote'?w-18:w);
      else await flush(inline(n.childNodes,{size:11},[]),x,w,{size:11});
    }else await flush(inline(n.childNodes,{size:11},[]),x,w,{size:11});
  }
  const kids=[...dom.body.childNodes];
  for(let i=0;i<kids.length;i++){await block(kids[i],M,CW);if(i%25===0){progress('Montando páginas',i/kids.length);await sleep()}}
  if(!page)throw new Error('Não encontrei conteúdo neste documento.');
  return doc.save();
}

async function wordToPdf(file,opts,progress){
  await load('pdflib','mammoth');
  progress('Lendo o documento',.1);
  const mm=G.mammoth;
  const res=await mm.convertToHtml({arrayBuffer:await file.arrayBuffer()},{
    styleMap:["p[style-name='Title'] => h1:fresh","p[style-name='Título'] => h1:fresh","p[style-name='Subtitle'] => h2:fresh","p[style-name='Subtítulo'] => h2:fresh","u => u"],
    convertImage:mm.images.imgElement(img=>img.read('base64').then(d=>({src:'data:'+img.contentType+';base64,'+d})))
  });
  if(!res.value.trim())throw new Error('Este documento parece estar vazio.');
  progress('Montando o PDF',.4);
  const bytes=await htmlToPdf(res.value,{margin:(+opts.margem)*72/25.4,progress:(m,f)=>progress(m,.4+f*.55)});
  return [{name:base(file.name)+'.pdf',blob:pdfBlob(bytes),note:'O texto continua selecionável. Cabeçalhos, rodapés e fontes especiais do Word não são reproduzidos.'}];
}

/* =====================================================================
   PDF -> WORD  (texto extraído pelo pdf.js -> .docx montado à mão)
   ===================================================================== */
const xesc=s=>String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function runXml(text,rpr){
  return text.split('\t').map((t,i)=>(i?'<w:r><w:tab/></w:r>':'')+(t?'<w:r>'+(rpr?'<w:rPr>'+rpr+'</w:rPr>':'')+'<w:t xml:space="preserve">'+xesc(t)+'</w:t></w:r>':'')).join('');
}
function paraXml(text,style,tabs){
  const pp=(style?'<w:pStyle w:val="'+style+'"/>':'')+(tabs&&tabs.length?'<w:tabs>'+tabs.map(t=>'<w:tab w:val="left" w:pos="'+t+'"/>').join('')+'</w:tabs>':'');
  return '<w:p>'+(pp?'<w:pPr>'+pp+'</w:pPr>':'')+runXml(text,'')+'</w:p>';
}
function imageXml(rid,n,wEmu,hEmu){
  return '<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+wEmu+'" cy="'+hEmu+'"/><wp:docPr id="'+n+'" name="Página '+n+'"/>'+
  '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'+
  '<pic:nvPicPr><pic:cNvPr id="'+n+'" name="pagina'+n+'.jpeg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+rid+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'+
  '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+wEmu+'" cy="'+hEmu+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}
function pageParagraphs(items){
  // 1) agrupa itens em linhas
  const its=items.filter(it=>it.transform&&typeof it.str==='string').map(it=>({s:it.str,x:it.transform[4],y:it.transform[5],h:Math.abs(it.transform[3])||it.height||10,w:it.width||0}));
  its.sort((a,b)=>b.y-a.y||a.x-b.x);
  const lines=[];
  for(const it of its){
    const ln=lines.find(l=>Math.abs(l.y-it.y)<=Math.max(2,Math.min(l.size,it.h)*.45));
    if(ln){ln.items.push(it);ln.size=Math.max(ln.size,it.h)}else lines.push({y:it.y,size:it.h,items:[it]});
  }
  lines.sort((a,b)=>b.y-a.y);
  for(const ln of lines){
    ln.items.sort((a,b)=>a.x-b.x);
    let t='',prev=null;ln.tabs=[];
    for(const it of ln.items){
      let str=it.s;
      if((str===''&&it.w>.5&&!prev)||/^[\uf000-\uf0ff]$/.test(str))str='\u2022'; /* marcador de lista em fonte de símbolos */
      if(str.trim()===''){
        if(it.w>ln.size*2&&prev){t+='\t';ln.pend=true}else if(it.w>0&&!/\s$/.test(t))t+=' ';
        prev=it;continue;
      }
      if(prev){
        const gap=it.x-(prev.x+prev.w);
        if(gap>ln.size*2.5){t+='\t';ln.pend=true}
        else if(gap>ln.size*.12&&!/\s$/.test(t))t+=' ';
      }
      if(ln.pend){ln.tabs.push(it.x);ln.pend=false}
      t+=str;prev=it;
    }
    ln.text=t.replace(/[ ]{2,}/g,' ').replace(/\s+$/,'').replace(/^ +/,'');
    ln.x0=Math.min(...ln.items.map(i=>i.x));
  }
  const ls=lines.filter(l=>l.text.trim());
  if(!ls.length)return {xml:[],chars:0};
  // 2) tamanho do corpo = moda ponderada pelo número de caracteres
  const hist={};ls.forEach(l=>{const k=Math.round(l.size*2)/2;hist[k]=(hist[k]||0)+l.text.length});
  const body=+Object.keys(hist).sort((a,b)=>hist[b]-hist[a])[0];
  ls.forEach(l=>{l.head=l.size>=body*1.2&&l.text.length<=140?(l.size>=body*1.6?1:2):0});
  // 3) passo típico entre linhas (mediana) e junção em parágrafos
  const steps=[];for(let i=1;i<ls.length;i++){if(Math.abs(ls[i].size-ls[i-1].size)<1)steps.push(ls[i-1].y-ls[i].y)}
  steps.sort((a,b)=>a-b);const step=steps.length?steps[Math.floor(steps.length/2)]:body*1.3;
  const paras=[];let cur=null;
  for(const l of ls){
    const marker=/^([•·▪◦\-–—]|\d{1,3}[.)])\s/.test(l.text);
    const start=!cur||l.head||cur.head||marker||(cur.y-l.y)>Math.max(step*1.3,l.size*1.45)||(l.x0-cur.x0)>l.size*.9||l.text.includes('\t')||cur.text.includes('\t');
    if(start){cur={text:l.text,head:l.head,y:l.y,x0:l.x0,tabs:l.tabs};paras.push(cur)}
    else{
      if(/[a-zà-ú]-$/.test(cur.text)&&/^[a-zà-ú]/.test(l.text))cur.text=cur.text.slice(0,-1)+l.text;
      else cur.text+=' '+l.text;
      cur.y=l.y;
    }
  }
  const minX=Math.min(...ls.map(l=>l.x0));
  return {xml:paras.map(p=>paraXml(p.text,p.head===1?'Heading1':p.head===2?'Heading2':'',(p.tabs||[]).map(x=>Math.round((x-minX)*20)))),chars:ls.reduce((n,l)=>n+l.text.length,0)};
}
const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
async function buildDocx(bodyXml,media){
  const z=new G.JSZip(),H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  z.file('[Content_Types].xml',H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  z.file('_rels/.rels',H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file('word/_rels/document.xml.rels',H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    media.map(m=>'<Relationship Id="'+m.rid+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/'+m.name+'"/>').join('')+'</Relationships>');
  z.file('word/styles.xml',H+'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'+
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>');
  z.file('word/document.xml',H+'<w:document '+NS+'><w:body>'+bodyXml+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>');
  media.forEach(m=>z.file('word/media/'+m.name,m.bytes));
  return z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
}
async function pdfToWord(file,opts,progress){
  await load('pdfjs','jszip');
  const doc=await openPdfJs(file),parts=[],media=[];
  let scanned=0,paras=0;
  for(let i=1;i<=doc.numPages;i++){
    progress('Página '+i+' de '+doc.numPages,(i-1)/doc.numPages);
    const page=await doc.getPage(i),tc=await page.getTextContent();
    const r=pageParagraphs(tc.items);
    if(r.chars<15){
      scanned++;
      const im=await pdfRender(doc,i,1.6,'jpg',.82),rid='rIdImg'+i,cw=6.69*914400;
      media.push({rid,name:'pagina'+i+'.jpeg',bytes:new Uint8Array(await im.blob.arrayBuffer())});
      parts.push(imageXml(rid,i,Math.round(cw),Math.round(cw*im.h/im.w)));
    }else{parts.push(...r.xml);paras+=r.xml.length}
    if(i<doc.numPages)parts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    await sleep();
  }
  const blob=await buildDocx(parts.join(''),media);
  const note=paras+' parágrafo(s) de texto editável'+(scanned?'; '+scanned+' página(s) sem texto (digitalizadas) entraram como imagem.':'.');
  return [{name:base(file.name)+'.docx',blob,note}];
}

/* =====================================================================
   DEFINIÇÕES DAS FERRAMENTAS
   ===================================================================== */
const TOOLS=[
{id:'juntar',slug:'juntar-pdf',name:'Juntar PDF',desc:'Una vários PDFs em um só, na ordem que quiser.',cat:'Organizar',color:'--c-org',icon:'merge',accept:'pdf',multiple:true,
 hint:'Adicione dois ou mais PDFs e reordene com as setas.',fields:[],
 async run({files,progress}){
  if(files.length<2)throw new Error('Adicione pelo menos 2 PDFs.');
  const out=await PL().PDFDocument.create();
  for(let i=0;i<files.length;i++){
    progress('Lendo '+files[i].name,i/files.length);
    const src=await loadPdf(files[i]);
    (await out.copyPages(src,src.getPageIndices())).forEach(p=>out.addPage(p));
  }
  progress('Gerando arquivo',.95);
  return [{name:'juntado.pdf',blob:pdfBlob(await out.save())}];
 }},
{id:'dividir',slug:'dividir-pdf',name:'Dividir PDF',desc:'Separe por intervalos ou transforme cada página em um arquivo.',cat:'Organizar',color:'--c-org',icon:'split',accept:'pdf',multiple:false,
 fields:[
  {k:'modo',label:'Como dividir',type:'select',options:[['extrair','Extrair páginas em um único PDF'],['intervalos','Um PDF para cada intervalo'],['cada','Cada página em um PDF']],def:'extrair'},
  {k:'paginas',label:'Páginas (ex.: 1-3, 5, 8-)',type:'text',def:'1-3',when:o=>o.modo!=='cada'}],
 async run({files,opts,progress}){
  const src=await loadPdf(files[0]),total=src.getPageCount(),nm=base(files[0].name),outs=[];
  const mk=async idx=>{const d=await PL().PDFDocument.create();(await d.copyPages(src,idx)).forEach(p=>d.addPage(p));return pdfBlob(await d.save())};
  if(opts.modo==='cada'){
    for(let i=0;i<total;i++){progress('Página '+(i+1)+' de '+total,i/total);outs.push({name:nm+'_pag'+(i+1)+'.pdf',blob:await mk([i])});await sleep()}
  }else{
    const gs=parseRanges(opts.paginas,total);
    if(opts.modo==='extrair')outs.push({name:nm+'_extraido.pdf',blob:await mk(gs.flatMap(g=>g.idx))});
    else for(const g of gs){progress('Intervalo '+g.a+'-'+g.b,outs.length/gs.length);outs.push({name:nm+'_pag'+g.a+'-'+g.b+'.pdf',blob:await mk(g.idx)})}
  }
  return outs;
 }},
{id:'remover',slug:'remover-paginas-pdf',name:'Remover páginas',desc:'Apague as páginas que você não quer manter.',cat:'Organizar',color:'--c-org',icon:'trash',accept:'pdf',multiple:false,
 fields:[{k:'paginas',label:'Páginas a remover (ex.: 2, 4-6)',type:'text',def:''}],
 async run({files,opts,progress}){
  const src=await loadPdf(files[0]),total=src.getPageCount();
  const del=new Set(parseRanges(opts.paginas,total).flatMap(g=>g.idx));
  const keep=src.getPageIndices().filter(i=>!del.has(i));
  if(!keep.length)throw new Error('Isso removeria todas as páginas.');
  progress('Montando PDF',.5);
  const d=await PL().PDFDocument.create();(await d.copyPages(src,keep)).forEach(p=>d.addPage(p));
  return [{name:base(files[0].name)+'_editado.pdf',blob:pdfBlob(await d.save()),note:del.size+' página(s) removida(s); restam '+keep.length+'.'}];
 }},
{id:'organizar',slug:'organizar-pdf',name:'Organizar páginas',desc:'Veja as miniaturas, reordene, gire e exclua páginas.',cat:'Organizar',color:'--c-org',icon:'grid',accept:'pdf',multiple:false,custom:true,fields:[],
 async run({T,files,progress}){
  if(!T.pages||!T.pages.length)throw new Error('Nenhuma página para salvar.');
  const {PDFDocument,degrees}=PL(),src=await loadPdf(files[0]),d=await PDFDocument.create();
  for(let i=0;i<T.pages.length;i++){
    const p=T.pages[i],[pg]=await d.copyPages(src,[p.n]);
    if(p.rot)pg.setRotation(degrees((pg.getRotation().angle+p.rot)%360));
    d.addPage(pg);progress('Montando PDF',i/T.pages.length);
  }
  return [{name:base(files[0].name)+'_organizado.pdf',blob:pdfBlob(await d.save())}];
 }},
{id:'girar',slug:'girar-pdf',name:'Girar PDF',desc:'Gire todas as páginas ou só algumas.',cat:'Editar',color:'--c-edit',icon:'rotate',accept:'pdf',multiple:false,
 fields:[
  {k:'angulo',label:'Girar',type:'select',options:[['90','90° para a direita'],['180','180°'],['270','90° para a esquerda']],def:'90'},
  {k:'escopo',label:'Aplicar em',type:'select',options:[['todas','Todas as páginas'],['sel','Páginas escolhidas']],def:'todas'},
  {k:'paginas',label:'Páginas (ex.: 1, 3-5)',type:'text',def:'',when:o=>o.escopo==='sel'}],
 async run({files,opts,progress}){
  const d=await loadPdf(files[0]),pages=d.getPages(),{degrees}=PL();
  const idx=opts.escopo==='sel'?parseRanges(opts.paginas,pages.length).flatMap(g=>g.idx):pages.map((_,i)=>i);
  idx.forEach(i=>pages[i].setRotation(degrees((pages[i].getRotation().angle+ +opts.angulo)%360)));
  progress('Salvando',.8);
  return [{name:base(files[0].name)+'_girado.pdf',blob:pdfBlob(await d.save())}];
 }},
{id:'marca',slug:'marca-dagua-pdf',name:'Marca d’água',desc:'Carimbe um texto sobre todas as páginas.',cat:'Editar',color:'--c-edit',icon:'drop',accept:'pdf',multiple:false,
 fields:[
  {k:'texto',label:'Texto',type:'text',def:'CONFIDENCIAL'},
  {k:'tam',label:'Tamanho',type:'select',options:[['0.08','Pequeno'],['0.13','Médio'],['0.2','Grande']],def:'0.13'},
  {k:'ang',label:'Direção',type:'select',options:[['45','Diagonal'],['0','Horizontal'],['90','Vertical']],def:'45'},
  {k:'op',label:'Opacidade (%)',type:'number',min:5,max:100,step:5,def:25},
  {k:'cor',label:'Cor',type:'color',def:'#C62F3E'},
  {k:'rep',label:'Repetir em mosaico',type:'check',def:false}],
 async run({files,opts,progress}){
  if(!String(opts.texto).trim())throw new Error('Digite o texto da marca d’água.');
  const {StandardFonts,degrees}=PL(),d=await loadPdf(files[0]),font=await d.embedFont(StandardFonts.HelveticaBold),pages=d.getPages();
  const th=opts.ang*Math.PI/180,col=hex(opts.cor),opacity=Math.min(1,Math.max(.05,opts.op/100));
  try{
    pages.forEach((pg,n)=>{
      const {width:W,height:H}=pg.getSize();
      const size=Math.max(10,Math.min(W,H)*opts.tam),w=font.widthOfTextAtSize(opts.texto,size),h=size*.7;
      const put=(cx,cy)=>pg.drawText(opts.texto,{x:cx-(w/2)*Math.cos(th)+(h/2)*Math.sin(th),y:cy-(w/2)*Math.sin(th)-(h/2)*Math.cos(th),size,font,color:col,opacity,rotate:degrees(+opts.ang)});
      if(opts.rep){const sx=w*1.5,sy=Math.max(size*3,h*3);for(let yy=sy/2;yy<H+sy;yy+=sy)for(let xx=sx/2;xx<W+sx;xx+=sx)put(xx,yy)}
      else put(W/2,H/2);
      progress('Página '+(n+1)+' de '+pages.length,n/pages.length);
    });
  }catch(e){throw new Error('O texto tem caracteres não suportados. Use letras, números e acentos comuns.')}
  return [{name:base(files[0].name)+'_marca.pdf',blob:pdfBlob(await d.save())}];
 }},
{id:'numeros',slug:'numerar-paginas-pdf',name:'Números de página',desc:'Numere as páginas com posição e formato à sua escolha.',cat:'Editar',color:'--c-edit',icon:'hash',accept:'pdf',multiple:false,
 fields:[
  {k:'pos',label:'Posição',type:'select',options:[['bc','Embaixo, centro'],['bd','Embaixo, direita'],['be','Embaixo, esquerda'],['tc','Em cima, centro'],['td','Em cima, direita'],['te','Em cima, esquerda']],def:'bc'},
  {k:'fmt',label:'Formato',type:'select',options:[['{n}','1'],['Página {n} de {t}','Página 1 de 10'],['{n}/{t}','1/10'],['— {n} —','— 1 —']],def:'Página {n} de {t}'},
  {k:'ini',label:'Começar em',type:'number',min:0,max:9999,step:1,def:1},
  {k:'tam',label:'Tamanho da fonte',type:'number',min:7,max:24,step:1,def:11},
  {k:'pular',label:'Não numerar a primeira página',type:'check',def:false}],
 async run({files,opts,progress}){
  const {StandardFonts,rgb}=PL(),d=await loadPdf(files[0]),font=await d.embedFont(StandardFonts.Helvetica),pages=d.getPages(),t=pages.length;
  pages.forEach((pg,i)=>{
    if(opts.pular&&i===0)return;
    const txt=opts.fmt.replace('{n}',(+opts.ini)+i).replace('{t}',(+opts.ini)+t-1);
    const {width:W,height:H}=pg.getSize(),w=font.widthOfTextAtSize(txt,opts.tam),m=30;
    const x=opts.pos[1]==='c'?(W-w)/2:opts.pos[1]==='d'?W-m-w:m;
    const y=opts.pos[0]==='b'?m-6:H-m-opts.tam+6;
    pg.drawText(txt,{x,y,size:+opts.tam,font,color:rgb(.2,.2,.2)});
    progress('Página '+(i+1)+' de '+t,i/t);
  });
  return [{name:base(files[0].name)+'_numerado.pdf',blob:pdfBlob(await d.save())}];
 }},
{id:'comprimir',slug:'comprimir-pdf',name:'Comprimir PDF',desc:'Reduza o tamanho de PDFs pesados, como digitalizações.',cat:'Otimizar',color:'--c-opt',icon:'compress',accept:'pdf',multiple:false,
 hint:'Cada página é redesenhada como imagem. O arquivo diminui, mas o texto deixa de ser selecionável.',
 fields:[{k:'nivel',label:'Nível',type:'select',options:[['leve','Leve — melhor qualidade'],['medio','Recomendado'],['forte','Forte — menor arquivo']],def:'medio'}],
 async run({files,opts,progress}){
  await load('pdflib');
  const cfg={leve:[2,.8],medio:[1.6,.65],forte:[1.2,.5]}[opts.nivel];
  const doc=await openPdfJs(files[0]),out=await PL().PDFDocument.create();
  for(let i=1;i<=doc.numPages;i++){
    progress('Página '+i+' de '+doc.numPages,(i-1)/doc.numPages);
    const r=await pdfRender(doc,i,cfg[0],'jpg',cfg[1]);
    const img=await out.embedJpg(await r.blob.arrayBuffer());
    out.addPage([r.w,r.h]).drawImage(img,{x:0,y:0,width:r.w,height:r.h});
    await sleep();
  }
  const blob=pdfBlob(await out.save()),a=files[0].size,b=blob.size;
  const note=b<a?'De '+fmt(a)+' para '+fmt(b)+' (−'+Math.round((1-b/a)*100)+'%).':'O resultado ('+fmt(b)+') ficou maior que o original ('+fmt(a)+'): o arquivo já estava bem otimizado.';
  return [{name:base(files[0].name)+'_comprimido.pdf',blob,note}];
 }},
{id:'imgpdf',slug:'imagem-para-pdf',name:'Imagens para PDF',desc:'Transforme fotos JPG, PNG ou WebP em um único PDF.',cat:'Converter',color:'--c-conv',icon:'img',accept:'img',multiple:true,
 hint:'Cada imagem vira uma página. Reordene com as setas.',
 fields:[
  {k:'tamanho',label:'Tamanho da página',type:'select',options:[['a4','A4 (ajusta a imagem)'],['imagem','Igual ao da imagem']],def:'a4'},
  {k:'margem',label:'Margem',type:'select',options:[['0','Sem margem'],['24','Pequena'],['48','Média']],def:'24'}],
 async run({files,opts,progress}){
  await load('pdflib');
  const out=await PL().PDFDocument.create(),m=+opts.margem;
  for(let i=0;i<files.length;i++){
    progress('Imagem '+(i+1)+' de '+files.length,i/files.length);
    const im=await toImg(files[i]);
    const img=im.png?await out.embedPng(await im.blob.arrayBuffer()):await out.embedJpg(await im.blob.arrayBuffer());
    let pw,ph;
    if(opts.tamanho==='imagem'){pw=im.w+2*m;ph=im.h+2*m}else{[pw,ph]=im.w>im.h?[841.89,595.28]:[595.28,841.89]}
    const s=Math.min((pw-2*m)/im.w,(ph-2*m)/im.h),dw=im.w*s,dh=im.h*s;
    out.addPage([pw,ph]).drawImage(img,{x:(pw-dw)/2,y:(ph-dh)/2,width:dw,height:dh});
    await sleep();
  }
  return [{name:'imagens.pdf',blob:pdfBlob(await out.save())}];
 }},
{id:'pdfimg',slug:'pdf-para-imagem',name:'PDF para imagens',desc:'Converta cada página do PDF em JPG ou PNG.',cat:'Converter',color:'--c-conv',icon:'img',accept:'pdf',multiple:false,
 fields:[
  {k:'formato',label:'Formato',type:'select',options:[['jpg','JPG'],['png','PNG']],def:'jpg'},
  {k:'res',label:'Resolução',type:'select',options:[['1.4','Leve (100 dpi)'],['2','Padrão (144 dpi)'],['3','Alta (216 dpi)']],def:'2'}],
 async run({files,opts,progress}){
  const doc=await openPdfJs(files[0]),outs=[],nm=base(files[0].name);
  for(let i=1;i<=doc.numPages;i++){
    progress('Página '+i+' de '+doc.numPages,(i-1)/doc.numPages);
    const r=await pdfRender(doc,i,+opts.res,opts.formato,.92);
    outs.push({name:nm+'_pag'+i+'.'+opts.formato,blob:r.blob});await sleep();
  }
  return outs;
 }},
{id:'word2pdf',slug:'word-para-pdf',name:'Word para PDF',desc:'Converta documentos .docx em PDF com texto selecionável.',cat:'Converter',color:'--c-conv',icon:'doc',accept:'docx',multiple:false,
 hint:'Aceita arquivos .docx. O texto, títulos, listas, tabelas e imagens são mantidos.',
 fields:[{k:'margem',label:'Margens da página',type:'select',options:[['15','Estreitas (15 mm)'],['20','Normais (20 mm)'],['25','Largas (25 mm)']],def:'20'}],
 async run({files,opts,progress}){return wordToPdf(files[0],opts,progress)}},
{id:'pdf2word',slug:'pdf-para-word',name:'PDF para Word',desc:'Extraia o texto do PDF para um documento Word editável.',cat:'Converter',color:'--c-conv',icon:'doc',accept:'pdf',multiple:false,
 hint:'Funciona melhor em PDFs de texto. Páginas digitalizadas entram como imagem, sem OCR.',
 fields:[],
 async run({files,opts,progress}){return pdfToWord(files[0],opts,progress)}}
];
G.BancadaTools={TOOLS,parseRanges,pageParagraphs,buildDocx,htmlToPdf,fmt,base};
if(typeof module!=='undefined'&&module.exports)module.exports=G.BancadaTools;
})(typeof globalThis!=='undefined'?globalThis:window);

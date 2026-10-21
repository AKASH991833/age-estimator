/* AgeLens - tiny_face_detector + landmarks + age/gender net, all local. */
(()=>{
const q=s=>document.querySelector(s);
const stage=q('#stage');
const GCOL={male:'#2563eb',female:'#db2777'};
let stream=null,video=null,canvas=null,ctx=null,img=null,running=false,lastT=0,fps=0;
let detOpts=null;
async function loadModels(){
  q('#st-model').textContent='loading...';
  await faceapi.nets.tinyFaceDetector.loadFromUri('./weights');
  await faceapi.nets.faceLandmark68Net.loadFromUri('./weights');
  await faceapi.nets.ageGenderNet.loadFromUri('./weights');
  detOpts=new faceapi.TinyFaceDetectorOptions({inputSize:416,scoreThreshold:0.4});
  q('#st-model').textContent='3 nets ready';
}
function setStage(node){
  stage.innerHTML='';
  canvas=document.createElement('canvas');canvas.className='overlay';
  stage.append(node,canvas);ctx=canvas.getContext('2d');
}
function fitOverlay(w,h){canvas.width=w;canvas.height=h;}
async function detectLoop(){
  if(!running)return;
  const src=video||img;
  if(src&&(video?video.readyState>=2:true)){
    const w=video?video.videoWidth:img.naturalWidth,h=video?video.videoHeight:img.naturalHeight;
    if(canvas.width!==w)fitOverlay(w,h);
    const t0=performance.now();
    const dets=await faceapi.detectAllFaces(src,detOpts).withFaceLandmarks().withAgeAndGender();
    const ms=performance.now()-t0;
    const now=performance.now();
    if(lastT){fps=fps*0.85+1000/(now-lastT)*0.15;}
    lastT=now;
    ctx.clearRect(0,0,w,h);
    drawDets(dets,w,h);
    q('#st-faces').textContent=dets.length;
    q('#st-ms').textContent=Math.round(ms);
    q('#st-fps').textContent=video?fps.toFixed(0):'still';
    if(dets.length){
      const ages=dets.map(d=>d.age);
      q('#st-avg').textContent=Math.round(ages.reduce((a,b)=>a+b,0)/ages.length);
      q('#st-range').textContent=Math.round(Math.min(...ages))+'-'+Math.round(Math.max(...ages));
    }else{q('#st-avg').textContent='-';q('#st-range').textContent='-';}
    renderFaces(dets,src,w,h);
    renderHist(dets);
  }
  if(video)setTimeout(()=>requestAnimationFrame(detectLoop),140);
}
function drawDets(dets,w,h){
  ctx.lineWidth=Math.max(2,w/480);
  dets.forEach(d=>{
    const b=d.detection.box;
    const col=GCOL[d.gender]||'#0d9488';
    if(q('#tBox').checked){
      const r=Math.min(12,b.width/6);
      ctx.strokeStyle=col;
      ctx.beginPath();
      [[b.x,b.y,1,1],[b.x+b.width,b.y,-1,1],[b.x,b.y+b.height,1,-1],[b.x+b.width,b.y+b.height,-1,-1]].forEach(([x,y,dx,dy])=>{
        ctx.moveTo(x+dx*r,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*r);});
      ctx.stroke();
      const label=`~${Math.round(d.age)} · ${d.gender} ${(d.genderProbability*100).toFixed(0)}%`;
      ctx.font=`bold ${Math.max(13,w/46)}px system-ui`;
      const tw=ctx.measureText(label).width+14;
      ctx.fillStyle=col+'e0';
      ctx.fillRect(b.x,Math.max(0,b.y-Math.max(20,w/34)),tw,Math.max(20,w/34));
      ctx.fillStyle='#fff';
      ctx.fillText(label,b.x+7,Math.max(0,b.y-Math.max(6,w/110)));
    }
    if(q('#tLand').checked&&d.landmarks){
      ctx.fillStyle='#22d3ee';
      d.landmarks.positions.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1.3,w/340),0,7);ctx.fill();});
    }
  });
}
function cropFace(src,b){
  const c=document.createElement('canvas');
  const pad=Math.round(b.width*0.18);
  const x=Math.max(0,b.x-pad),y=Math.max(0,b.y-pad);
  const ww=Math.min((src.videoWidth||src.naturalWidth)-x,b.width+2*pad);
  const hh=Math.min((src.videoHeight||src.naturalHeight)-y,b.height+2*pad);
  c.width=52;c.height=52;
  c.getContext('2d').drawImage(src,x,y,ww,hh,0,0,52,52);
  return c.toDataURL('image/jpeg',0.7);
}
function renderFaces(dets,src,w,h){
  const el=q('#faces');
  if(!dets.length){el.innerHTML='<p style="font-size:13.5px;color:var(--muted)">No faces in view.</p>';return;}
  el.innerHTML='';
  dets.forEach((d,i)=>{
    const gp=d.genderProbability*100;
    const row=document.createElement('div');row.className='frow';
    row.innerHTML=`<img class="av" alt="face ${i+1}">
      <div class="meta"><b style="color:${GCOL[d.gender]}">${d.gender} <span style="color:var(--muted);font-weight:600">${gp.toFixed(0)}%</span></b>
      <span>detection ${(d.detection.score*100).toFixed(1)}% · face ${i+1}</span>
      <div class="gbar"><i style="width:${d.gender==='male'?gp:100-gp}%;background:${GCOL.male}"></i><i style="width:${d.gender==='female'?gp:100-gp}%;background:${GCOL.female}"></i></div>
      </div>
      <div class="age-big">~${Math.round(d.age)}<small>est. age</small></div>`;
    row.querySelector('.av').src=cropFace(src,d.detection.box);
    el.appendChild(row);
  });
}
const BUCKETS=[['0-12',0,12],['13-19',13,19],['20-29',20,29],['30-39',30,39],['40-49',40,49],['50-59',50,59],['60+',60,200]];
function renderHist(dets){
  const el=q('#hist');
  if(!dets.length){el.innerHTML='<p style="font-size:13.5px;color:var(--muted)">No faces yet.</p>';return;}
  const counts=BUCKETS.map(([l,lo,hi])=>[l,dets.filter(d=>d.age>=lo&&d.age<=hi).length]);
  const max=Math.max(1,...counts.map(c=>c[1]));
  el.innerHTML=counts.map(([l,n])=>`<div class="hrow"><span>${l}</span><div class="tr"><div class="fl" style="width:${(n/max*100).toFixed(0)}%"></div></div><span class="n">${n}</span></div>`).join('');
}
async function useVideo(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960}},audio:false});
  }catch(e){toast('Camera blocked - allow permission or upload a photo');return;}
  video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
  await video.play();
  img=null;setStage(video);running=true;detectLoop();
  q('#camBtn').textContent='Stop webcam';
}
function stopVideo(){
  if(stream)stream.getTracks().forEach(t=>t.stop());
  stream=null;video=null;running=false;
  q('#camBtn').textContent='Start webcam';
}
function useImage(src){
  stopVideo();
  img=new Image();
  img.onload=()=>{setStage(img);running=true;detectLoop();};
  img.src=src;
}
q('#camBtn').onclick=()=>video?stopVideo():useVideo();
q('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>useImage(r.result);r.readAsDataURL(f);};
q('#sample1').onclick=()=>useImage('sample-lena.jpg');
q('#sample2').onclick=()=>useImage('sample-two.jpg');
q('#sample3').onclick=()=>useImage('sample-group.jpg');
function toast(msg){const t=document.createElement('div');t.className='toast show';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200);}
loadModels().then(()=>{useImage('sample-lena.jpg');}).catch(e=>{q('#st-model').textContent='load error';toast('Model failed to load - check connection');});
})();

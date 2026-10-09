import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getDatabase,ref,get,set,onValue,onChildAdded,remove,onDisconnect,runTransaction} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
const $=id=>document.getElementById(id),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,uid,room,queue=[],current=null,volume=70,yt=null,ytReady=false,unlocked=false,playing=false,chain=Promise.resolve(),skipT;
const say=s=>$('status').textContent=s,hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
function show(poster){$('poster').style.display=poster?'grid':'none';const v=$('yt');if(v)v.style.visibility=poster?'hidden':'visible'}
function render(){$('now').textContent=current?.title||'ยังไม่มีเพลง';$('queue').innerHTML=queue.length?queue.map((s,i)=>`<div class="q"><small>${i+1}</small><span>${esc(s.title)}</span></div>`).join(''):'ยังไม่มีเพลงในคิว'}
async function sync(){if(!db||!room)return;try{await set(ref(db,`rooms/${room}/state`),{queue:JSON.stringify(queue),current:JSON.stringify(current),volume,playing,version:Date.now(),updatedAt:Date.now()})}catch(e){$('conn').textContent='ซิงก์ไม่ได้: '+e.message;say('บันทึกคิวไม่สำเร็จ: '+e.message)}}
function makePlayer(){if(yt||!window.YT?.Player)return;yt=new YT.Player('yt',{width:'100%',height:'100%',playerVars:{playsinline:1,rel:0,autoplay:1,origin:location.origin},events:{
 onReady:()=>{ytReady=true;yt.setVolume(volume);say('พร้อมรับเพลงจากมือถือ');if(current&&unlocked)play()},
 onStateChange:e=>{if(e.data===0)next();if(e.data===1){playing=true;sync();clearTimeout(skipT);show(false);say('▶ กำลังเล่น');const t=yt.getVideoData?.().title;if(current&&t&&/^YouTube /.test(current.title)){current.title=t;render();sync()}}},
 onError:e=>{playing=false;sync();say(`เพลงนี้ฝังเล่นไม่ได้ (รหัส ${e.data}) · ข้ามไปเพลงถัดไปใน 3 วินาที`);clearTimeout(skipT);skipT=setTimeout(next,3000)}}})}
function play(){if(!current)return;show(false);if(!ytReady)return say('กำลังโหลดเครื่องเล่น YouTube…');yt.loadVideoById(current.id);yt.setVolume(volume);say('กำลังเปิดเพลง…')}
async function next(){clearTimeout(skipT);playing=false;current=queue.shift()||null;render();await sync();if(current)play();else{try{yt?.stopVideo()}catch{}show(true);say('จบคิวแล้ว · เพิ่มเพลงจากมือถือได้เลย')}}
function toggle(){if(!ytReady)return;try{if(yt.getPlayerState()===1){yt.pauseVideo();playing=false}else{yt.playVideo();playing=true}sync()}catch{}}
async function receive(c){const p=c.payload||{};switch(c.cmd){
 case'add':{const s=p.song;if(s&&/^[\w-]{11}$/.test(s.id||'')&&queue.length<100){queue.push({id:s.id,title:String(s.title||'YouTube '+s.id).slice(0,180),artist:String(s.artist||'').slice(0,100)});render();await sync();if(!current&&unlocked)await next()}break}
 case'play':if(current)play();else await next();break;
 case'next':await next();break;case'toggle':toggle();break;
 case'volume':volume=Math.max(0,Math.min(100,Number(p.value)||0));if(ytReady)yt.setVolume(volume);await sync();break;
 case'remove':if(Number.isInteger(p.index)&&queue[p.index]){queue.splice(p.index,1);render();await sync()}break;
 case'up':if(Number.isInteger(p.index)&&p.index>0&&queue[p.index]){[queue[p.index-1],queue[p.index]]=[queue[p.index],queue[p.index-1]];render();await sync()}break}}
async function claim(){
 const saved=localStorage.getItem('hopf_v3_room');
 for(let i=0;i<5;i++){
  const candidate=i===0&&/^[a-f0-9]{32}$/.test(saved||'')?saved:hex();
  const ownerRef=ref(db,`rooms/${candidate}/ownerUid`);
  const existing=await get(ownerRef);
  if(existing.exists()&&existing.val()!==uid)continue;
  if(!existing.exists()){
   try{const result=await runTransaction(ownerRef,v=>v===null?uid:undefined,{applyLocally:false});if(!result.committed&&result.snapshot.val()!==uid)continue}
   catch(e){if(e.code==='PERMISSION_DENIED'||/permission_denied/i.test(e.message||''))continue;throw e}
  }
  room=candidate;localStorage.setItem('hopf_v3_room',room);return;
 }
 throw Error('ไม่สามารถสร้างห้องใหม่ได้ ตรวจ Firebase Rules ของ ownerUid');
}
async function boot(){try{const app=initializeApp(window.HOPF_FIREBASE_CONFIG);db=getDatabase(app);const a=getAuth(app);await signInAnonymously(a);uid=a.currentUser.uid;await claim();
 $('room').textContent=room.slice(0,8).toUpperCase();const url=new URL('index.html',location.href);url.searchParams.set('room',room);$('link').href=url.href;$('qr').innerHTML='';
 if(window.QRCode)new QRCode($('qr'),{text:url.href,width:170,height:170,correctLevel:QRCode.CorrectLevel.M});else $('qr').innerHTML=`<a href="${url.href}" style="color:#14224a;overflow-wrap:anywhere;max-width:180px">เปิดรีโมต (QR โหลดไม่ได้)</a>`;
 await set(ref(db,`rooms/${room}/presence`),{online:true,updatedAt:Date.now()});onDisconnect(ref(db,`rooms/${room}/presence`)).set({online:false,updatedAt:Date.now()}).catch(()=>{});
 // คงคำสั่งที่ค้างไว้ให้ listener ตรวจและประมวลผลตามลำดับ
 await sync();onChildAdded(ref(db,`rooms/${room}/commands`),s=>{const c=s.val();chain=chain.then(async()=>{try{if(c&&typeof c.cmd==='string'&&Number(c.createdAt)>Date.now()-120000)await receive(c)}catch(e){say('คำสั่งผิดพลาด: '+e.message)}await remove(s.ref).catch(()=>{})})},e=>$('conn').textContent='อ่านคำสั่งไม่ได้: '+e.message);
 $('conn').textContent='● ออนไลน์';}catch(e){$('conn').textContent='เชื่อมต่อไม่ได้: '+e.message;say('ตรวจ Firebase Rules และอินเทอร์เน็ต แล้วรีเฟรชหน้า')}}
window.onYouTubeIframeAPIReady=makePlayer;const sc=document.createElement('script');sc.src='https://www.youtube.com/iframe_api';document.head.appendChild(sc);if(window.YT?.Player)makePlayer();
$('go').onclick=()=>{unlocked=true;$('unlock').style.display='none';if(current)play();else if(queue.length)next()};
$('play').onclick=()=>current?play():next();$('next').onclick=next;$('toggle').onclick=toggle;$('full').onclick=()=>document.fullscreenElement?document.exitFullscreen():$('screen').requestFullscreen?.().catch(()=>{});
addEventListener('keydown',e=>{if(e.key==='Enter'&&!unlocked)$('go').click();else if(e.key===' '){e.preventDefault();toggle()}else if(e.key==='n')next();else if(e.key==='f')$('full').click()});
render();show(true);boot();

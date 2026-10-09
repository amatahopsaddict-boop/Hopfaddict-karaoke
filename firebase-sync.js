import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getDatabase,ref,onValue,set,push,remove,get} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
const config=window.HOPF_FIREBASE_CONFIG;
const status=document.getElementById('firebaseStatus');
const say=t=>{if(status)status.textContent=t;};
if(!config?.apiKey||!config?.appId||!config?.databaseURL){
 say('กรอก Firebase apiKey และ appId ใน firebase-config.js ก่อน');
}else{
 try{
  const app=initializeApp(config),auth=getAuth(app),db=getDatabase(app);
  const params=new URLSearchParams(location.search),remote=params.get('remote')==='1';
  // A new TV session creates an unguessable capability-style room code.
  let room=remote?params.get('room'):sessionStorage.getItem('hopf_tv_room');
  if(!remote&&!room){room=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');sessionStorage.setItem('hopf_tv_room',room);}
  if(!room||!/^[a-f0-9]{32}$/.test(room)){say('กรุณาสแกน QR จากทีวีใหม่');throw Error('รหัสห้องไม่ถูกต้อง');}
  const roomEl=document.getElementById('roomCode');if(roomEl)roomEl.textContent=room.slice(0,8).toUpperCase();
  const remoteUrl=new URL('index.html?remote=1&room='+encodeURIComponent(room),location.href).href;
  const qrBox=document.getElementById('firebaseQr');
  if(qrBox){qrBox.textContent='';if(window.QRCode)new QRCode(qrBox,{text:remoteUrl,width:126,height:126});else{const a=document.createElement('a');a.href=remoteUrl;a.textContent='เปิดรีโมต';qrBox.append(a);}}
  const qr=document.getElementById('qr'),qr2=document.getElementById('qr2');
  for(const el of [qr,qr2])if(el){el.textContent='';if(window.QRCode)new QRCode(el,{text:remoteUrl,width:118,height:118});else{const a=document.createElement('a');a.href=remoteUrl;a.textContent='เปิดรีโมต';el.append(a);}}
  await signInAnonymously(auth);
  // Room token is a secret embedded in the QR URL; keep it private.
  if(!remote){
   const ownerSnap=await get(ref(db,'rooms/'+room+'/ownerUid'));
   if(!ownerSnap.exists())await set(ref(db,'rooms/'+room+'/ownerUid'),auth.currentUser.uid);
   else if(ownerSnap.val()!==auth.currentUser.uid)throw Error('เจ้าของห้องเปลี่ยนแล้ว ให้เปิดทีวีในแท็บใหม่');
  }else{
   const exists=await get(ref(db,'rooms/'+room+'/ownerUid'));
   if(!exists.exists())throw Error('ห้องนี้ยังไม่เปิดบนทีวี');
  }
  let applying=false;
  window.hopfFirebase={enabled:true,room,remote,
   send:async(cmd,payload={})=>{
    if(!remote)return;
    if(!['add','remove','up','play','next','toggle','volume'].includes(cmd))return;
    try{await push(ref(db,'rooms/'+room+'/commands'),{cmd,payload,createdAt:Date.now(),uid:auth.currentUser.uid});}
    catch(e){say('ส่งคำสั่งไม่ได้: '+e.message);}
   },
   sync:async(state)=>{if(remote||applying)return;try{await set(ref(db,'rooms/'+room+'/state'),{...state,version:Date.now()});}catch(e){say('ซิงก์ไม่ได้: '+e.message);}}
  };
  if(remote){
   onValue(ref(db,'rooms/'+room+'/state'),snapshot=>{const s=snapshot.val();if(!s)return;applying=true;window.hopfApplyRemoteState?.(s);applying=false;},e=>say('อ่านคิวไม่ได้: '+e.message));
   say('รีโมตเชื่อมต่อแล้ว · '+room.slice(0,8).toUpperCase());
  }else{
   onValue(ref(db,'rooms/'+room+'/commands'),snapshot=>{
    const data=snapshot.val()||{};
    for(const [id,c] of Object.entries(data)){
     if(c?.createdAt&&Date.now()-c.createdAt<120000)window.hopfReceiveCommand?.(c.cmd,c.payload);
     remove(ref(db,'rooms/'+room+'/commands/'+id)).catch(()=>{});
    }
   },e=>say('รับคำสั่งไม่ได้: '+e.message));
   window.addEventListener('hopf-state-change',()=>window.hopfFirebase.sync(window.hopfGetState()));
   await window.hopfFirebase.sync(window.hopfGetState());
   say('ทีวีพร้อมเชื่อมต่อ · สแกน QR');
  }
 }catch(e){say('Firebase: '+e.message);console.error(e);}
}

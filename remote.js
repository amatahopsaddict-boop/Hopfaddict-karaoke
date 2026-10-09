import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getDatabase,ref,get,onValue,push} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
const $=id=>document.getElementById(id),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,uid,room,results=[],key=localStorage.getItem('hopf_yt_key')||'',tt;
const toast=m=>{const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2200)};
const dec=s=>{const t=document.createElement('textarea');t.innerHTML=s;return t.value};
const ytId=s=>(s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)||(/^[\w-]{11}$/.test(s)?[0,s]:[]))[1];
async function send(cmd,payload={}){if(!room)return toast('ยังไม่ได้จับคู่กับทีวี');try{await push(ref(db,`rooms/${room}/commands`),{cmd,payload,uid,createdAt:Date.now()});return true}catch(e){toast('ส่งไม่ได้: '+e.message)}}
async function add(song){if(await send('add',{song}))toast('✓ เพิ่มเข้าคิวแล้ว')}
function renderState(s){const q=s.queue||[];$('now').textContent=s.current?.title||'ยังไม่มีเพลง';$('vl').textContent=(s.volume??70)+'%';$('vol').value=s.volume??70;
 $('queue').innerHTML=q.length?q.map((x,i)=>`<div class="q"><small>${i+1}</small><span>${esc(x.title)}</span><button data-up="${i}" aria-label="เลื่อนขึ้น">↑</button><button data-del="${i}" aria-label="ลบ">✕</button></div>`).join(''):'ยังไม่มีเพลงในคิว';
 $('queue').querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>send('up',{index:+b.dataset.up}));$('queue').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>send('remove',{index:+b.dataset.del}))}
async function search(){const q=$('q').value.trim();if(!q)return;const id=ytId(q);if(id)return add({id,title:'YouTube '+id,artist:''}),($('q').value='');
 if(!key){$('keybox').style.display='flex';return toast('ใส่ YouTube API Key เพื่อค้นหา หรือวางลิงก์วิดีโอแทน')}
 $('hint').textContent='กำลังค้นหา…';try{const u=new URL('https://www.googleapis.com/youtube/v3/search');u.search=new URLSearchParams({part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'20',q:q+' karaoke คาราโอเกะ',key});
 const r=await fetch(u),d=await r.json();if(!r.ok)throw Error(d.error?.message||'YouTube API Error');
 results=(d.items||[]).map(x=>({id:x.id.videoId,title:dec(x.snippet.title),artist:dec(x.snippet.channelTitle)}));$('hint').textContent=`พบ ${results.length} เพลง`;
 $('results').innerHTML=results.map((x,i)=>`<div class="song"><img src="https://i.ytimg.com/vi/${x.id}/default.jpg" width="80" height="60" alt="" style="border-radius:8px;object-fit:cover"><div><b>${esc(x.title)}</b><small>${esc(x.artist)}</small></div><button class="hot" data-add="${i}">＋ คิว</button></div>`).join('')||'<p class="muted">ไม่พบเพลง ลองคำอื่น</p>';
 $('results').querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>add(results[+b.dataset.add]))}catch(e){$('hint').textContent='ค้นหาไม่สำเร็จ: '+e.message}}
async function boot(){try{room=new URLSearchParams(location.search).get('room');if(!/^[a-f0-9]{32}$/.test(room||'')){room=null;$('online').textContent='ยังไม่จับคู่';return toast('สแกน QR จากหน้าทีวีเพื่อจับคู่')}
 const app=initializeApp(window.HOPF_FIREBASE_CONFIG),a=getAuth(app);db=getDatabase(app);await signInAnonymously(a);uid=a.currentUser.uid;
 if(!(await get(ref(db,`rooms/${room}/ownerUid`))).exists())throw Error('ยังไม่มีห้องนี้บนทีวี');
 onValue(ref(db,`rooms/${room}/state`),s=>s.exists()&&renderState(s.val()),e=>toast('อ่านคิวไม่ได้: '+e.message));
 onValue(ref(db,`rooms/${room}/presence`),s=>{const on=!!s.val()?.online;$('dot').classList.toggle('on',on);$('online').textContent=on?'ทีวีออนไลน์':'ทีวีออฟไลน์'})}catch(e){$('online').textContent='เชื่อมต่อไม่ได้';toast(e.message)}}
$('go').onclick=search;$('q').addEventListener('keydown',e=>e.key==='Enter'&&search());$('play').onclick=()=>send('play');$('next').onclick=()=>send('next');$('toggle').onclick=()=>send('toggle');
$('vol').oninput=e=>$('vl').textContent=e.target.value+'%';$('vol').onchange=e=>send('volume',{value:+e.target.value});
$('gear').onclick=()=>{$('keybox').style.display=$('keybox').style.display==='flex'?'none':'flex';$('key').value=key};
$('savekey').onclick=()=>{key=$('key').value.trim();localStorage.setItem('hopf_yt_key',key);$('keybox').style.display='none';toast('บันทึก API Key แล้ว')};
boot();

/* Firebase console > Project settings > Your apps > Web app. */
const firebaseConfig = {
  apiKey: "AIzaSyBXzfTak_EcGERwbs1cOlZpGQgtGUF3SLo",
  authDomain: "ourwebsite-19c5b.firebaseapp.com",
  projectId: "ourwebsite-19c5b",
  storageBucket: "ourwebsite-19c5b.firebasestorage.app",
  messagingSenderId: "973934565883",
  appId: "1:973934565883:web:22324a6fe82b35c26ed35e",
  measurementId: "G-19DNFJWZM3"
};
const USER_UIDS = { Joe: 'ahZtOZv0wnboG5LFKU0Nx8BpJpq2', 'Noémie': 'ed9Ufp9pNRRY5qsFMneztfsxoff1' };
const LOGIN_EMAILS = { joe: 'lakin.joe27@gmail.com', captain: 'fakeemail@gmail.com' };
const $ = id => document.getElementById(id);
const STARTERS = [
  {id:'starter-la-rochelle', name:'La Rochelle, France', lat:46.1603, lng:-1.1511, category:'The beachhhhh', status:'approved', notes:'A place for us to explore together.', addedBy:'Joe'},
  {id:'starter-norway', name:'Norway', lat:61, lng:8, category:'Agreed Trip', status:'approved', notes:'fjords 😍😍😍', addedBy:'Noémie'}
];
const isDemo = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE_');
const demoKey = 'our-next-stop-demo'; // reuse old local-preview data
let serverFresh=false, hasPendingWrites=false, syncError=false, writeInProgress=false, everConnected=false;
let map, db, auth, firestore, authApi, unsubscribe, pins=[], currentPage='home', filter='All', currentUser='Joe', pendingLatLng=null, previewMarker=null, selectedId=null, savedMarkers=new Map(), toastTimer;
const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const stateOf = p => p.status || (p.category==='Agreed Trip'?'approved':p.category==='Visited'?'visited':'suggested');
const nameFor = p => ({'Wishlist - Her':'Noémie','Wishlist - Him':'Joe'}[p.category] || p.addedBy);
const showState = p => ({suggested:'Suggested',approved:'Approved',visited:'Visited',vetoed:'Vetoed'}[stateOf(p)]||'Suggested');
const markerStyle = p => ({suggested:'hers',approved:'together',visited:'done',vetoed:'vetoed'}[stateOf(p)]||'hers');
const otherUser = name => name==='Joe'?'Noémie':'Joe';
const incoming = () => pins.filter(p=>stateOf(p)==='suggested' && nameFor(p)!==currentUser);
function notify(msg){$('toast').textContent=msg;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3600);}
// Only a non-cached Firestore snapshot confirms that reads are current.
// A successful write promise confirms that Firebase has acknowledged the change.
function canWrite(){return !writeInProgress && (isDemo || (serverFresh && !syncError && navigator.onLine));}
function updateConnectionUI(){
  let label, connected=false;
  if(isDemo){label='Local preview';connected=true;}
  else if(syncError){label='Connection error';}
  else if(writeInProgress || hasPendingWrites){label='Saving…';}
  else if(!navigator.onLine || (everConnected && !serverFresh)){label='Offline — changes paused';}
  else if(serverFresh){label='Connected';connected=true;}
  else label='Connecting…';
  $('sync-status').textContent=label;
  $('status-dot').classList.toggle('off',!connected);
  $('sync-status').parentElement.title=connected?'Latest data confirmed from Firebase':
    (label==='Saving…'?'Waiting for Firebase to confirm your change':
      'Changes are paused until Firebase confirms the connection');
  const ready=canWrite();
  const save=$('save-pin');if(save && !writeInProgress)save.disabled=!ready;
  const visit=$('confirm-visited');if(visit && !writeInProgress)visit.disabled=!ready;
  document.querySelectorAll('[data-write-action]').forEach(btn=>{if(!writeInProgress)btn.disabled=!ready;});
}
function connectionStatus(msg){
  // These messages are used while logging in or if Firebase cannot initialize.
  serverFresh=false;
  syncError=msg==='Permission error'||msg==='Connection error'||msg==='Sync error';
  updateConnectionUI();
  if(msg==='Sign in required')$('sync-status').textContent='Sign in required';
}
function requireConnection(){
  if(writeInProgress){notify('Please finish saving the current change first.');return false;}
  if(!canWrite()){notify('Not connected yet. Nothing has been submitted — try again when Connected appears.');return false;}
  return true;
}
async function confirmedWrite(operation, button=null){
  if(!requireConnection())return false;
  writeInProgress=true;
  const original=button?.textContent;
  if(button){button.disabled=true;button.textContent='Saving…';}
  updateConnectionUI();
  try{await operation();return true;}
  catch(err){notify('Could not save: '+err.message);return false;}
  finally{
    writeInProgress=false;
    if(button){button.textContent=original;}
    updateConnectionUI();
  }
}

function initMap(){map=L.map('map',{zoomControl:false,worldCopyJump:true}).setView([46,2],4);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);L.control.zoom({position:'bottomright'}).addTo(map);map.on('click',e=>showPinModal(e.latlng));}
function fitPins(){const visible=pins.filter(p=>stateOf(p)!=='vetoed'&&(filter==='All'||showState(p)===filter));if(!visible.length){map.setView([46,2],4);return;}map.fitBounds(L.latLngBounds(visible.map(p=>[p.lat,p.lng])).pad(.25),{maxZoom:7});}
function navigate(page){if(page!=='map'&&page!=='home'&&!['places','positions','moments'].includes(page))page='home';currentPage=page;const isMap=page==='map';$('home-view').hidden=page!=='home';$('map-view').hidden=!isMap;$('soon-view').hidden=page==='home'||isMap;$('map-sidebar').hidden=!isMap;document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('selected',b.dataset.section===page));$('page-eyebrow').textContent=page==='home'?'OUR WEBSITE':isMap?'OUR NEXT STOP':page.toUpperCase();closeSidebar();if(isMap)setTimeout(()=>{map.invalidateSize();fitPins();},70);if(!isMap&&page!=='home'){const info={places:['😈','Our places to','A checklist for all those places. We can build adding items, marking them done and tracking who suggested them later.'],positions:['🥵','Our positions','A private list with our own checkboxes is coming soon.'],moments:['📸','Our moments','Shared photos, stories and favourites — all in one place.']}[page];$('soon-icon').textContent=info[0];$('soon-title').textContent=info[1];$('soon-text').textContent=info[2];}history.replaceState(null,'',page==='home'?location.pathname+location.search:'#'+page);}
function render(){const suggestions=pins.filter(p=>stateOf(p)==='suggested'),approved=pins.filter(p=>stateOf(p)==='approved'),visited=pins.filter(p=>stateOf(p)==='visited');$('wishlist-count').textContent=suggestions.length;$('agreed-count').textContent=approved.length;$('done-count').textContent=visited.length;$('home-count').textContent=pins.filter(p=>stateOf(p)!=='vetoed').length;$('home-pending').textContent=incoming().length;$('notifications-count').textContent=incoming().length;$('notifications-btn').classList.toggle('has-new',incoming().length>0);$('list-count').textContent=`${pins.length} saved places`;
  for(const marker of savedMarkers.values())marker.remove();savedMarkers.clear();
  const visible=pins.filter(p=>filter==='All'?stateOf(p)!=='vetoed':showState(p)===filter);
  for(const place of visible){if(!Number.isFinite(place.lat)||!Number.isFinite(place.lng))continue;const css=markerStyle(place);const icon=L.divIcon({className:'',html:`<div class="pin-dot ${css}"></div>`,iconSize:[25,25],iconAnchor:[12,24]});const marker=L.marker([place.lat,place.lng],{icon}).addTo(map);const box=document.createElement('div');box.innerHTML=`<b>${escapeHtml(place.name)}</b><br>${showState(place)} · ${escapeHtml(nameFor(place))}${place.notes?`<p>${escapeHtml(place.notes)}</p>`:''}`;const action=document.createElement('button');action.className='popup-delete';action.textContent='View details ↗';action.onclick=()=>openDetails(place.id);box.append(action);marker.bindPopup(box);savedMarkers.set(place.id,marker);}
  const sidebar=$('places-list'),main=$('main-places');sidebar.replaceChildren();main.replaceChildren();if(!visible.length){sidebar.innerHTML='<p class="empty">No places in this category yet.</p>';main.innerHTML='<p class="empty">Nothing here yet. Suggest a place on the map.</p>';}
  for(const p of visible){const item=document.createElement('button');item.className='place-item place-click';item.innerHTML=`<span class="place-icon ${markerStyle(p)}">${stateOf(p)==='visited'?'✓':stateOf(p)==='approved'?'♡':'✦'}</span><span class="place-detail"><strong class="place-name">${escapeHtml(p.name)}</strong><span class="place-tag">${showState(p)} · ${escapeHtml(nameFor(p))}</span>${p.notes?`<span class="place-note">${escapeHtml(p.notes)}</span>`:''}</span>`;item.onclick=()=>{openDetails(p.id);closeSidebar();};sidebar.append(item);const card=item.cloneNode(true);card.classList.add('main-place-card');card.onclick=()=>openDetails(p.id);main.append(card);}
  renderNotifications();}
function openDetails(id){const p=pins.find(x=>x.id===id);if(!p)return;selectedId=id;$('detail-title').textContent=p.name;$('detail-state').textContent=showState(p);$('detail-meta').textContent=`Suggested by ${nameFor(p)} · ${showState(p)}`;$('detail-notes').textContent=p.notes||'No note yet.';$('detail-memory-wrap').hidden=!p.memoryNotes;$('detail-memory').textContent=p.memoryNotes||'';let url='';try{const u=new URL(p.photoUrl||'');if(u.protocol==='https:')url=u.href;}catch{}$('detail-photo-wrap').hidden=!url;if(url)$('detail-photo').src=url;else $('detail-photo').removeAttribute('src');$('visit-fields').hidden=true;$('memory-notes').value=p.memoryNotes||'';$('photo-url').value=p.photoUrl||'';
  const actions=$('detail-actions');actions.replaceChildren();const button=(label,cb,cls='secondary',isWrite=false)=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.onclick=cb;if(isWrite){b.dataset.writeAction='true';b.disabled=!canWrite();}actions.append(b);};const state=stateOf(p);
  if(state==='suggested'&&nameFor(p)!==currentUser){button('Approve ✓',event=>changeStatus(p,'approved',event.currentTarget),'primary',true);button('Veto 👀',event=>changeStatus(p,'vetoed',event.currentTarget),'secondary',true);}
  if(state==='suggested'&&nameFor(p)===currentUser)button('Awaiting '+otherUser(currentUser)+'’s decision',()=>notify('Only the other person can approve or veto.'),'secondary');
  if(state==='approved')button('We went here ✓',()=>{$('visit-fields').hidden=false;});
  if(state==='visited')button('Edit memories',()=>{$('visit-fields').hidden=false;$('confirm-visited').textContent='Save memories ✓';});
  if(state==='vetoed')button('Vetoed',()=>notify('This suggestion was vetoed.'));
  button('Share on WhatsApp ↗',()=>sharePlace(p));button('Delete',()=>deletePlace(p),'danger',true);$('detail-modal').hidden=false;updateConnectionUI();}
function closeDetails(){if(writeInProgress)return;$('detail-modal').hidden=true;selectedId=null;$('confirm-visited').textContent='Mark as visited ✓';}
async function sharePlace(p){const url=new URL(location.href);url.hash='place-'+encodeURIComponent(p.id);const msg=`${nameFor(p)} suggested ${p.name} 🌍 — approve or veto? 👀\n${url.href}`;if(navigator.share){try{await navigator.share({text:msg});return;}catch(e){if(e.name==='AbortError')return;}}try{await navigator.clipboard.writeText(msg);notify('Message copied — paste it into WhatsApp!');}catch{window.prompt('Copy this message for WhatsApp:',msg);}}
function renderNotifications(){const list=$('notifications-list');list.replaceChildren();const items=incoming();if(!items.length){list.innerHTML='<p class="empty">Nothing to vote on right now.</p>';return;}for(const p of items){const b=document.createElement('button');b.className='notification-row';b.innerHTML=`<strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(nameFor(p))} suggested this · Review →</span>`;b.onclick=()=>{$('notifications-modal').hidden=true;navigate('map');openDetails(p.id);};list.append(b);}}
function showPinModal(latlng=null,suggestedName=''){pendingLatLng=latlng||map.getCenter();$('pin-form').reset();$('pin-name').value=suggestedName;$('pin-coords').textContent=`📍 ${pendingLatLng.lat.toFixed(4)}, ${pendingLatLng.lng.toFixed(4)}`;$('pin-modal').hidden=false;updateConnectionUI();if(previewMarker)previewMarker.remove();previewMarker=L.circleMarker(pendingLatLng,{radius:9,color:'#fff',weight:3,fillColor:'#df8a69',fillOpacity:1}).addTo(map);setTimeout(()=>$('pin-name').focus(),50);}
function closePinModal(){if(writeInProgress)return;$('pin-modal').hidden=true;if(previewMarker)previewMarker.remove();previewMarker=null;}
function openSidebar(){$('sidebar').classList.add('open');$('shade').classList.add('show');}
function closeSidebar(){$('sidebar').classList.remove('open');$('shade').classList.remove('show');}
function persistDemo(){localStorage.setItem(demoKey,JSON.stringify(pins));render();}
async function createPlace(e){
  e.preventDefault();
  const record={name:$('pin-name').value.trim(),category:currentUser==='Joe'?'Wishlist - Joe':'Wishlist - Noémie',status:'suggested',notes:$('pin-notes').value.trim(),addedBy:currentUser,lat:pendingLatLng.lat,lng:pendingLatLng.lng,reviewedBy:'',visitedAt:null,memoryNotes:'',photoUrl:''};
  if(!record.name)return notify('Enter a destination name first.');
  const saved=await confirmedWrite(async()=>{
    if(isDemo){pins.push({id:crypto.randomUUID(),createdAt:new Date().toISOString(),...record});persistDemo();}
    else await firestore.addDoc(firestore.collection(db,'places'),{...record,createdAt:firestore.serverTimestamp()});
  },$('save-pin'));
  if(saved){closePinModal();notify('Saved ✓ Your suggestion has been shared with '+otherUser(currentUser)+'.');}
}
async function writePlace(p,next){
  if(isDemo){pins=pins.map(x=>x.id===p.id?{...x,...next}:x);persistDemo();}
  else await firestore.updateDoc(firestore.doc(db,'places',p.id),next);
}
async function changeStatus(p,next,actionButton=null){
  if(!['approved','vetoed'].includes(next))return;
  if(stateOf(p)!=='suggested'||nameFor(p)===currentUser)return notify('Only the other person can approve or veto.');
  const saved=await confirmedWrite(()=>writePlace(p,{status:next,category:next==='approved'?'Agreed Trip':p.category,reviewedBy:currentUser}),
    actionButton);
  if(saved){closeDetails();notify(next==='approved'?'Saved ✓ Approved and shared!':'Saved ✓ Suggestion vetoed.');}
}
async function saveVisit(){
  const p=pins.find(x=>x.id===selectedId);if(!p)return;
  const url=$('photo-url').value.trim();
  if(url&&!/^https:\/\//i.test(url))return notify('Please use an https:// photo URL.');
  if(!['approved','visited'].includes(stateOf(p)))return notify('Approve the place first.');
  const saved=await confirmedWrite(()=>writePlace(p,{status:'visited',category:'Visited',visitedAt:p.visitedAt||new Date(),memoryNotes:$('memory-notes').value.trim(),photoUrl:url}),$('confirm-visited'));
  if(saved){closeDetails();notify('Saved ✓ Added to places we’ve been.');}
}
async function deletePlace(p){
  if(!requireConnection())return;
  if(!confirm(`Delete ${p.name} permanently?`))return;
  const saved=await confirmedWrite(async()=>{
    if(isDemo){pins=pins.filter(x=>x.id!==p.id);persistDemo();}
    else await firestore.deleteDoc(firestore.doc(db,'places',p.id));
  },[...document.querySelectorAll('#detail-actions [data-write-action]')].find(b=>b.textContent==='Delete'));
  if(saved){closeDetails();notify('Saved ✓ Place removed.');}
}
async function searchPlaces(e){e.preventDefault();const term=$('place-search').value.trim();if(term.length<2)return notify('Enter at least two characters.');const box=$('search-results');box.hidden=false;box.innerHTML='<div class="search-result">Searching…</div>';try{const res=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=8&language=en&format=json`);if(!res.ok)throw Error('Search is unavailable');const data=await res.json();box.replaceChildren();if(!data.results?.length){box.innerHTML='<div class="search-result">No results. Try clicking the map instead.</div>';return;}for(const p of data.results){const b=document.createElement('button');b.className='search-result';const display=[p.name,p.admin1,p.country].filter((x,i,a)=>x&&a.indexOf(x)===i).join(', ');b.textContent='📍 '+display;b.onclick=()=>{box.hidden=true;map.setView([p.latitude,p.longitude],9);showPinModal(L.latLng(p.latitude,p.longitude),display);};box.append(b);}}catch(err){box.textContent=err.message;}}
async function initialSeed(){const first=await firestore.getDocs(firestore.query(firestore.collection(db,'places'),firestore.limit(1)));if(!first.empty)return;const lock=firestore.doc(db,'meta','starter-seed');await firestore.runTransaction(db,async tx=>{const state=await tx.get(lock);if(state.exists())return;tx.set(lock,{seededAt:firestore.serverTimestamp()});for(const entry of STARTERS){const {id,...p}=entry;tx.set(firestore.doc(db,'places',id),{...p,reviewedBy:'',visitedAt:null,memoryNotes:'',photoUrl:'',createdAt:firestore.serverTimestamp()});}});}
function startListening(){
  if(unsubscribe)unsubscribe();
  unsubscribe=firestore.onSnapshot(firestore.collection(db,'places'),{includeMetadataChanges:true},snapshot=>{
    const previousIds=pins.map(p=>p.id).join('|');
    pins=snapshot.docs.map(d=>({id:d.id,...d.data()})).map(p=>p.id==='starter-norway'&&p.notes==='Northern lights and beautiful views, one day.'?{...p,notes:'fjords 😍😍😍'}:p).sort((a,b)=>a.name.localeCompare(b.name));
    serverFresh=!snapshot.metadata.fromCache;
    hasPendingWrites=snapshot.metadata.hasPendingWrites;
    if(serverFresh)everConnected=true;
    syncError=false;
    render();updateConnectionUI();
    if(previousIds!==pins.map(p=>p.id).join('|'))openDeepLink();
  },err=>{
    serverFresh=false;syncError=true;updateConnectionUI();
    notify('Database connection failed: '+err.message);
  });
}
async function initFirebase(){const [appSdk,authSdk,dbSdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);firestore=dbSdk;authApi=authSdk;const app=appSdk.initializeApp(firebaseConfig);auth=authSdk.getAuth(app);db=dbSdk.getFirestore(app);authSdk.onAuthStateChanged(auth,async user=>{if(unsubscribe){unsubscribe();unsubscribe=null;}if(!user){serverFresh=false;hasPendingWrites=false;everConnected=false;writeInProgress=false;pins=[];render();$('auth-modal').hidden=false;$('sign-out').hidden=true;connectionStatus('Sign in required');return;}serverFresh=false;hasPendingWrites=false;syncError=false;everConnected=false;updateConnectionUI();currentUser=user.uid===USER_UIDS.Joe?'Joe':user.uid===USER_UIDS['Noémie']?'Noémie':null;if(!currentUser){await authSdk.signOut(auth);$('auth-error').textContent='This account is not on the two-person allowlist. Check the configured UIDs.';return;}$('auth-modal').hidden=true;$('identity').textContent=`Signed in as ${currentUser}`;$('sign-out').hidden=false;connectionStatus('Connecting');try{startListening();}catch(err){connectionStatus('Permission error');notify('Database connection failed: '+err.message);}});}
function openDeepLink(){const value=decodeURIComponent(location.hash.slice(1));if(!value.startsWith('place-'))return;const id=value.slice(6);if(pins.some(p=>p.id===id)){navigate('map');openDetails(id);}}
function bindEvents(){document.querySelectorAll('.nav-link').forEach(b=>b.onclick=()=>navigate(b.dataset.section));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));$('back-home').onclick=()=>navigate('home');$('soon-map').onclick=()=>navigate('map');$('open-sidebar').onclick=openSidebar;$('close-sidebar').onclick=closeSidebar;$('shade').onclick=closeSidebar;$('add-place').onclick=()=>showPinModal();$('side-add').onclick=()=>{closeSidebar();showPinModal();};$('close-pin').onclick=closePinModal;$('cancel-pin').onclick=closePinModal;$('pin-form').addEventListener('submit',createPlace);$('search-form').addEventListener('submit',searchPlaces);$('fit-pins').onclick=fitPins;document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));render();});$('notifications-btn').onclick=()=>{$('notifications-modal').hidden=false;};$('close-notifications').onclick=()=>{$('notifications-modal').hidden=true;};$('close-detail').onclick=closeDetails;$('confirm-visited').onclick=saveVisit;document.querySelectorAll('.backdrop').forEach(el=>el.addEventListener('click',e=>{if(e.target!==el)return;if(el.id==='pin-modal')closePinModal();if(el.id==='detail-modal')closeDetails();if(el.id==='notifications-modal')el.hidden=true;}));document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;closePinModal();closeDetails();$('notifications-modal').hidden=true;$('search-results').hidden=true;closeSidebar();});$('demo-user').onchange=e=>{currentUser=e.target.value;localStorage.setItem('our-site-demo-user',currentUser);$('identity').textContent=`Preview as ${currentUser}`;render();};$('auth-form').addEventListener('submit',async e=>{e.preventDefault();$('auth-error').textContent='';const b=$('auth-form').querySelector('button');b.disabled=true;try{const username=$('username').value.trim().toLowerCase();const loginEmail=LOGIN_EMAILS[username];if(!loginEmail){$('auth-error').textContent='Use Joe or Captain as your username.';return;}await authApi.signInWithEmailAndPassword(auth,loginEmail,$('password').value);$('password').value='';}catch(err){$('auth-error').textContent=err.code==='auth/invalid-credential'?'Incorrect username or password.':err.message;}finally{b.disabled=false;}});$('sign-out').onclick=()=>authApi.signOut(auth);window.addEventListener('offline',()=>{serverFresh=false;updateConnectionUI();});window.addEventListener('online',()=>{serverFresh=false;updateConnectionUI();});window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#place-'))openDeepLink();else if(location.hash==='#map')navigate('map');else if(location.hash==='#home')navigate('home');});}
async function main(){initMap();bindEvents();navigate(location.hash==='#map'?'map':'home');if(isDemo){$('preview').hidden=false;connectionStatus('Local preview');try{const stored=JSON.parse(localStorage.getItem(demoKey));pins=(Array.isArray(stored)?stored:STARTERS.map(p=>({...p}))).map(p=>p.id==='starter-norway'&&p.notes==='Northern lights and beautiful views, one day.'?{...p,notes:'fjords 😍😍😍'}:p);}catch{pins=STARTERS.map(p=>({...p}));}currentUser=localStorage.getItem('our-site-demo-user')||'Joe';$('demo-user').value=currentUser;$('identity').textContent=`Preview as ${currentUser}`;persistDemo();openDeepLink();}else{try{await initFirebase();}catch(err){connectionStatus('Connection error');notify('Firebase failed to load: '+err.message);}}}
main();

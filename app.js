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
const DODO_QUOTES=['🦤 The dodo approves this message.','Where to next, little birdie? 🐦','More adventures pending approval 👀','🦤 Dodo headquarters, reporting for duty.'];
function refreshHome(){
  const greeting=$('home-greeting');if(!greeting)return;
  greeting.textContent=currentUser==='Noémie'?'HEY, CAPTAIN 👀':'HEY, JOE 👋';
  const pendingTrips=incoming().length,pendingIdeas=placesToIncoming().length,total=pendingTrips+pendingIdeas;
  $('home-pending').textContent=total;
  $('home-attention').textContent=total?`${pendingTrips} trip ${pendingTrips===1?'suggestion':'suggestions'} · ${pendingIdeas} Places To ${pendingIdeas===1?'idea':'ideas'} waiting for you`:'All caught up — nothing waiting for your approval.';
  const activities=[...pins.map(x=>({label:`${nameFor(x)} suggested ${x.name} 🌍`,time:x.createdAt})),...placesTo.filter(x=>x.status!=='deleted').map(x=>({label:`${x.addedBy} added ${x.name} 😈`,time:x.createdAt}))];
  const millis=x=>x?.toMillis?.()|| (x?.seconds?x.seconds*1000:Date.parse(x||'')||0);
  activities.sort((a,b)=>millis(b.time)-millis(a.time));
  $('home-last').textContent=activities.length?'Recently: '+activities[0].label:'Your shared ideas will appear here.';
  $('home-quote').textContent=DODO_QUOTES[Math.floor(Date.now()/86400000)%DODO_QUOTES.length];
}

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
function navigate(page){if(page!=='map'&&page!=='home'&&!['places','positions','moments'].includes(page))page='home';currentPage=page;const isMap=page==='map';$('home-view').hidden=page!=='home';$('map-view').hidden=!isMap;$('soon-view').hidden=page==='home'||isMap||page==='places';$('places-view').hidden=page!=='places';if(page==='places')renderPlacesTo();$('map-sidebar').hidden=!isMap;document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('selected',b.dataset.section===page));$('page-eyebrow').textContent=page==='home'?'OUR SPACE':isMap?'OUR NEXT STOP':page.toUpperCase();closeSidebar();if(isMap)setTimeout(()=>{map.invalidateSize();fitPins();},70);if(!isMap&&page!=='home'&&page!=='places'){const info={places:['😈','Our places to','A checklist for all those places. We can build adding items, marking them done and tracking who suggested them later.'],positions:['🥵','Our positions','A private list with our own checkboxes is coming soon.'],moments:['📸','Our moments','Shared photos, stories and favourites — all in one place.']}[page];$('soon-icon').textContent=info[0];$('soon-title').textContent=info[1];$('soon-text').textContent=info[2];}history.replaceState(null,'',page==='home'?location.pathname+location.search:'#'+page);}
function render(){const suggestions=pins.filter(p=>stateOf(p)==='suggested'),approved=pins.filter(p=>stateOf(p)==='approved'),visited=pins.filter(p=>stateOf(p)==='visited');$('wishlist-count').textContent=suggestions.length;$('agreed-count').textContent=approved.length;$('done-count').textContent=visited.length;$('home-count').textContent=pins.filter(p=>stateOf(p)!=='vetoed').length;$('home-pending').textContent=incoming().length;$('notifications-count').textContent=incoming().length+placesToIncoming().length;$('notifications-btn').classList.toggle('has-new',incoming().length+placesToIncoming().length>0);$('list-count').textContent=`${pins.length} saved places`;
  for(const marker of savedMarkers.values())marker.remove();savedMarkers.clear();
  const visible=pins.filter(p=>filter==='All'?stateOf(p)!=='vetoed':showState(p)===filter);
  for(const place of visible){if(!Number.isFinite(place.lat)||!Number.isFinite(place.lng))continue;const css=markerStyle(place);const icon=L.divIcon({className:'',html:`<div class="pin-dot ${css}"></div>`,iconSize:[25,25],iconAnchor:[12,24]});const marker=L.marker([place.lat,place.lng],{icon}).addTo(map);const box=document.createElement('div');box.innerHTML=`<b>${escapeHtml(place.name)}</b><br>${showState(place)} · ${escapeHtml(nameFor(place))}${place.notes?`<p>${escapeHtml(place.notes)}</p>`:''}`;const action=document.createElement('button');action.className='popup-delete';action.textContent='View details ↗';action.onclick=()=>openDetails(place.id);box.append(action);marker.bindPopup(box);savedMarkers.set(place.id,marker);}
  const sidebar=$('places-list'),main=$('main-places');sidebar.replaceChildren();main.replaceChildren();if(!visible.length){sidebar.innerHTML='<p class="empty">No places in this category yet.</p>';main.innerHTML='<p class="empty">Nothing here yet. Suggest a place on the map.</p>';}
  for(const p of visible){const item=document.createElement('button');item.className='place-item place-click';item.innerHTML=`<span class="place-icon ${markerStyle(p)}">${stateOf(p)==='visited'?'✓':stateOf(p)==='approved'?'♡':'✦'}</span><span class="place-detail"><strong class="place-name">${escapeHtml(p.name)}</strong><span class="place-tag">${showState(p)} · ${escapeHtml(nameFor(p))}</span>${p.notes?`<span class="place-note">${escapeHtml(p.notes)}</span>`:''}</span>`;item.onclick=()=>{openDetails(p.id);closeSidebar();};sidebar.append(item);const card=item.cloneNode(true);card.classList.add('main-place-card');card.onclick=()=>openDetails(p.id);main.append(card);}
  renderNotifications();renderPlacesTo();refreshHome();}
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
function renderNotifications(){const list=$('notifications-list');list.replaceChildren();const items=incoming();const extra=placesToIncoming();if(!items.length&&!extra.length){list.innerHTML='<p class="empty">Nothing to vote on right now.</p>';return;}for(const p of extra){const b=document.createElement('button');b.className='notification-row';b.innerHTML=`<strong>😈 ${escapeHtml(p.name)}</strong><span>${escapeHtml(p.addedBy)} suggested a new checklist idea · Review →</span>`;b.onclick=()=>{$('notifications-modal').hidden=true;placesToTab='suggested';navigate('places');setPlacesTab('suggested');};list.append(b);}for(const p of items){const b=document.createElement('button');b.className='notification-row';b.innerHTML=`<strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(nameFor(p))} suggested this · Review →</span>`;b.onclick=()=>{$('notifications-modal').hidden=true;navigate('map');openDetails(p.id);};list.append(b);}}
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
async function initFirebase(){const [appSdk,authSdk,dbSdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);firestore=dbSdk;authApi=authSdk;const app=appSdk.initializeApp(firebaseConfig);auth=authSdk.getAuth(app);db=dbSdk.getFirestore(app);authSdk.onAuthStateChanged(auth,async user=>{if(unsubscribe){unsubscribe();unsubscribe=null;}if(unsubscribePlacesTo){unsubscribePlacesTo();unsubscribePlacesTo=null;}placesToFresh=false;if(!user){serverFresh=false;hasPendingWrites=false;everConnected=false;writeInProgress=false;pins=[];placesTo=[];render();renderPlacesTo();$('auth-modal').hidden=false;$('sign-out').hidden=true;$('mobile-sign-out').hidden=true;connectionStatus('Sign in required');return;}serverFresh=false;hasPendingWrites=false;syncError=false;everConnected=false;updateConnectionUI();currentUser=user.uid===USER_UIDS.Joe?'Joe':user.uid===USER_UIDS['Noémie']?'Noémie':null;if(!currentUser){await authSdk.signOut(auth);$('auth-error').textContent='This account is not on the two-person allowlist. Check the configured UIDs.';return;}$('auth-modal').hidden=true;$('identity').textContent=`Signed in as ${currentUser}`;$('sign-out').hidden=false;$('mobile-sign-out').hidden=false;refreshHome();connectionStatus('Connecting');try{startListening();startPlacesToListener();}catch(err){connectionStatus('Permission error');notify('Database connection failed: '+err.message);}});}
function openDeepLink(){const value=decodeURIComponent(location.hash.slice(1));if(!value.startsWith('place-'))return;const id=value.slice(6);if(pins.some(p=>p.id===id)){navigate('map');openDetails(id);}}
function bindEvents(){document.querySelectorAll('.nav-link').forEach(b=>b.onclick=()=>navigate(b.dataset.section));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));$('back-home').onclick=()=>navigate('home');$('soon-map').onclick=()=>navigate('map');$('open-sidebar').onclick=openSidebar;$('close-sidebar').onclick=closeSidebar;$('shade').onclick=closeSidebar;$('add-place').onclick=()=>showPinModal();$('side-add').onclick=()=>{closeSidebar();showPinModal();};$('close-pin').onclick=closePinModal;$('cancel-pin').onclick=closePinModal;$('pin-form').addEventListener('submit',createPlace);$('search-form').addEventListener('submit',searchPlaces);$('fit-pins').onclick=fitPins;document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));render();});$('notifications-btn').onclick=()=>{$('notifications-modal').hidden=false;};$('close-notifications').onclick=()=>{$('notifications-modal').hidden=true;};$('close-detail').onclick=closeDetails;$('confirm-visited').onclick=saveVisit;document.querySelectorAll('.backdrop').forEach(el=>el.addEventListener('click',e=>{if(e.target!==el)return;if(el.id==='pin-modal')closePinModal();if(el.id==='detail-modal')closeDetails();if(el.id==='notifications-modal')el.hidden=true;}));document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;closePinModal();closeDetails();$('notifications-modal').hidden=true;$('search-results').hidden=true;closeSidebar();});$('demo-user').onchange=e=>{currentUser=e.target.value;localStorage.setItem('our-site-demo-user',currentUser);$('identity').textContent=`Preview as ${currentUser}`;render();refreshHome();};$('auth-form').addEventListener('submit',async e=>{e.preventDefault();$('auth-error').textContent='';const b=$('auth-form').querySelector('button');b.disabled=true;try{const username=$('username').value.trim().toLowerCase();const loginEmail=LOGIN_EMAILS[username];if(!loginEmail){$('auth-error').textContent='Use Joe or Captain as your username.';return;}await authApi.signInWithEmailAndPassword(auth,loginEmail,$('password').value);$('password').value='';}catch(err){$('auth-error').textContent=err.code==='auth/invalid-credential'?'Incorrect username or password.':err.message;}finally{b.disabled=false;}});$('sign-out').onclick=()=>authApi.signOut(auth);$('mobile-sign-out').onclick=()=>{if(confirm('Sign out of Our Space?'))authApi.signOut(auth);};$('home-review').onclick=()=>{$('notifications-modal').hidden=false;};window.addEventListener('offline',()=>{serverFresh=false;updateConnectionUI();});window.addEventListener('online',()=>{serverFresh=false;updateConnectionUI();});window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#place-'))openDeepLink();else if(location.hash==='#map')navigate('map');else if(location.hash==='#home')navigate('home');});}
async function main(){initMap();bindEvents();bindPlacesTo();navigate(location.hash==='#map'?'map':'home');if(isDemo){$('preview').hidden=false;connectionStatus('Local preview');try{const stored=JSON.parse(localStorage.getItem(demoKey));pins=(Array.isArray(stored)?stored:STARTERS.map(p=>({...p}))).map(p=>p.id==='starter-norway'&&p.notes==='Northern lights and beautiful views, one day.'?{...p,notes:'fjords 😍😍😍'}:p);}catch{pins=STARTERS.map(p=>({...p}));}currentUser=localStorage.getItem('our-site-demo-user')||'Joe';$('demo-user').value=currentUser;$('identity').textContent=`Preview as ${currentUser}`;persistDemo();loadDemoPlacesTo();refreshHome();openDeepLink();}else{try{await initFirebase();}catch(err){connectionStatus('Connection error');notify('Firebase failed to load: '+err.message);}}}


/* OUR PLACES TO — independent from the travel map, stored in /placesTo. */
let placesTo=[], unsubscribePlacesTo=null, placesToFresh=false, placesToTab='approved', placesToBusy=false;
const placesToIncoming=()=>placesTo.filter(p=>p.status==='suggested'&&p.addedBy!==currentUser);
let undoRecord=null,undoTimer=null;
function showUndo(p){undoRecord={...p};$('undo-label').textContent=`Removed “${p.name}”.`;$('undo-toast').hidden=false;clearTimeout(undoTimer);undoTimer=setTimeout(hideUndo,10000);}
function hideUndo(){undoRecord=null;$('undo-toast').hidden=true;clearTimeout(undoTimer);}
async function undoPlace(){const p=undoRecord;if(!p)return;const saved=await placesToWrite(async()=>{if(isDemo){const item=placesTo.find(x=>x.id===p.id);if(!item||item.status!=='deleted')throw Error('This idea was changed.');Object.assign(item,{status:p.status,joeStars:0,noemieStars:0});delete item.deletedBy;delete item.deletedFrom;saveDemoPlacesTo();}else await firestore.updateDoc(firestore.doc(db,'placesTo',p.id),{status:p.status,deletedBy:firestore.deleteField(),deletedFrom:firestore.deleteField()});});if(saved){hideUndo();notify('Restored ✓ Your 😈 are available again.');}}
async function removePlace(p){if(!placesReady())return notify('Checklist not connected yet.');if(!confirm(`Remove “${p.name}” from both lists? Neither person is notified. You can undo straight afterwards.`))return;const previous={...p};const ok=await placesToWrite(async()=>{if(isDemo){Object.assign(p,{status:'deleted',deletedBy:currentUser,deletedFrom:p.status,joeStars:0,noemieStars:0});saveDemoPlacesTo();}else await firestore.updateDoc(firestore.doc(db,'placesTo',p.id),{status:'deleted',deletedBy:currentUser,deletedFrom:p.status,joeStars:0,noemieStars:0});});if(ok)showUndo(previous);}

const myStarsKey=()=>currentUser==='Joe'?'joeStars':'noemieStars';
const totalStars=p=>(p.joeStars||0)+(p.noemieStars||0);
const placesSpent=()=>placesTo.filter(p=>p.status==='approved').reduce((sum,p)=>sum+(p[myStarsKey()]||0),0);
function placesReady(){return isDemo||(!placesToBusy&&placesToFresh&&canWrite());}
function placesToStatus(){const el=$('places-tab-help');if(!el)return;if(!isDemo&&!placesToFresh){el.textContent='Connecting to your private checklist… actions will be available once connected.';return;}el.textContent={approved:'The more we want it, the higher it ranks. You've each got 10 points to spread across your favourites.',suggested:'Only the other person can approve or veto your suggestion.',done:'Ticked off together. Your 😈 are back in your budgets.'}[placesToTab];}
function setPlacesTab(tab){placesToTab=tab;document.querySelectorAll('.places-tab').forEach(b=>b.classList.toggle('active',b.dataset.listTab===tab));renderPlacesTo();}
function makePlaceButton(text,action,cls='secondary',disabled=false){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.disabled=disabled;b.onclick=action;if(cls==='mini-delete-btn'){b.title='Remove idea';b.setAttribute('aria-label','Remove idea');}return b;}
function renderPlacesTo(){
  if(!$('places-to-list'))return;
  const approved=placesTo.filter(p=>p.status==='approved').sort((a,b)=>totalStars(b)-totalStars(a)||a.name.localeCompare(b.name));
  const suggested=placesTo.filter(p=>p.status==='suggested').sort((a,b)=>a.name.localeCompare(b.name));
  const done=placesTo.filter(p=>p.status==='done').sort((a,b)=>a.name.localeCompare(b.name));
  $('approved-place-count').textContent=approved.length;
  $('suggested-place-count').textContent=suggested.length;
  $('done-place-count').textContent=done.length;
  $('my-stars-left').textContent=Math.max(0,10-placesSpent());
  placesToStatus();
  const records={approved,suggested,done}[placesToTab],root=$('places-to-list');
  root.replaceChildren();
  if(!records.length){
    const empty=document.createElement('div');empty.className='places-empty';
    empty.textContent={approved:'Nothing approved yet — suggest your first place 👀',suggested:'No suggestions waiting right now.',done:'Nothing ticked off yet. The best bits are still to come.'}[placesToTab];
    root.append(empty);
  }else{
    const wrap=document.createElement('div');wrap.className='places-table-wrap';
    const table=document.createElement('table');table.className='places-priority-table';
    const thead=document.createElement('thead');const hr=document.createElement('tr');
    const labels=placesToTab==='approved'?['#','Place','Joe 😈','Noémie 😈','Total 😈','Your 😈','']:
      placesToTab==='suggested'?['Place','Suggested by','Decision']:['Place','Status'];
    labels.forEach((label,i)=>{const th=document.createElement('th');th.textContent=label;if(placesToTab==='approved'&&i===0)th.className='rank-col';hr.append(th);});
    thead.append(hr);table.append(thead);
    const tbody=document.createElement('tbody');
    const cell=(row,value,cls='')=>{const td=document.createElement('td');td.className=cls;if(value instanceof Node)td.append(value);else td.textContent=value;row.append(td);return td;};
    records.forEach((p,i)=>{
      const tr=document.createElement('tr');tr.className='priority-row';
      if(placesToTab==='approved'){
        if(i===0&&totalStars(p)>0)tr.classList.add('top-priority');
        cell(tr,String(i+1),'rank-col');
        const nameCell=cell(tr,p.name,'priority-name');nameCell.title=p.notes||p.name;
        cell(tr,String(p.joeStars||0),'star-count');
        cell(tr,String(p.noemieStars||0),'star-count');
        const score=document.createElement('strong');score.className='total-score';score.textContent=String(totalStars(p));
        cell(tr,score,'score-cell');
        const controls=document.createElement('div');controls.className='compact-star-controls';
        const own=p[myStarsKey()]||0;
        controls.append(makePlaceButton('−',()=>adjustPlacesStars(p,-1),'mini-star-btn',!placesReady()||own===0));
        const count=document.createElement('span');count.className='own-stars';count.textContent=String(own);count.title='Your allocated 😈';controls.append(count);
        controls.append(makePlaceButton('+',()=>adjustPlacesStars(p,1),'mini-star-btn',!placesReady()||placesSpent()>=10));
        cell(tr,controls,'controls-cell');
        const actions=document.createElement('div');actions.className='compact-row-actions';
        actions.append(makePlaceButton('✓ Done',()=>markPlaceDone(p),'mini-done-btn',!placesReady()));
        actions.append(makePlaceButton('🗑️',()=>removePlace(p),'mini-delete-btn',!placesReady()));
        cell(tr,actions,'done-cell');
      }else if(placesToTab==='suggested'){
        const nameCell=cell(tr,p.name,'priority-name');nameCell.title=p.notes||p.name;
        cell(tr,p.addedBy,'suggest-author');
        if(p.addedBy!==currentUser){const actions=document.createElement('div');actions.className='compact-decision';
          actions.append(makePlaceButton('Approve ✓',()=>decidePlace(p,'approved'),'mini-approve-btn',!placesReady()));
          actions.append(makePlaceButton('Veto',()=>decidePlace(p,'vetoed'),'mini-done-btn',!placesReady()));
          actions.append(makePlaceButton('🗑️',()=>removePlace(p),'mini-delete-btn',!placesReady()));cell(tr,actions,'decision-cell');
        }else{const controls=document.createElement('div');controls.className='compact-row-actions';controls.append(document.createTextNode(`Waiting for ${otherUser(currentUser)} `));controls.append(makePlaceButton('🗑️',()=>removePlace(p),'mini-delete-btn',!placesReady()));cell(tr,controls,'pending-cell');}
      }else{
        cell(tr,p.name,'priority-name');const doneControls=document.createElement('div');doneControls.className='compact-row-actions';doneControls.append(document.createTextNode('✓ Completed '));doneControls.append(makePlaceButton('🗑️',()=>removePlace(p),'mini-delete-btn',!placesReady()));cell(tr,doneControls,'completed-cell');
      }
      tbody.append(tr);
    });
    table.append(tbody);wrap.append(table);root.append(wrap);
  }
  const count=incoming().length+placesToIncoming().length;
  $('notifications-count').textContent=count;
  $('notifications-btn').classList.toggle('has-new',count>0);
  renderNotifications();refreshHome();
}
function loadDemoPlacesTo(){try{const data=JSON.parse(localStorage.getItem('our-places-to-demo'));placesTo=Array.isArray(data)?data:[];}catch{placesTo=[];}placesToFresh=true;renderPlacesTo();}
function saveDemoPlacesTo(){localStorage.setItem('our-places-to-demo',JSON.stringify(placesTo));renderPlacesTo();}
function startPlacesToListener(){if(unsubscribePlacesTo)unsubscribePlacesTo();placesToFresh=false;placesToStatus();unsubscribePlacesTo=firestore.onSnapshot(firestore.collection(db,'placesTo'),{includeMetadataChanges:true},snap=>{placesTo=snap.docs.map(d=>({id:d.id,...d.data()}));placesToFresh=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;renderPlacesTo();},err=>{placesToFresh=false;placesToStatus();notify('Checklist connection failed: '+err.message);});}
async function placesToWrite(operation,button){if(!placesReady()){notify('Checklist not connected. No changes were submitted.');return false;}placesToBusy=true;if(button){button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Saving…';}
  try{await operation();notify('Saved ✓');return true;}catch(err){notify('Could not save checklist: '+err.message);return false;}
  finally{placesToBusy=false;if(button){button.textContent=button.dataset.originalText||button.textContent;}renderPlacesTo();}
}
async function suggestPlaceTo(e){e.preventDefault();const name=$('places-idea-name').value.trim(),notes=$('places-idea-note').value.trim();if(!name)return;const b=$('places-suggest-save');const record={name,notes,addedBy:currentUser,status:'suggested',reviewedBy:'',joeStars:0,noemieStars:0,createdAt:new Date()};
  const ok=await placesToWrite(async()=>{if(isDemo){placesTo.push({...record,id:crypto.randomUUID()});saveDemoPlacesTo();}else await firestore.addDoc(firestore.collection(db,'placesTo'),{...record,createdAt:firestore.serverTimestamp()});},b);
  if(ok){$('places-suggest-modal').hidden=true;$('places-suggest-form').reset();setPlacesTab('suggested');}
}
async function decidePlace(p,status){const ok=await placesToWrite(async()=>{if(p.status!=='suggested'||p.addedBy===currentUser)throw Error('Only the other person can decide.');if(isDemo){Object.assign(p,{status,reviewedBy:currentUser});saveDemoPlacesTo();}else await firestore.updateDoc(firestore.doc(db,'placesTo',p.id),{status,reviewedBy:currentUser});});if(ok)setPlacesTab('approved');}
async function adjustPlacesStars(p,delta){await placesToWrite(async()=>{
  const key=myStarsKey();if(isDemo){const next=p[key]+delta;if(next<0||next>10||placesSpent()+delta>10)throw Error('You only have 10 😈. Reallocate another first.');p[key]=next;saveDemoPlacesTo();return;}
  // Read currently approved records in a transaction, so concurrent edits to the
  // same records cannot silently overspend the ten-star budget.
  const refs=placesTo.filter(x=>x.status==='approved').map(x=>firestore.doc(db,'placesTo',x.id));const target=firestore.doc(db,'placesTo',p.id);
  await firestore.runTransaction(db,async tx=>{
    const docs=[];for(const ref of refs)docs.push(await tx.get(ref));
    const current=docs.find(d=>d.id===p.id);if(!current?.exists()||current.data().status!=='approved')throw Error('This place is no longer approved.');
    const spent=docs.filter(d=>d.exists()&&d.data().status==='approved').reduce((a,d)=>a+(d.data()[key]||0),0);
    const old=current.data()[key]||0,next=old+delta;
    if(next<0||next>10||spent+delta>10)throw Error("You've spent all 10 😈. Move some from another idea first.");
    tx.update(target,{[key]:next});
  });
});}
async function markPlaceDone(p){if(!confirm(`Tick off “${p.name}”? Your 😈 will return to both of you.`))return;
  const ok=await placesToWrite(async()=>{if(isDemo){Object.assign(p,{status:'done',joeStars:0,noemieStars:0});saveDemoPlacesTo();}else await firestore.updateDoc(firestore.doc(db,'placesTo',p.id),{status:'done',joeStars:0,noemieStars:0});});if(ok)setPlacesTab('done');
}
function bindPlacesTo(){$('undo-button').onclick=undoPlace;$('undo-dismiss').onclick=hideUndo;$('places-surprise').onclick=()=>{const options=placesTo.filter(p=>p.status==='approved');if(!options.length)return notify('Approve some ideas first 👀');const pick=options[Math.floor(Math.random()*options.length)];notify('🎲 Dodo picked: '+pick.name+' 😈');};document.querySelectorAll('.places-tab').forEach(b=>b.onclick=()=>setPlacesTab(b.dataset.listTab));$('places-suggest').onclick=()=>{if(!placesReady())return notify('Wait until the checklist is connected.');$('places-suggest-modal').hidden=false;};
  $('places-suggest-close').onclick=$('places-suggest-cancel').onclick=()=>$('places-suggest-modal').hidden=true;
  $('places-suggest-modal').addEventListener('click',e=>{if(e.target===$('places-suggest-modal'))e.target.hidden=true;});
  $('places-suggest-form').addEventListener('submit',suggestPlaceTo);
}

main();

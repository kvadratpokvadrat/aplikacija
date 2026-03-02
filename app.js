import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, getDocs, query, where } 
from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
apiKey: "AIzaSyBt7ZmogAfvQrp2TZ-TaT8haZO-Q5BUrkY",
authDomain: "evidencija-1b5b1.firebaseapp.com",
projectId: "evidencija-1b5b1",
storageBucket: "evidencija-1b5b1.firebasestorage.app",
messagingSenderId: "375704932512",
appId: "1:375704932512:web:e893c08cd9b702f7ba39c5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginBtn = document.getElementById("loginBtn");
const addCall = document.getElementById("addCall");
const search = document.getElementById("search");

let selectedCall = null;

loginBtn.onclick = () => {
signInWithEmailAndPassword(auth, email.value, password.value);
};

onAuthStateChanged(auth, user=>{
if(user){
login.style.display="none";
appDiv.style.display="block";
loadAll();
}
});

async function loadAll(){
loadCalls();
loadFields();
stats();
}

async function addNewCall(){
let q = query(collection(db,"calls"), where("telefon","==",telefon.value));
let snap = await getDocs(q);
if(!snap.empty){ alert("Telefon postoji!"); return; }

await addDoc(collection(db,"calls"),{
ime:ime.value,
sifra:sifra.value,
adresa:adresa.value,
telefon:telefon.value,
datumPoziva:datumPoziva.value,
agent:agent.value,
ponuda:ponuda.value,
ishod:ishod.value,
teren:false
});
}

addCall.onclick = addNewCall;

function loadCalls(){
onSnapshot(collection(db,"calls"), snap=>{
callsTable.innerHTML="";
snap.forEach(docu=>{
let d=docu.data();
callsTable.innerHTML+=`
<tr class="${d.teren?'green':''}">
<td>${d.ime}</td>
<td>${d.sifra}</td>
<td>${d.telefon}</td>
<td>${d.agent}</td>
<td><input value="${d.ishod||""}" onchange="window.updateCall('${docu.id}',this.value)"></td>
<td>${d.teren?'Zakazan':'-'}</td>
<td>
<button onclick="window.schedule('${docu.id}')">Teren</button>
<button class="danger" onclick="window.del('calls','${docu.id}')">X</button>
</td>
</tr>`;
});
});
}

window.updateCall = async (id,val)=>{
await updateDoc(doc(db,"calls",id),{ishod:val});
}

window.schedule = (id)=>{
selectedCall=id;
modal.style.display="block";
}

confirmField.onclick = async ()=>{
let callDoc = doc(db,"calls",selectedCall);
let callSnap = await getDocs(query(collection(db,"calls")));
let single = await getDocs(query(collection(db,"calls"),where("__name__","==",selectedCall)));
let data = single.docs[0].data();

await addDoc(collection(db,"fieldVisits"),{
ime:data.ime,
datumTeren:datumTeren.value,
ishodTeren:"",
agent:data.agent
});

await updateDoc(callDoc,{teren:true});
modal.style.display="none";
}

function loadFields(){
onSnapshot(collection(db,"fieldVisits"), snap=>{
fieldTable.innerHTML="";
snap.forEach(docu=>{
let d=docu.data();
fieldTable.innerHTML+=`
<tr>
<td>${d.ime}</td>
<td>${d.datumTeren}</td>
<td><input value="${d.ishodTeren||""}" onchange="window.updateField('${docu.id}',this.value)"></td>
<td><button class="danger" onclick="window.del('fieldVisits','${docu.id}')">X</button></td>
</tr>`;
});
});
}

window.updateField = async(id,val)=>{
await updateDoc(doc(db,"fieldVisits",id),{ishodTeren:val});
}

window.del = async(col,id)=>{
await deleteDoc(doc(db,col,id));
}

search.oninput = ()=>{
let val = search.value.toLowerCase();
document.querySelectorAll("#callsTable tr").forEach(r=>{
r.style.display = r.innerText.toLowerCase().includes(val) ? "" : "none";
});
}

async function stats(){
let calls = await getDocs(collection(db,"calls"));
let fields = await getDocs(collection(db,"fieldVisits"));

stats.innerHTML=`
<div class="stat">Pozivi: ${calls.size}</div>
<div class="stat">Tereni: ${fields.size}</div>
<div class="stat">Konverzija: ${calls.size?((fields.size/calls.size)*100).toFixed(1):0}%</div>
`;
}
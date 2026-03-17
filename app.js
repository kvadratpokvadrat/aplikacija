import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "evidencija-1b5b1.firebaseapp.com",
  projectId: "evidencija-1b5b1",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAILS = ["stefanbarac@gmail.com"];

const qs = (id) => document.getElementById(id);

let state = {
  user: null,
  isAdmin: false,
  calls: [],
  fields: [],
};

function daysDiff(ymd) {
  if (!ymd) return 0;
  const today = new Date();
  const d = new Date(ymd);
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function getStaleItems() {
  return {
    staleCalls: state.calls.filter(c =>
      !c.statusPoziva && !c.teren && daysDiff(c.datumPoziva) > 3
    ),
    staleFields: state.fields.filter(f =>
      !f.realizovan && daysDiff(f.datumTeren) > 3
    )
  };
}

function renderAlerts() {
  const list = qs("notifList");
  const badge = qs("notifBadge");

  if (!list) return;

  const { staleCalls, staleFields } = getStaleItems();
  const total = staleCalls.length + staleFields.length;

  if (badge) {
    badge.textContent = total;
    badge.classList.toggle("hidden", total === 0);
  }

  list.innerHTML = `
    ${staleCalls.map(c=>`
      <div class="notif-item" onclick="_goToCall('${c.id}')">
        ${c.ime} · ${daysDiff(c.datumPoziva)} dana
      </div>
    `).join("")}

    ${staleFields.map(f=>`
      <div class="notif-item" onclick="_goToField('${f.id}')">
        ${f.ime} · ${daysDiff(f.datumTeren)} dana
      </div>
    `).join("")}
  `;
}

window._goToCall = (id)=>{
  localStorage.setItem("focusCall", id);
  location.href="calls.html";
}

window._goToField = (id)=>{
  localStorage.setItem("focusField", id);
  location.href="fields.html";
}

function renderCalendar() {
  const el = qs("calendar");
  if (!el) return;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  let first = new Date(y, m, 1).getDay();
  first = first === 0 ? 6 : first - 1;

  const days = new Date(y, m + 1, 0).getDate();

  el.innerHTML = "";

  for (let i = 0; i < first; i++) el.innerHTML += "<div></div>";

  for (let d = 1; d <= days; d++) {
    const date = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

    const events = state.fields.filter(f => f.datumTeren === date);

    el.innerHTML += `
      <div class="day">
        <b>${d}</b>
        ${events.map(e=>`<div class="event">${e.ime}</div>`).join("")}
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", () => {

  const notifBtn = qs("notifBtn");
  const dropdown = qs("notifDropdown");

  if (notifBtn && dropdown) {
    notifBtn.onclick = () => dropdown.classList.toggle("hidden");
  }

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.isAdmin = user && ADMIN_EMAILS.includes(user.email);

    if (user) boot();
  });

});

function boot() {

  onSnapshot(collection(db, "calls"), snap => {
    state.calls = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderCalls();
    renderAlerts();
  });

  onSnapshot(collection(db, "fieldVisits"), snap => {
    state.fields = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderFields();
    renderCalendar();
    renderAlerts();
  });
}

function renderCalls() {
  const table = qs("callsTable");
  if (!table) return;

  table.innerHTML = state.calls.map(c=>`
    <tr data-id="${c.id}">
      <td>${c.ime}</td>
      <td>${c.telefon}</td>
      <td>
        <input type="checkbox" ${c.statusPoziva?"checked":""}
        onchange="_toggle('${c.id}',this.checked)">
      </td>
    </tr>
  `).join("");

  const focus = localStorage.getItem("focusCall");
  if (focus) {
    const row = document.querySelector(`[data-id="${focus}"]`);
    row?.scrollIntoView();
    row?.classList.add("row-focus");
    localStorage.removeItem("focusCall");
  }
}

function renderFields() {
  const table = qs("fieldTable");
  if (!table) return;

  table.innerHTML = state.fields.map(f=>`
    <tr data-id="${f.id}">
      <td>${f.ime}</td>
      <td>${f.telefon}</td>
      <td>${f.datumTeren}</td>
      <td>
        <input type="checkbox" ${f.realizovan?"checked":""}
        onchange="_real('${f.id}',this.checked)">
      </td>
    </tr>
  `).join("");

  const focus = localStorage.getItem("focusField");
  if (focus) {
    const row = document.querySelector(`[data-id="${focus}"]`);
    row?.scrollIntoView();
    row?.classList.add("row-focus");
    localStorage.removeItem("focusField");
  }
}

window._toggle = async (id,val)=>{
  await updateDoc(doc(db,"calls",id),{statusPoziva:val});
}

window._real = async (id,val)=>{
  await updateDoc(doc(db,"fieldVisits",id),{realizovan:val});
}

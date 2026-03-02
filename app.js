import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
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
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBt7ZmogAfvQrp2TZ-TaT8haZO-Q5BUrkY",
  authDomain: "evidencija-1b5b1.firebaseapp.com",
  projectId: "evidencija-1b5b1",
  storageBucket: "evidencija-1b5b1.firebasestorage.app",
  messagingSenderId: "375704932512",
  appId: "1:375704932512:web:e893c08cd9b702f7ba39c5"
};

// UBACI ADMIN MEJLOVE
const ADMIN_EMAILS = [
  // "admin@tvoja-firma.rs",
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const addCall = document.getElementById("addCall");
const search = document.getElementById("search");
const statsDiv = document.getElementById("stats");
const monthPick = document.getElementById("monthPick");
const monthToday = document.getElementById("monthToday");
const sortBy = document.getElementById("sortBy");
const whoami = document.getElementById("whoami");

const datumPoziva = document.getElementById("datumPoziva");
const ponudaAgent = document.getElementById("ponudaAgent");

const datumTeren = document.getElementById("datumTeren");
const vremeTeren = document.getElementById("vremeTeren");

const manualFieldBtn = document.getElementById("manualField");
const manualModal = document.getElementById("manualModal");
const saveManualField = document.getElementById("saveManualField");
const cancelManualField = document.getElementById("cancelManualField");

const mIme = document.getElementById("mIme");
const mDatumTeren = document.getElementById("mDatumTeren");
const mVremeTeren = document.getElementById("mVremeTeren");
const mIshodTeren = document.getElementById("mIshodTeren");
const mRadniNalog = document.getElementById("mRadniNalog");

// State
let selectedCall = null;
let currentUser = null;
let isAdmin = false;

// ===== Helpers =====
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthISO(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function defaultTime() {
  // promeni ako hoćeš trenutno vreme umesto fiksno
  return "10:00";
}

function inSelectedMonth(dateStr, monthStr) {
  if (!dateStr) return false;
  return String(dateStr).startsWith(monthStr); // "YYYY-MM"
}

function safeLower(x) {
  return String(x ?? "").toLowerCase();
}

// Defaulti
datumPoziva.value = todayISO();
datumTeren.value = todayISO();
vremeTeren.value = defaultTime();
monthPick.value = monthISO();

mDatumTeren.value = todayISO();
mVremeTeren.value = defaultTime();

// ===== Auth =====
loginBtn.onclick = () => {
  signInWithEmailAndPassword(auth, email.value, password.value);
};

logoutBtn.onclick = async () => {
  await signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    isAdmin = ADMIN_EMAILS.includes(user.email || "");
    whoami.textContent = `${user.email}${isAdmin ? " (ADMIN)" : ""}`;
    logoutBtn.style.display = "inline-block";

    login.style.display = "none";
    appDiv.style.display = "block";

    // uvek danas na ulazu
    datumPoziva.value = todayISO();
    datumTeren.value = todayISO();
    vremeTeren.value = defaultTime();
    monthPick.value = monthISO();

    wireUI();
    loadAll();
  } else {
    isAdmin = false;
    whoami.textContent = "";
    logoutBtn.style.display = "none";

    appDiv.style.display = "none";
    login.style.display = "block";
  }
});

// ===== UI wiring =====
function wireUI() {
  monthToday.onclick = () => {
    monthPick.value = monthISO();
    refreshAllViews();
  };

  monthPick.onchange = refreshAllViews;
  sortBy.onchange = refreshAllViews;

  cancelField.onclick = () => {
    modal.style.display = "none";
    selectedCall = null;
  };

  search.oninput = () => {
    refreshCallsTableOnly();
  };

  manualFieldBtn.onclick = () => {
    mIme.value = "";
    mDatumTeren.value = todayISO();
    mVremeTeren.value = defaultTime();
    mIshodTeren.value = "";
    mRadniNalog.checked = false;

    // samo admin može čekirati RN
    mRadniNalog.disabled = !isAdmin;

    manualModal.style.display = "block";
  };

  cancelManualField.onclick = () => {
    manualModal.style.display = "none";
  };

  saveManualField.onclick = saveManualFieldVisit;
}

// ===== Data caches =====
let callsCache = [];   // {id, ...data}
let fieldsCache = [];  // {id, ...data}

async function loadAll() {
  loadCallsLive();
  loadFieldsLive();
  await refreshAllViews();
}

function refreshAllViews() {
  refreshCallsTableOnly();
  refreshFieldsTableOnly();
  statsAndChart();
}

// ===== CALLS =====
async function addNewCall() {
  // duplikat telefon
  const q1 = query(collection(db, "calls"), where("telefon", "==", telefon.value));
  const snap = await getDocs(q1);
  if (!snap.empty) {
    alert("Telefon postoji!");
    return;
  }

  const gen = ponudaAgent.value || "";

  await addDoc(collection(db, "calls"), {
    ime: ime.value,
    sifra: sifra.value,
    adresa: adresa.value,
    telefon: telefon.value,
    datumPoziva: datumPoziva.value || todayISO(),

    // samo "Generisao ponudu"
    ponudaAgent: gen,

    // kompatibilnost (da ti ne puca logika gde se koristi agent)
    agent: gen,

    ishod: ishod.value,
    teren: false,

    statusPoziva: false
  });

  // reset (datum ostaje)
  ime.value = "";
  sifra.value = "";
  adresa.value = "";
  telefon.value = "";
  ishod.value = "";
  ponudaAgent.value = "";
}

addCall.onclick = addNewCall;

function loadCallsLive() {
  onSnapshot(collection(db, "calls"), (snap) => {
    callsCache = [];
    snap.forEach((docu) => callsCache.push({ id: docu.id, ...docu.data() }));
    refreshCallsTableOnly();
    statsAndChart();
  });
}

function sortItems(items) {
  const v = sortBy.value;
  const [field, dir] = v.split("_");
  const mul = dir === "asc" ? 1 : -1;

  items.sort((a, b) => {
    const av = a[field];
    const bv = b[field];

    if (typeof av === "boolean" || typeof bv === "boolean") {
      return (Number(av) - Number(bv)) * mul;
    }

    if (field.includes("datum")) {
      return String(av ?? "").localeCompare(String(bv ?? "")) * mul;
    }

    return String(av ?? "").localeCompare(String(bv ?? "")) * mul;
  });

  return items;
}

function refreshCallsTableOnly() {
  const monthStr = monthPick.value; // YYYY-MM
  const q = safeLower(search.value);

  let filtered = callsCache.filter((c) => inSelectedMonth(c.datumPoziva, monthStr));

  if (q) {
    filtered = filtered.filter((c) => {
      const all = `${c.ime} ${c.sifra} ${c.telefon} ${c.ponudaAgent} ${c.ishod} ${c.datumPoziva}`.toLowerCase();
      return all.includes(q);
    });
  }

  sortItems(filtered);

  callsTable.innerHTML = "";
  filtered.forEach((c) => {
    const statusBadge = c.teren ? `<span class="badge ok">Zakazan</span>` : `<span class="badge">-</span>`;
    const pozivBadge = c.statusPoziva ? `<span class="badge ok">Čekirano</span>` : `<span class="badge no">Nije</span>`;

    const statusCheckbox = isAdmin
      ? `<input type="checkbox" ${c.statusPoziva ? "checked" : ""} onchange="window.toggleCallStatus('${c.id}', this.checked)">`
      : (c.statusPoziva ? "✅" : "—");

    const delBtn = isAdmin
      ? `<button class="danger" onclick="window.delDoc('calls','${c.id}')">X</button>`
      : "";

    const outcomeInput = isAdmin
      ? `<input value="${c.ishod ?? ""}" onchange="window.updateCallOutcome('${c.id}', this.value)">`
      : `<input value="${c.ishod ?? ""}" disabled>`;

    callsTable.innerHTML += `
      <tr class="${c.teren ? "green" : ""}">
        <td>${c.ime ?? ""}</td>
        <td>${c.sifra ?? ""}</td>
        <td>${c.telefon ?? ""}</td>
        <td>${c.ponudaAgent ?? ""}</td>
        <td>${outcomeInput}</td>
        <td>${statusCheckbox}</td>
        <td>${statusBadge} ${pozivBadge}</td>
        <td>
          <button onclick="window.schedule('${c.id}')">Teren</button>
          ${delBtn}
        </td>
      </tr>
    `;
  });
}

window.updateCallOutcome = async (id, val) => {
  if (!isAdmin) return;
  await updateDoc(doc(db, "calls", id), { ishod: val });
};

window.toggleCallStatus = async (id, checked) => {
  if (!isAdmin) return;
  await updateDoc(doc(db, "calls", id), { statusPoziva: !!checked });
};

window.schedule = (id) => {
  selectedCall = id;
  datumTeren.value = todayISO();
  vremeTeren.value = defaultTime();
  modal.style.display = "block";
};

confirmField.onclick = async () => {
  if (!selectedCall) return;

  const single = await getDocs(query(collection(db, "calls"), where("__name__", "==", selectedCall)));
  if (single.empty) {
    alert("Ne mogu da nađem poziv.");
    return;
  }

  const data = single.docs[0].data();
  const agentVal = data.ponudaAgent ?? data.agent ?? "";

  await addDoc(collection(db, "fieldVisits"), {
    ime: data.ime ?? "",
    datumTeren: datumTeren.value || todayISO(),
    vremeTeren: vremeTeren.value || defaultTime(),
    ishodTeren: "",
    agent: agentVal,
    radniNalog: false
  });

  await updateDoc(doc(db, "calls", selectedCall), { teren: true });

  modal.style.display = "none";
  selectedCall = null;
};

// ===== FIELDS =====
function loadFieldsLive() {
  onSnapshot(collection(db, "fieldVisits"), (snap) => {
    fieldsCache = [];
    snap.forEach((docu) => fieldsCache.push({ id: docu.id, ...docu.data() }));
    refreshFieldsTableOnly();
    statsAndChart();
  });
}

function refreshFieldsTableOnly() {
  const monthStr = monthPick.value;

  const filtered = fieldsCache
    .filter((f) => inSelectedMonth(f.datumTeren, monthStr))
    .sort((a, b) => String(b.datumTeren ?? "").localeCompare(String(a.datumTeren ?? "")));

  fieldTable.innerHTML = "";
  filtered.forEach((f) => {
    const rn = isAdmin
      ? `<input type="checkbox" ${f.radniNalog ? "checked" : ""} onchange="window.toggleRadniNalog('${f.id}', this.checked)">`
      : (f.radniNalog ? "✅" : "—");

    const delBtn = isAdmin
      ? `<button class="danger" onclick="window.delDoc('fieldVisits','${f.id}')">X</button>`
      : "";

    const outcomeInput = isAdmin
      ? `<input value="${f.ishodTeren ?? ""}" onchange="window.updateFieldOutcome('${f.id}', this.value)">`
      : `<input value="${f.ishodTeren ?? ""}" disabled>`;

    fieldTable.innerHTML += `
      <tr>
        <td>${f.ime ?? ""}</td>
        <td>${f.datumTeren ?? ""}</td>
        <td>${f.vremeTeren ?? ""}</td>
        <td>${outcomeInput}</td>
        <td>${rn}</td>
        <td>${delBtn}</td>
      </tr>
    `;
  });
}

window.updateFieldOutcome = async (id, val) => {
  if (!isAdmin) return;
  await updateDoc(doc(db, "fieldVisits", id), { ishodTeren: val });
};

window.toggleRadniNalog = async (id, checked) => {
  if (!isAdmin) return;
  await updateDoc(doc(db, "fieldVisits", id), { radniNalog: !!checked });
};

window.delDoc = async (col, id) => {
  if (!isAdmin) return;
  await deleteDoc(doc(db, col, id));
};

// ===== Manual field save =====
async function saveManualFieldVisit() {
  const imeVal = (mIme.value || "").trim();
  if (!imeVal) { alert("Upiši ime."); return; }

  await addDoc(collection(db, "fieldVisits"), {
    ime: imeVal,
    datumTeren: mDatumTeren.value || todayISO(),
    vremeTeren: mVremeTeren.value || defaultTime(),
    ishodTeren: mIshodTeren.value || "",
    radniNalog: isAdmin ? !!mRadniNalog.checked : false
  });

  manualModal.style.display = "none";
}

// ===== STATS + CHART =====
async function statsAndChart() {
  const monthStr = monthPick.value;

  const callsMonth = callsCache.filter((c) => inSelectedMonth(c.datumPoziva, monthStr));
  const fieldsMonth = fieldsCache.filter((f) => inSelectedMonth(f.datumTeren, monthStr));

  const realizedFields = fieldsMonth.length;
  const conversion = callsMonth.length ? ((fieldsMonth.length / callsMonth.length) * 100).toFixed(1) : "0.0";

  statsDiv.innerHTML = `
    <div class="stat">
      <div class="small">Pozivi (${monthStr})</div>
      <div style="font-size:34px;font-weight:700">${callsMonth.length}</div>
    </div>
    <div class="stat">
      <div class="small">Realizovani tereni (${monthStr})</div>
      <div style="font-size:34px;font-weight:700">${realizedFields}</div>
    </div>
    <div class="stat">
      <div class="small">Konverzija (${monthStr})</div>
      <div style="font-size:34px;font-weight:700">${conversion}%</div>
    </div>
  `;

  drawChartByMonths();
}

function drawChartByMonths() {
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthISO(d)); // "YYYY-MM"
  }

  const counts = months.map((m) => fieldsCache.filter((f) => inSelectedMonth(f.datumTeren, m)).length);
  const max = Math.max(1, ...counts);

  const W = canvas.width;
  const H = canvas.height;
  const padL = 40, padR = 10, padT = 20, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + chartH);
  ctx.lineTo(padL + chartW, padT + chartH);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.stroke();

  const n = months.length;
  const gap = 6;
  const barW = (chartW - gap * (n - 1)) / n;

  counts.forEach((val, i) => {
    const x = padL + i * (barW + gap);
    const h = (val / max) * chartH;
    const y = padT + (chartH - h);

    ctx.fillStyle = "#2563eb";
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = "#0f172a";
    ctx.font = "10px Segoe UI";
    ctx.fillText(months[i].slice(5), x + 2, padT + chartH + 14);

    ctx.fillStyle = "#0f172a";
    ctx.font = "11px Segoe UI";
    ctx.fillText(String(val), x + 2, y - 4);
  });

  ctx.fillStyle = "#0f172a";
  ctx.font = "12px Segoe UI";
  ctx.fillText("Tereni po mesecima (poslednjih 12)", padL, 14);
}

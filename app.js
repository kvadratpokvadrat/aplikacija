import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/** DOM refs */
const login = document.getElementById("login");
const appDiv = document.getElementById("app");

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const email = document.getElementById("email");
const password = document.getElementById("password");

const addCall = document.getElementById("addCall");
const ime = document.getElementById("ime");
const sifra = document.getElementById("sifra");
const adresa = document.getElementById("adresa");
const telefon = document.getElementById("telefon");
const datumPoziva = document.getElementById("datumPoziva");
const agent = document.getElementById("agent");
const ponuda = document.getElementById("ponuda");
const ishod = document.getElementById("ishod");

const callsTable = document.getElementById("callsTable");
const fieldTable = document.getElementById("fieldTable");
const statsEl = document.getElementById("stats");

const modal = document.getElementById("modal");
const datumTeren = document.getElementById("datumTeren");
const confirmField = document.getElementById("confirmField");
const cancelField = document.getElementById("cancelField");

const searchAll = document.getElementById("searchAll");
const monthLabel = document.getElementById("monthLabel");

let selectedCall = null;

/** ===== helpers: date range for current month (YYYY-MM-DD) ===== */
function toYMD(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function getCurrentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start: toYMD(start), end: toYMD(end), y, m };
}
function monthName(m) {
  return ["Januar","Februar","Mart","April","Maj","Jun","Jul","Avgust","Septembar","Oktobar","Novembar","Decembar"][m];
}

/** ===== helpers: basic escaping ===== */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll("\n", " ");
}

/** ===== LOGIN ===== */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch (err) {
    loginError.textContent = err?.message || "Greška pri logovanju.";
  }
});
loginBtn?.addEventListener("click", async () => {
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch (err) {
    loginError.textContent = err?.message || "Greška pri logovanju.";
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    login.style.display = "none";
    appDiv.style.display = "block";
    loadAll();
  } else {
    appDiv.style.display = "none";
    login.style.display = "block";
  }
});

/** ===== Month label ===== */
function renderMonthLabel() {
  const { y, m, start, end } = getCurrentMonthRange();
  monthLabel.textContent = `Prikaz: ${monthName(m)} ${y} (${start} → ${end})`;
}

/** ===== LOAD ===== */
function loadAll() {
  renderMonthLabel();
  loadCallsCurrentMonth();
  loadFieldsCurrentMonth();
  renderStatsCurrentMonth().catch(() => {});
}

/** ===== ADD CALL ===== */
async function addNewCall() {
  const tel = (telefon.value || "").trim();
  if (!tel) { alert("Unesi telefon."); return; }

  // duplikat po telefonu
  const qDup = query(collection(db, "calls"), where("telefon", "==", tel));
  const snapDup = await getDocs(qDup);
  if (!snapDup.empty) { alert("Telefon postoji!"); return; }

  await addDoc(collection(db, "calls"), {
    ime: (ime.value || "").trim(),
    sifra: (sifra.value || "").trim(),
    adresa: (adresa.value || "").trim(),
    telefon: tel,
    datumPoziva: datumPoziva.value || "",
    agent: agent.value || "",
    ponuda: ponuda.value || "",
    ishod: (ishod.value || "").trim(),
    teren: false
  });
}
addCall.addEventListener("click", () => {
  addNewCall().catch((e) => alert(e?.message || "Greška pri upisu."));
});

/** ===== QUERIES: current month only ===== */
function currentMonthCallsQuery() {
  const { start, end } = getCurrentMonthRange();
  return query(
    collection(db, "calls"),
    where("datumPoziva", ">=", start),
    where("datumPoziva", "<=", end)
  );
}
function currentMonthFieldsQuery() {
  const { start, end } = getCurrentMonthRange();
  return query(
    collection(db, "fieldVisits"),
    where("datumTeren", ">=", start),
    where("datumTeren", "<=", end)
  );
}

/** ===== LIST CALLS: current month ===== */
function loadCallsCurrentMonth() {
  const qCalls = currentMonthCallsQuery();

  onSnapshot(qCalls, (snap) => {
    callsTable.innerHTML = "";

    snap.forEach((docu) => {
      const d = docu.data();
      callsTable.innerHTML += `
        <tr class="${d.teren ? "green" : ""}">
          <td>${escapeHtml(d.ime || "")}</td>
          <td>${escapeHtml(d.sifra || "")}</td>
          <td>${escapeHtml(d.telefon || "")}</td>
          <td>${escapeHtml(d.agent || "")}</td>
          <td>
            <input value="${escapeAttr(d.ishod || "")}"
              onchange="window.updateCall('${docu.id}', this.value)">
          </td>
          <td>${d.teren ? "Zakazan" : "-"}</td>
          <td>
            <button onclick="window.schedule('${docu.id}')">Teren</button>
            <button class="danger" onclick="window.delDoc('calls','${docu.id}')">X</button>
          </td>
        </tr>
      `;
    });

    applySearchFilter();
    renderStatsCurrentMonth().catch(() => {});
  });
}

window.updateCall = async (id, val) => {
  await updateDoc(doc(db, "calls", id), { ishod: val });
};

/** ===== TEREN MODAL / VEZA POZIV → TEREN ===== */
window.schedule = (id) => {
  selectedCall = id;
  modal.style.display = "block";
};

cancelField?.addEventListener("click", () => {
  modal.style.display = "none";
  selectedCall = null;
});

confirmField.addEventListener("click", async () => {
  if (!selectedCall) return;

  const callRef = doc(db, "calls", selectedCall);
  const snap = await getDoc(callRef);

  if (!snap.exists()) {
    alert("Poziv nije pronađen (možda je obrisan).");
    modal.style.display = "none";
    selectedCall = null;
    return;
  }

  const data = snap.data();

  // Upis terena + svi ključni podaci + veza callId
  await addDoc(collection(db, "fieldVisits"), {
    callId: selectedCall,           // VEZA NA POZIV
    ime: data.ime || "",
    sifra: data.sifra || "",
    telefon: data.telefon || "",
    agent: data.agent || "",
    datumTeren: datumTeren.value || "",
    ishodTeren: ""
  });

  await updateDoc(callRef, { teren: true });

  modal.style.display = "none";
  selectedCall = null;

  renderStatsCurrentMonth().catch(() => {});
});

/** ===== LIST FIELDS: current month ===== */
function loadFieldsCurrentMonth() {
  const qFields = currentMonthFieldsQuery();

  onSnapshot(qFields, (snap) => {
    fieldTable.innerHTML = "";

    snap.forEach((docu) => {
      const d = docu.data();
      fieldTable.innerHTML += `
        <tr>
          <td>${escapeHtml(d.ime || "")}</td>
          <td>${escapeHtml(d.sifra || "")}</td>
          <td>${escapeHtml(d.telefon || "")}</td>
          <td>${escapeHtml(d.agent || "")}</td>
          <td>${escapeHtml(d.datumTeren || "")}</td>
          <td>
            <input value="${escapeAttr(d.ishodTeren || "")}"
              onchange="window.updateField('${docu.id}', this.value)">
          </td>
          <td>
            <button class="danger" onclick="window.delDoc('fieldVisits','${docu.id}')">X</button>
          </td>
        </tr>
      `;
    });

    applySearchFilter();
    renderStatsCurrentMonth().catch(() => {});
  });
}

window.updateField = async (id, val) => {
  await updateDoc(doc(db, "fieldVisits", id), { ishodTeren: val });
};

window.delDoc = async (col, id) => {
  await deleteDoc(doc(db, col, id));
  renderStatsCurrentMonth().catch(() => {});
};

/** ===== SEARCH: filter BOTH tables ===== */
function applySearchFilter() {
  const val = (searchAll?.value || "").toLowerCase().trim();

  const filterRows = (selector) => {
    document.querySelectorAll(selector).forEach((r) => {
      r.style.display = r.innerText.toLowerCase().includes(val) ? "" : "none";
    });
  };

  filterRows("#callsTable tr");
  filterRows("#fieldTable tr");
}
searchAll?.addEventListener("input", applySearchFilter);

/** ===== STATS: current month only ===== */
async function renderStatsCurrentMonth() {
  const callsSnap = await getDocs(currentMonthCallsQuery());
  const fieldsSnap = await getDocs(currentMonthFieldsQuery());

  const callsCount = callsSnap.size;
  const fieldsCount = fieldsSnap.size;

  const conversion = callsCount ? ((fieldsCount / callsCount) * 100).toFixed(1) : "0.0";

  statsEl.innerHTML = `
    <div class="stat">Pozivi (mesec): ${callsCount}</div>
    <div class="stat">Tereni (mesec): ${fieldsCount}</div>
    <div class="stat">Konverzija (mesec): ${conversion}%</div>
  `;
}

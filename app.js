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

/** =======================
 *  DOM refs (OVO JE FALILO)
 *  ======================= */
const login = document.getElementById("login");
const appDiv = document.getElementById("app");

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

const email = document.getElementById("email");
const password = document.getElementById("password");

const addCall = document.getElementById("addCall");
const search = document.getElementById("search");

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

let selectedCall = null;

/** =======================
 *  LOGIN
 *  ======================= */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch (err) {
    loginError.textContent = err?.message || "Greška pri logovanju.";
  }
});

// ako nema forme (fallback)
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
    // ako se izloguje
    appDiv.style.display = "none";
    login.style.display = "block";
  }
});

/** =======================
 *  LOAD
 *  ======================= */
async function loadAll() {
  loadCalls();
  loadFields();
  renderStats();
}

/** =======================
 *  ADD CALL
 *  ======================= */
async function addNewCall() {
  const tel = (telefon.value || "").trim();

  if (!tel) {
    alert("Unesi telefon.");
    return;
  }

  // duplikat po telefonu
  const q = query(collection(db, "calls"), where("telefon", "==", tel));
  const snap = await getDocs(q);
  if (!snap.empty) {
    alert("Telefon postoji!");
    return;
  }

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

  // opcionalno: očisti formu
  // ime.value = sifra.value = adresa.value = telefon.value = ishod.value = "";
}

addCall.addEventListener("click", () => {
  addNewCall().catch((e) => alert(e?.message || "Greška pri upisu."));
});

/** =======================
 *  LIST CALLS
 *  ======================= */
function loadCalls() {
  onSnapshot(collection(db, "calls"), (snap) => {
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

    // refresh stats kad se promene podaci
    renderStats().catch(() => {});
  });
}

window.updateCall = async (id, val) => {
  await updateDoc(doc(db, "calls", id), { ishod: val });
};

/** =======================
 *  TEREN MODAL
 *  ======================= */
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

  await addDoc(collection(db, "fieldVisits"), {
    ime: data.ime || "",
    datumTeren: datumTeren.value || "",
    ishodTeren: "",
    agent: data.agent || ""
  });

  await updateDoc(callRef, { teren: true });

  modal.style.display = "none";
  selectedCall = null;

  renderStats().catch(() => {});
});

/** =======================
 *  LIST FIELDS
 *  ======================= */
function loadFields() {
  onSnapshot(collection(db, "fieldVisits"), (snap) => {
    fieldTable.innerHTML = "";
    snap.forEach((docu) => {
      const d = docu.data();
      fieldTable.innerHTML += `
        <tr>
          <td>${escapeHtml(d.ime || "")}</td>
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

    renderStats().catch(() => {});
  });
}

window.updateField = async (id, val) => {
  await updateDoc(doc(db, "fieldVisits", id), { ishodTeren: val });
};

window.delDoc = async (col, id) => {
  await deleteDoc(doc(db, col, id));
  renderStats().catch(() => {});
};

/** =======================
 *  SEARCH FILTER
 *  ======================= */
search.addEventListener("input", () => {
  const val = (search.value || "").toLowerCase();
  document.querySelectorAll("#callsTable tr").forEach((r) => {
    r.style.display = r.innerText.toLowerCase().includes(val) ? "" : "none";
  });
});

/** =======================
 *  STATS (preimenovano)
 *  ======================= */
async function renderStats() {
  const calls = await getDocs(collection(db, "calls"));
  const fields = await getDocs(collection(db, "fieldVisits"));

  const conversion = calls.size ? ((fields.size / calls.size) * 100).toFixed(1) : "0.0";

  statsEl.innerHTML = `
    <div class="stat">Pozivi: ${calls.size}</div>
    <div class="stat">Tereni: ${fields.size}</div>
    <div class="stat">Konverzija: ${conversion}%</div>
  `;
}

/** =======================
 *  helpers: basic escaping
 *  ======================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  // za value=""
  return escapeHtml(str).replaceAll("\n", " ");
}

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
  apiKey: "AIzaSyBt7ZmogAfvQrp2TZ-TaT8haZO-Q5BUrkY",
  authDomain: "evidencija-1b5b1.firebaseapp.com",
  projectId: "evidencija-1b5b1",
  storageBucket: "evidencija-1b5b1.firebasestorage.app",
  messagingSenderId: "375704932512",
  appId: "1:375704932512:web:e893c08cd9b702f7ba39c5",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// OVDE upiši admin email(ove)
const ADMIN_EMAILS = [
  "stefanbarac@gmail.com",
];

const AGENTS = ["Marija", "Slavko", "Jovan"];

function isAdminEmail(email) {
  return ADMIN_EMAILS.map(e => e.toLowerCase().trim()).includes(String(email || "").toLowerCase().trim());
}

function toYMD(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function monthKeyFromYMD(ymd) {
  if (!ymd || typeof ymd !== "string") return "";
  return ymd.slice(0, 7);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRangeFromMonthKey(key) {
  const [y, m] = key.split("-").map(x => parseInt(x, 10));
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start: toYMD(start), end: toYMD(end) };
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll("\n", " ");
}

function drawBarChart(canvas, labels, values) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const padL = 55;
  const padR = 20;
  const padT = 25;
  const padB = 45;

  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxVal = Math.max(1, ...values);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const steps = 5;
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.font = "12px Segoe UI";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "right";

  for (let i = 0; i <= steps; i++) {
    const y = padT + (chartH / steps) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();

    const val = Math.round(maxVal - (maxVal / steps) * i);
    ctx.fillText(String(val), padL - 8, y + 4);
  }

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + chartH);
  ctx.lineTo(padL + chartW, padT + chartH);
  ctx.stroke();

  const count = Math.max(values.length, 1);
  const gap = 14;
  const barW = Math.max(18, Math.floor((chartW - gap * (count - 1)) / count));

  values.forEach((v, i) => {
    const x = padL + i * (barW + gap);
    const h = Math.round((v / maxVal) * (chartH - 8));
    const y = padT + chartH - h;

    ctx.fillStyle = "#2563eb";
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(String(v), x + barW / 2, y - 8);

    ctx.fillStyle = "#475569";
    ctx.font = "12px Segoe UI";
    ctx.fillText(labels[i] || "", x + barW / 2, padT + chartH + 20);
  });
}

let state = {
  user: null,
  isAdmin: false,
  selectedMonth: currentMonthKey(),
  selectedCallId: null,
  calls: [],
  fields: [],
};

document.addEventListener("DOMContentLoaded", () => {
  const login = document.getElementById("login");
  const appDiv = document.getElementById("app");

  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");

  const whoami = document.getElementById("whoami");
  const logoutBtn = document.getElementById("logoutBtn");

  const monthPick = document.getElementById("monthPick");
  const monthToday = document.getElementById("monthToday");
  const sortBy = document.getElementById("sortBy");

  const statsEl = document.getElementById("stats");
  const chartCanvas = document.getElementById("chart");
  const toggleChart = document.getElementById("toggleChart");
  const chartWrap = document.getElementById("chartWrap");

  const ime = document.getElementById("ime");
  const sifra = document.getElementById("sifra");
  const adresa = document.getElementById("adresa");
  const telefon = document.getElementById("telefon");
  const datumPoziva = document.getElementById("datumPoziva");
  const ponudaAgent = document.getElementById("ponudaAgent");
  const ishod = document.getElementById("ishod");
  const addCall = document.getElementById("addCall");

  const search = document.getElementById("search");
  const callsTable = document.getElementById("callsTable");

  const fieldTable = document.getElementById("fieldTable");
  const manualField = document.getElementById("manualField");

  const modal = document.getElementById("modal");
  const datumTeren = document.getElementById("datumTeren");
  const vremeTeren = document.getElementById("vremeTeren");
  const confirmField = document.getElementById("confirmField");
  const cancelField = document.getElementById("cancelField");

  const manualModal = document.getElementById("manualModal");
  const mIme = document.getElementById("mIme");
  const mAdresa = document.getElementById("mAdresa");
  const mTelefon = document.getElementById("mTelefon");
  const mDatumTeren = document.getElementById("mDatumTeren");
  const mVremeTeren = document.getElementById("mVremeTeren");
  const mIshodTeren = document.getElementById("mIshodTeren");
  const mRadniNalog = document.getElementById("mRadniNalog");
  const saveManualField = document.getElementById("saveManualField");
  const cancelManualField = document.getElementById("cancelManualField");

  let unsubCalls = null;
  let unsubFields = null;
  let chartVisible = false;

  datumPoziva.value = toYMD(new Date());
  monthPick.value = state.selectedMonth;

  loginBtn.addEventListener("click", async () => {
    try {
      await signInWithEmailAndPassword(auth, email.value, password.value);
    } catch (e) {
      alert(e?.message || "Login greška");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.isAdmin = !!user && isAdminEmail(user.email);

    if (user) {
      login.style.display = "none";
      appDiv.style.display = "block";
      logoutBtn.style.display = "inline-block";
      whoami.textContent = `${user.email}${state.isAdmin ? " (ADMIN)" : ""}`;
      bootSubscriptions();
    } else {
      appDiv.style.display = "none";
      login.style.display = "block";
      logoutBtn.style.display = "none";
      whoami.textContent = "";
    }
  });

  monthPick.addEventListener("change", () => {
    state.selectedMonth = monthPick.value || currentMonthKey();
    bootSubscriptions();
  });

  monthToday.addEventListener("click", () => {
    state.selectedMonth = currentMonthKey();
    monthPick.value = state.selectedMonth;
    bootSubscriptions();
  });

  sortBy.addEventListener("change", renderCalls);
  search.addEventListener("input", renderCalls);

  toggleChart.addEventListener("click", () => {
    chartVisible = !chartVisible;
    chartWrap.style.display = chartVisible ? "block" : "none";
    toggleChart.textContent = chartVisible ? "Sakrij grafikon" : "Prikaži grafikon";

    if (chartVisible) {
      renderChartAllMonths().catch(() => {});
    }
  });

  addCall.addEventListener("click", async () => {
    const imeVal = (ime.value || "").trim();
    const sifraVal = (sifra.value || "").trim();
    const adresaVal = (adresa.value || "").trim();
    const tel = (telefon.value || "").trim();
    const datumVal = datumPoziva.value || "";
    const ponudaVal = ponudaAgent.value || "";
    const ishodVal = (ishod.value || "").trim();

    if (!imeVal) return alert("Unesi ime i prezime.");
    if (!sifraVal) return alert("Unesi šifru.");
    if (!adresaVal) return alert("Unesi adresu.");
    if (!tel) return alert("Unesi broj telefona.");
    if (!datumVal) return alert("Unesi datum poziva.");
    if (!ponudaVal) return alert("Izaberi ko je generisao ponudu.");
    if (!ishodVal) return alert("Unesi ishod poziva.");

    const qDup = query(collection(db, "calls"), where("telefon", "==", tel));
    const snapDup = await getDocs(qDup);
    if (!snapDup.empty) return alert("Telefon već postoji!");

    await addDoc(collection(db, "calls"), {
      ime: imeVal,
      sifra: sifraVal,
      adresa: adresaVal,
      telefon: tel,
      datumPoziva: datumVal,
      ponudaAgent: ponudaVal,
      ishod: ishodVal,
      teren: false,
      statusPoziva: false,
      createdAt: Date.now(),
    });

    ime.value = "";
    sifra.value = "";
    adresa.value = "";
    telefon.value = "";
    ishod.value = "";
    ponudaAgent.value = "";
    datumPoziva.value = toYMD(new Date());
  });

  function openScheduleModal(callId) {
    state.selectedCallId = callId;
    modal.style.display = "block";
    const now = new Date();
    datumTeren.value = toYMD(now);
    vremeTeren.value = "10:00";
  }

  function closeScheduleModal() {
    modal.style.display = "none";
    state.selectedCallId = null;
  }

  cancelField.addEventListener("click", closeScheduleModal);

  confirmField.addEventListener("click", async () => {
    if (!state.selectedCallId) return;
    if (!datumTeren.value) return alert("Unesi datum terena.");
    if (!vremeTeren.value) return alert("Unesi vreme terena.");

    const callRef = doc(db, "calls", state.selectedCallId);
    const callSnap = await getDoc(callRef);

    if (!callSnap.exists()) {
      alert("Poziv ne postoji.");
      closeScheduleModal();
      return;
    }

    const c = callSnap.data();

    if (c.teren === true) {
      alert("Za ovaj poziv je teren već zakazan.");
      closeScheduleModal();
      return;
    }

    if (!(c.ime || "").trim()) return alert("Poziv nema ime i prezime.");
    if (!(c.sifra || "").trim()) return alert("Poziv nema šifru.");
    if (!(c.adresa || "").trim()) return alert("Poziv nema adresu.");
    if (!(c.telefon || "").trim()) return alert("Poziv nema broj telefona.");
    if (!(c.ishod || "").trim()) return alert("Poziv nema ishod poziva.");

    await addDoc(collection(db, "fieldVisits"), {
      callId: state.selectedCallId,
      ime: c.ime || "",
      sifra: c.sifra || "",
      telefon: c.telefon || "",
      adresa: c.adresa || "",
      ponudaAgent: c.ponudaAgent || "",
      datumTeren: datumTeren.value,
      vremeTeren: vremeTeren.value,
      ishodTeren: "",
      radniNalog: false,
      createdAt: Date.now(),
    });

    const callSnapAfter = await getDoc(callRef);
    if (callSnapAfter.exists()) {
      await updateDoc(callRef, { teren: true });
    }

    closeScheduleModal();
  });

  function openManualModal() {
    manualModal.style.display = "block";
    const now = new Date();
    mDatumTeren.value = toYMD(now);
    mVremeTeren.value = "10:00";
    mIme.value = "";
    mAdresa.value = "";
    mTelefon.value = "";
    mIshodTeren.value = "";
    mRadniNalog.checked = false;
  }

  function closeManualModal() {
    manualModal.style.display = "none";
  }

  manualField.addEventListener("click", openManualModal);
  cancelManualField.addEventListener("click", closeManualModal);

  saveManualField.addEventListener("click", async () => {
    const imeVal = (mIme.value || "").trim();
    const adresaVal = (mAdresa.value || "").trim();
    const telefonVal = (mTelefon.value || "").trim();
    const datumVal = mDatumTeren.value || "";
    const vremeVal = mVremeTeren.value || "";
    const ishodVal = (mIshodTeren.value || "").trim();

    if (!imeVal) return alert("Unesi ime i prezime.");
    if (!adresaVal) return alert("Unesi adresu.");
    if (!telefonVal) return alert("Unesi broj telefona.");
    if (!datumVal) return alert("Unesi datum.");
    if (!vremeVal) return alert("Unesi vreme.");

    await addDoc(collection(db, "fieldVisits"), {
      callId: "",
      ime: imeVal,
      sifra: "",
      telefon: telefonVal,
      adresa: adresaVal,
      ponudaAgent: "",
      datumTeren: datumVal,
      vremeTeren: vremeVal,
      ishodTeren: ishodVal,
      radniNalog: !!mRadniNalog.checked,
      createdAt: Date.now(),
    });

    closeManualModal();
  });

  function bootSubscriptions() {
    if (typeof unsubCalls === "function") unsubCalls();
    if (typeof unsubFields === "function") unsubFields();

    const { start, end } = monthRangeFromMonthKey(state.selectedMonth);

    const callsQ = query(
      collection(db, "calls"),
      where("datumPoziva", ">=", start),
      where("datumPoziva", "<=", end)
    );

    unsubCalls = onSnapshot(callsQ, (snap) => {
      state.calls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCalls();
      renderStats();
    });

    const fieldsQ = query(
      collection(db, "fieldVisits"),
      where("datumTeren", ">=", start),
      where("datumTeren", "<=", end)
    );

    unsubFields = onSnapshot(fieldsQ, (snap) => {
      state.fields = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderFields();
      renderStats();
    });

    if (chartVisible) {
      renderChartAllMonths().catch(() => {});
    }
  }

  function sortCalls(arr) {
    const mode = sortBy.value || "datumPoziva_desc";
    const copy = [...arr];

    const get = (o, k) => String(o?.[k] ?? "").toLowerCase();

    copy.sort((a, b) => {
      const [key, dir] = mode.split("_");
      let va = "", vb = "";

      if (key === "datumPoziva") {
        va = a.datumPoziva || "";
        vb = b.datumPoziva || "";
      } else if (key === "ime") {
        va = get(a, "ime");
        vb = get(b, "ime");
      } else if (key === "telefon") {
        va = get(a, "telefon");
        vb = get(b, "telefon");
      } else if (key === "statusPoziva") {
        va = a.statusPoziva ? "1" : "0";
        vb = b.statusPoziva ? "1" : "0";
      }

      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      return 0;
    });

    return copy;
  }

  function renderCalls() {
    const q = (search.value || "").toLowerCase().trim();

    let filtered = state.calls;
    if (q) {
      filtered = filtered.filter((c) => {
        const hay = [c.ime, c.sifra, c.telefon, c.ponudaAgent, c.ishod].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }

    const sorted = sortCalls(filtered);

    callsTable.innerHTML = "";
    sorted.forEach((c) => {
      const terenBadge = c.teren
        ? `<span class="badge ok">Zakazan</span>`
        : `<span class="badge">-</span>`;

      const statusBadge = c.statusPoziva
        ? `<span class="badge ok">Čekirano</span>`
        : `<span class="badge no">Nije</span>`;

      const statusInput = state.isAdmin
        ? `<input type="checkbox" ${c.statusPoziva ? "checked" : ""} onchange="window._toggleStatusPoziva('${c.id}', this.checked)">`
        : `<span class="small">—</span>`;

      const delBtn = state.isAdmin
        ? `<button class="danger" onclick="window._del('calls','${c.id}')">X</button>`
        : "";

      const terenBtn = c.teren
        ? ``
        : `<button onclick="window._schedule('${c.id}')">Teren</button>`;

      callsTable.innerHTML += `
        <tr class="${c.statusPoziva ? "red" : (c.teren ? "green" : "")}">
          <td>${escapeHtml(c.ime || "")}</td>
          <td>${escapeHtml(c.sifra || "")}</td>
          <td>${escapeHtml(c.telefon || "")}</td>
          <td>${escapeHtml(c.ponudaAgent || "")}</td>
          <td><input value="${escapeAttr(c.ishod || "")}" onchange="window._updateCallIshod('${c.id}', this.value)"></td>
          <td style="text-align:center">${statusInput}</td>
          <td>${terenBadge} ${statusBadge}</td>
          <td>
            ${terenBtn}
            ${delBtn}
          </td>
        </tr>
      `;
    });
  }

  function renderFields() {
    fieldTable.innerHTML = "";

    const arr = [...state.fields].sort((a, b) => {
      const da = (a.datumTeren || "") + " " + (a.vremeTeren || "");
      const db = (b.datumTeren || "") + " " + (b.vremeTeren || "");
      return db.localeCompare(da);
    });

    arr.forEach((f) => {
      const rn = !!f.radniNalog;
      const rnCell = state.isAdmin
        ? `<input type="checkbox" ${rn ? "checked" : ""} onchange="window._toggleRadniNalog('${f.id}', this.checked)">`
        : (rn ? `<span class="badge ok">DA</span>` : `<span class="badge">NE</span>`);

      const delBtn = state.isAdmin
        ? `<button class="danger" onclick="window._del('fieldVisits','${f.id}')">X</button>`
        : "";

      fieldTable.innerHTML += `
        <tr>
          <td>
            ${escapeHtml(f.ime || "")}
            ${f.callId ? `<div class="small">vezan poziv</div>` : ``}
          </td>
          <td>${escapeHtml(f.adresa || "")}</td>
          <td>${escapeHtml(f.telefon || "")}</td>
          <td>${escapeHtml(f.datumTeren || "")}</td>
          <td>${escapeHtml(f.vremeTeren || "")}</td>
          <td><input value="${escapeAttr(f.ishodTeren || "")}" onchange="window._updateFieldIshod('${f.id}', this.value)"></td>
          <td style="text-align:center">${rnCell}</td>
          <td>${delBtn}</td>
        </tr>
      `;
    });
  }

  function renderStats() {
    const calls = state.calls;
    const fields = state.fields;

    const callsCount = calls.length;
    const fieldsCount = fields.length;
    const conversion = callsCount ? ((fieldsCount / callsCount) * 100).toFixed(1) : "0.0";

    const byAgent = {};
    AGENTS.forEach((a) => (byAgent[a] = { calls: 0, fields: 0 }));

    calls.forEach((c) => {
      const a = c.ponudaAgent || "";
      if (byAgent[a]) byAgent[a].calls += 1;
    });

    fields.forEach((f) => {
      const a = f.ponudaAgent || "";
      if (byAgent[a]) byAgent[a].fields += 1;
    });

    const agentBlocks = AGENTS.map((a) => {
      const ac = byAgent[a].calls;
      const af = byAgent[a].fields;
      const conv = ac ? ((af / ac) * 100).toFixed(1) : "0.0";
      return `
        <div class="stat">
          <div style="font-size:14px;opacity:.9">${escapeHtml(a)}</div>
          <div style="font-size:18px;margin-top:6px">Pozivi: <b>${ac}</b></div>
          <div style="font-size:18px">Tereni: <b>${af}</b></div>
          <div style="font-size:14px;opacity:.9;margin-top:6px">Konverzija: <b>${conv}%</b></div>
        </div>
      `;
    }).join("");

    statsEl.innerHTML = `
      <div class="stat">
        <div style="font-size:14px;opacity:.9">Prikaz (${state.selectedMonth})</div>
        <div style="font-size:22px;margin-top:6px">Pozivi: <b>${callsCount}</b></div>
        <div style="font-size:22px">Tereni: <b>${fieldsCount}</b></div>
        <div style="font-size:16px;opacity:.9;margin-top:6px">Konverzija: <b>${conversion}%</b></div>
      </div>
      ${agentBlocks}
    `;
  }

  async function renderChartAllMonths() {
    const snap = await getDocs(collection(db, "fieldVisits"));
    const counts = new Map();

    snap.forEach((d) => {
      const v = d.data();
      const k = monthKeyFromYMD(v.datumTeren);
      if (!k) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    });

    const keys = Array.from(counts.keys()).sort();
    const last = keys.slice(Math.max(0, keys.length - 12));

    const monthNames = {
      "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
      "05": "Maj", "06": "Jun", "07": "Jul", "08": "Avg",
      "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dec"
    };

    const labels = last.map((k) => {
      const y = k.slice(2, 4);
      const m = k.slice(5, 7);
      return `${monthNames[m] || m} ${y}`;
    });

    const values = last.map((k) => counts.get(k) || 0);
    drawBarChart(chartCanvas, labels, values);
  }

  window._schedule = (callId) => {
    openScheduleModal(callId);
  };

  window._updateCallIshod = async (id, val) => {
    const callRef = doc(db, "calls", id);
    const callSnap = await getDoc(callRef);
    if (!callSnap.exists()) {
      alert("Poziv više ne postoji.");
      return;
    }
    await updateDoc(callRef, { ishod: val });
  };

  window._toggleStatusPoziva = async (id, checked) => {
    if (!state.isAdmin) return;
    const callRef = doc(db, "calls", id);
    const callSnap = await getDoc(callRef);
    if (!callSnap.exists()) {
      alert("Poziv više ne postoji.");
      return;
    }
    await updateDoc(callRef, { statusPoziva: !!checked });
  };

  window._updateFieldIshod = async (id, val) => {
    const fieldRef = doc(db, "fieldVisits", id);
    const fieldSnap = await getDoc(fieldRef);
    if (!fieldSnap.exists()) {
      alert("Teren više ne postoji.");
      return;
    }
    await updateDoc(fieldRef, { ishodTeren: val });
  };

  window._toggleRadniNalog = async (id, checked) => {
    if (!state.isAdmin) return;
    const fieldRef = doc(db, "fieldVisits", id);
    const fieldSnap = await getDoc(fieldRef);
    if (!fieldSnap.exists()) {
      alert("Teren više ne postoji.");
      return;
    }
    await updateDoc(fieldRef, { radniNalog: !!checked });
  };

  window._del = async (col, id) => {
    if (!state.isAdmin) return;
    if (!confirm("Obrisati?")) return;

    if (col === "fieldVisits") {
      const fieldRef = doc(db, "fieldVisits", id);
      const fieldSnap = await getDoc(fieldRef);

      if (fieldSnap.exists()) {
        const fieldData = fieldSnap.data();

        if (fieldData.callId) {
          const callRef = doc(db, "calls", fieldData.callId);
          const callSnap = await getDoc(callRef);

          if (callSnap.exists()) {
            await updateDoc(callRef, { teren: false });
          }
        }
      }
    }

    if (col === "calls") {
      const callRef = doc(db, "calls", id);
      const callSnap = await getDoc(callRef);
      if (!callSnap.exists()) {
        alert("Poziv više ne postoji.");
        return;
      }
    }

    const ref = doc(db, col, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      alert("Dokument više ne postoji.");
      return;
    }

    await deleteDoc(ref);
  };
});

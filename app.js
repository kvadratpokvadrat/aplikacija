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

const ADMIN_EMAILS = ["stefanbarac@gmail.com"];
const AGENTS = ["Marija", "Slavko", "Jovan"];
const MONTH_STORAGE_KEY = "crmSelectedMonth";
const FOCUS_CALL_KEY = "crmFocusCall";
const FOCUS_FIELD_KEY = "crmFocusField";

function qs(id) {
  return document.getElementById(id);
}

function isAdminEmail(email) {
  return ADMIN_EMAILS
    .map((e) => e.toLowerCase().trim())
    .includes(String(email || "").toLowerCase().trim());
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
  const saved = localStorage.getItem(MONTH_STORAGE_KEY);
  if (saved) return saved;

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function setCurrentMonthKey(key) {
  localStorage.setItem(MONTH_STORAGE_KEY, key);
}

function monthRangeFromMonthKey(key) {
  const [y, m] = key.split("-").map((x) => parseInt(x, 10));
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

function setText(id, value) {
  const el = qs(id);
  if (el) el.textContent = String(value);
}

function markActiveNav(page) {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("data-nav") === page);
  });
}

function getCallRowClass(c) {
  if (c.statusPoziva) return "row-red";
  if (c.statusTerena === "realizovan" || c.statusTerena === "zakazan" || c.teren) return "row-green";
  return "";
}

function getFieldRowClass(f) {
  return f.realizovan ? "row-green" : "";
}

function getCallStatusBadge(call) {
  if (call.statusTerena === "realizovan") {
    return `<span class="badge badge-success">Realizovan</span>`;
  }
  if (call.statusTerena === "zakazan" || call.teren === true) {
    return `<span class="badge badge-success">Zakazan</span>`;
  }
  if (call.statusTerena === "otkazan" || call.statusTerena === "nije_zakazano") {
    return `<span class="badge badge-warning">Više nije zakazano</span>`;
  }
  return `<span class="badge">-</span>`;
}

function drawBarChart(canvas, labels, values) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const padL = 70;
  const padR = 26;
  const padT = 26;
  const padB = 62;

  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(1, ...values, 0);

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
    ctx.fillText(String(val), padL - 10, y + 4);
  }

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + chartH);
  ctx.lineTo(padL + chartW, padT + chartH);
  ctx.stroke();

  const count = Math.max(values.length, 1);
  const gap = 16;
  const barW = Math.max(20, Math.floor((chartW - gap * (count - 1)) / count));

  values.forEach((v, i) => {
    const x = padL + i * (barW + gap);
    const h = Math.round((v / maxVal) * (chartH - 12));
    const y = padT + chartH - h;

    const gradient = ctx.createLinearGradient(0, y, 0, padT + chartH);
    gradient.addColorStop(0, "#2563eb");
    gradient.addColorStop(1, "#60a5fa");

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(String(v), x + barW / 2, y - 8);

    ctx.fillStyle = "#475569";
    ctx.font = "12px Segoe UI";
    ctx.fillText(labels[i] || "", x + barW / 2, padT + chartH + 22);
  });
}

function daysDiffFromToday(ymd) {
  if (!ymd) return 0;

  const today = new Date();
  const d = new Date(`${ymd}T00:00:00`);
  const now = new Date(`${toYMD(today)}T00:00:00`);
  const diffMs = now - d;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getPriority(days) {
  if (days >= 7) return "high";
  if (days > 3) return "mid";
  return "low";
}

function getStaleItems() {
  const staleCalls = state.calls.filter((c) => {
    const days = daysDiffFromToday(c.datumPoziva);
    if (c.teren === true) return false;
    return !c.statusPoziva && days > 3;
  });

  const staleFields = state.fields.filter((f) => {
    const days = daysDiffFromToday(f.datumTeren);
    return !f.realizovan && days > 3;
  });

  return { staleCalls, staleFields };
}

function renderAlerts() {
  const notifList = qs("notifList");
  const notifBadge = qs("notifBadge");

  if (!notifList) return;

  const { staleCalls, staleFields } = getStaleItems();
  const total = staleCalls.length + staleFields.length;

  if (notifBadge) {
    notifBadge.textContent = String(total);
    notifBadge.classList.toggle("hidden", total === 0);
  }

  const navAlerts = qs("navAlertsCount");
  if (navAlerts) {
    navAlerts.textContent = String(total);
  }

  if (!total) {
    notifList.innerHTML = `<div class="notif-empty">Nema stavki starijih od 3 dana bez aktivnosti.</div>`;
    return;
  }

  const callLines = staleCalls
    .sort((a, b) => daysDiffFromToday(b.datumPoziva) - daysDiffFromToday(a.datumPoziva))
    .slice(0, 8)
    .map((c) => {
      const days = daysDiffFromToday(c.datumPoziva);
      const pr = getPriority(days);

      return `
        <div class="notif-item" onclick="window._goToCall('${c.id}')">
          <div>
            <div class="notif-title">${escapeHtml(c.ime || "Bez imena")}</div>
            <div class="notif-meta">
              Poziv · ${escapeHtml(c.telefon || "-")} · ${escapeHtml(c.datumPoziva || "-")}<br>
              Nije čekiran · kasni ${days} dana
            </div>
          </div>
          <span class="badge ${pr === "high" ? "badge-danger" : "badge-warning"}">Poziv</span>
        </div>
      `;
    })
    .join("");

  const fieldLines = staleFields
    .sort((a, b) => daysDiffFromToday(b.datumTeren) - daysDiffFromToday(a.datumTeren))
    .slice(0, 8)
    .map((f) => {
      const days = daysDiffFromToday(f.datumTeren);
      const pr = getPriority(days);

      return `
        <div class="notif-item" onclick="window._goToField('${f.id}')">
          <div>
            <div class="notif-title">${escapeHtml(f.ime || "Bez imena")}</div>
            <div class="notif-meta">
              Teren · ${escapeHtml(f.telefon || "-")} · ${escapeHtml(f.datumTeren || "-")}<br>
              Nije realizovan · kasni ${days} dana
            </div>
          </div>
          <span class="badge ${pr === "high" ? "badge-danger" : "badge-warning"}">Teren</span>
        </div>
      `;
    })
    .join("");

  notifList.innerHTML = `
    ${staleCalls.length ? `<div class="notif-section">Pozivi bez aktivnosti</div>${callLines}` : ``}
    ${staleFields.length ? `<div class="notif-section">Tereni bez realizacije</div>${fieldLines}` : ``}
  `;
}

let lastNotificationKey = "";

function maybeBrowserNotify() {
  const { staleCalls, staleFields } = getStaleItems();
  const total = staleCalls.length + staleFields.length;

  if (!total) return;
  if (!("Notification" in window)) return;

  const key = `${staleCalls.length}-${staleFields.length}`;
  if (lastNotificationKey === key || total < 2) return;

  const show = () => {
    try {
      new Notification("CRM obaveštenje", {
        body: `Imaš ${staleCalls.length} poziva i ${staleFields.length} terena bez aktivnosti duže od 3 dana.`,
      });
      lastNotificationKey = key;
    } catch (_) {}
  };

  if (Notification.permission === "granted") {
    show();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") show();
    });
  }
}

let state = {
  user: null,
  isAdmin: false,
  selectedMonth: currentMonthKey(),
  selectedCallId: null,
  calls: [],
  fields: [],
  page: document.body.dataset.page || "calls",
};

document.addEventListener("DOMContentLoaded", () => {
  const bootScreen = qs("bootScreen");
  const loginView = qs("loginView");
  const appView = qs("appView");

  const email = qs("email");
  const password = qs("password");
  const loginBtn = qs("loginBtn");
  const logoutBtn = qs("logoutBtn");
  const whoami = qs("whoami");

  const monthPick = qs("monthPick");
  const monthToday = qs("monthToday");

  const ime = qs("ime");
  const sifra = qs("sifra");
  const adresa = qs("adresa");
  const telefon = qs("telefon");
  const datumPoziva = qs("datumPoziva");
  const ponudaAgent = qs("ponudaAgent");
  const ishod = qs("ishod");
  const addCall = qs("addCall");

  const search = qs("search");
  const fieldSearch = qs("fieldSearch");
  const sortBy = qs("sortBy");
  const callsTable = qs("callsTable");
  const fieldTable = qs("fieldTable");

  const modal = qs("modal");
  const datumTeren = qs("datumTeren");
  const vremeTeren = qs("vremeTeren");
  const confirmField = qs("confirmField");
  const cancelField = qs("cancelField");

  const manualModal = qs("manualModal");
  const manualField = qs("manualField");
  const mIme = qs("mIme");
  const mAdresa = qs("mAdresa");
  const mTelefon = qs("mTelefon");
  const mDatumTeren = qs("mDatumTeren");
  const mVremeTeren = qs("mVremeTeren");
  const mIshodTeren = qs("mIshodTeren");
  const mRadniNalog = qs("mRadniNalog");
  const saveManualField = qs("saveManualField");
  const cancelManualField = qs("cancelManualField");

  const statsEl = qs("stats");
  const toggleChart = qs("toggleChart");
  const chartWrap = qs("chartWrap");
  const chartCanvas = qs("chart");

  const notifBtn = qs("notifBtn");
  const notifDropdown = qs("notifDropdown");

  let unsubCalls = null;
  let unsubFields = null;
  let chartVisible = false;

  markActiveNav(state.page);

  if (monthPick) monthPick.value = state.selectedMonth;
  if (datumPoziva) datumPoziva.value = toYMD(new Date());

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
        notifDropdown.classList.add("hidden");
      }
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      try {
        await signInWithEmailAndPassword(auth, email.value, password.value);
      } catch (e) {
        alert(e?.message || "Login greška");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
    });
  }

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.isAdmin = !!user && isAdminEmail(user.email);

    if (bootScreen) bootScreen.classList.add("hidden");

    if (user) {
      if (loginView) loginView.classList.add("hidden");
      if (appView) appView.classList.remove("hidden");
      if (whoami) whoami.textContent = `${user.email}${state.isAdmin ? " (ADMIN)" : ""}`;
      bootSubscriptions();
    } else {
      if (loginView) loginView.classList.remove("hidden");
      if (appView) appView.classList.add("hidden");
      if (whoami) whoami.textContent = "";
    }
  });

  if (monthPick) {
    monthPick.addEventListener("change", () => {
      state.selectedMonth = monthPick.value || currentMonthKey();
      setCurrentMonthKey(state.selectedMonth);
      bootSubscriptions();
    });
  }

  if (monthToday) {
    monthToday.addEventListener("click", () => {
      state.selectedMonth = currentMonthKey().slice(0, 7);
      setCurrentMonthKey(state.selectedMonth);
      if (monthPick) monthPick.value = state.selectedMonth;
      bootSubscriptions();
    });
  }

  if (search) search.addEventListener("input", renderCalls);
  if (fieldSearch) fieldSearch.addEventListener("input", renderFields);
  if (sortBy) sortBy.addEventListener("change", renderCalls);

  if (toggleChart) {
    toggleChart.addEventListener("click", () => {
      chartVisible = !chartVisible;
      if (chartWrap) chartWrap.classList.toggle("hidden", !chartVisible);
      toggleChart.textContent = chartVisible ? "Sakrij grafikon" : "Prikaži grafikon";

      if (chartVisible) {
        renderChartAllMonths().catch(() => {});
      }
    });
  }

  if (addCall) {
    addCall.addEventListener("click", async () => {
      const imeVal = (ime?.value || "").trim();
      const sifraVal = (sifra?.value || "").trim();
      const adresaVal = (adresa?.value || "").trim();
      const tel = (telefon?.value || "").trim();
      const datumVal = datumPoziva?.value || "";
      const ponudaVal = ponudaAgent?.value || "";
      const ishodVal = (ishod?.value || "").trim();

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
        statusTerena: "nije_zakazano",
        createdAt: Date.now(),
      });

      if (ime) ime.value = "";
      if (sifra) sifra.value = "";
      if (adresa) adresa.value = "";
      if (telefon) telefon.value = "";
      if (ishod) ishod.value = "";
      if (ponudaAgent) ponudaAgent.value = "";
      if (datumPoziva) datumPoziva.value = toYMD(new Date());
    });
  }

  function openScheduleModal(callId) {
    state.selectedCallId = callId;
    if (!modal) return;
    modal.classList.remove("hidden");

    const now = new Date();
    if (datumTeren) datumTeren.value = toYMD(now);
    if (vremeTeren) vremeTeren.value = "10:00";
  }

  function closeScheduleModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    state.selectedCallId = null;
  }

  if (cancelField) cancelField.addEventListener("click", closeScheduleModal);

  if (confirmField) {
    confirmField.addEventListener("click", async () => {
      if (!state.selectedCallId) return;
      if (!datumTeren?.value) return alert("Unesi datum terena.");
      if (!vremeTeren?.value) return alert("Unesi vreme terena.");

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
        realizovan: false,
        createdAt: Date.now(),
      });

      await updateDoc(callRef, {
        teren: true,
        statusTerena: "zakazan",
      });

      closeScheduleModal();
    });
  }

  function openManualModal() {
    if (!manualModal) return;
    manualModal.classList.remove("hidden");

    const now = new Date();
    if (mDatumTeren) mDatumTeren.value = toYMD(now);
    if (mVremeTeren) mVremeTeren.value = "10:00";
    if (mIme) mIme.value = "";
    if (mAdresa) mAdresa.value = "";
    if (mTelefon) mTelefon.value = "";
    if (mIshodTeren) mIshodTeren.value = "";
    if (mRadniNalog) mRadniNalog.checked = false;
  }

  function closeManualModal() {
    if (!manualModal) return;
    manualModal.classList.add("hidden");
  }

  if (manualField) manualField.addEventListener("click", openManualModal);
  if (cancelManualField) cancelManualField.addEventListener("click", closeManualModal);

  if (saveManualField) {
    saveManualField.addEventListener("click", async () => {
      const imeVal = (mIme?.value || "").trim();
      const adresaVal = (mAdresa?.value || "").trim();
      const telefonVal = (mTelefon?.value || "").trim();
      const datumVal = mDatumTeren?.value || "";
      const vremeVal = mVremeTeren?.value || "";
      const ishodVal = (mIshodTeren?.value || "").trim();

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
        radniNalog: !!mRadniNalog?.checked,
        realizovan: false,
        createdAt: Date.now(),
      });

      closeManualModal();
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === modal) closeScheduleModal();
    if (e.target === manualModal) closeManualModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeScheduleModal();
      closeManualModal();
      if (notifDropdown) notifDropdown.classList.add("hidden");
    }

    if (e.key === "Enter" && state.page === "calls" && document.activeElement?.tagName === "INPUT") {
      if (addCall) addCall.click();
    }
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
      renderFields();
      renderStats();
      renderMiniStats();
      updateNavCounts();
      renderAlerts();
      maybeBrowserNotify();
    });

    const fieldsQ = query(
      collection(db, "fieldVisits"),
      where("datumTeren", ">=", start),
      where("datumTeren", "<=", end)
    );

    unsubFields = onSnapshot(fieldsQ, (snap) => {
      state.fields = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCalls();
      renderFields();
      renderStats();
      renderMiniStats();
      updateNavCounts();
      renderAlerts();
      maybeBrowserNotify();
      renderCalendar();
    });

    if (chartVisible) {
      renderChartAllMonths().catch(() => {});
    } else {
      renderChartAllMonths().catch(() => {});
    }
  }

  function sortCalls(arr) {
    const mode = sortBy?.value || "datumPoziva_desc";
    const copy = [...arr];
    const get = (o, k) => String(o?.[k] ?? "").toLowerCase();

    copy.sort((a, b) => {
      const [key, dir] = mode.split("_");
      let va = "";
      let vb = "";

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
    if (!callsTable) return;

    const q = (search?.value || "").toLowerCase().trim();
    let filtered = state.calls;

    if (q) {
      filtered = filtered.filter((c) => {
        const hay = [
          c.ime,
          c.sifra,
          c.telefon,
          c.ponudaAgent,
          c.ishod,
          c.adresa,
          c.statusTerena,
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      });
    }

    const sorted = sortCalls(filtered);
    callsTable.innerHTML = "";

    if (!sorted.length) {
      callsTable.innerHTML = `<tr><td colspan="9"><div class="empty-state">Nema poziva za prikaz.</div></td></tr>`;
      return;
    }

    sorted.forEach((c) => {
      const statusBadge = c.statusPoziva
        ? `<span class="badge badge-danger">Čekirano</span>`
        : `<span class="badge">Nije</span>`;

      const statusInput = state.isAdmin
        ? `<input type="checkbox" ${c.statusPoziva ? "checked" : ""} onchange="window._toggleStatusPoziva('${c.id}', this.checked)">`
        : `<span class="small-dash">—</span>`;

      const delBtn = state.isAdmin
        ? `<button class="btn btn-danger-table" onclick="window._del('calls','${c.id}')">X</button>`
        : "";

      const terenBtn = c.teren
        ? ``
        : `<button class="btn btn-primary btn-sm" onclick="window._schedule('${c.id}')">Teren</button>`;

      callsTable.innerHTML += `
        <tr data-id="${c.id}" class="${getCallRowClass(c)}">
          <td>${escapeHtml(c.ime || "")}</td>
          <td>${escapeHtml(c.sifra || "")}</td>
          <td>${escapeHtml(c.telefon || "")}</td>
          <td>${escapeHtml(c.adresa || "")}</td>
          <td>${escapeHtml(c.ponudaAgent || "")}</td>
          <td><input class="inline-input" value="${escapeAttr(c.ishod || "")}" onchange="window._updateCallIshod('${c.id}', this.value)"></td>
          <td style="text-align:center">
            <div class="checkbox-center">${statusInput}</div>
            <div style="margin-top:6px">${statusBadge}</div>
          </td>
          <td>${getCallStatusBadge(c)}</td>
          <td>
            <div class="action-row">
              ${terenBtn}
              ${delBtn}
            </div>
          </td>
        </tr>
      `;
    });

    const focusId = localStorage.getItem(FOCUS_CALL_KEY);
    if (focusId) {
      const row = document.querySelector(`[data-id="${focusId}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.add("row-focus");
      }
      localStorage.removeItem(FOCUS_CALL_KEY);
    }
  }

  function renderFields() {
    if (!fieldTable) return;

    const q = (fieldSearch?.value || "").toLowerCase().trim();
    let arr = [...state.fields];

    if (q) {
      arr = arr.filter((f) => {
        const hay = [
          f.ime,
          f.adresa,
          f.telefon,
          f.datumTeren,
          f.vremeTeren,
          f.ishodTeren,
          f.ponudaAgent,
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      });
    }

    arr.sort((a, b) => {
      const da = (a.datumTeren || "") + " " + (a.vremeTeren || "");
      const db = (b.datumTeren || "") + " " + (b.vremeTeren || "");
      return db.localeCompare(da);
    });

    fieldTable.innerHTML = "";

    if (!arr.length) {
      fieldTable.innerHTML = `<tr><td colspan="10"><div class="empty-state">Nema terena za prikaz.</div></td></tr>`;
      return;
    }

    arr.forEach((f) => {
      const rn = !!f.radniNalog;
      const realizovan = !!f.realizovan;

      const rnCell = state.isAdmin
        ? `<input type="checkbox" ${rn ? "checked" : ""} onchange="window._toggleRadniNalog('${f.id}', this.checked)">`
        : rn
          ? `<span class="badge badge-success">DA</span>`
          : `<span class="badge">NE</span>`;

      const realizovanCell = state.isAdmin
        ? `<input type="checkbox" ${realizovan ? "checked" : ""} onchange="window._toggleRealizovan('${f.id}', this.checked)">`
        : realizovan
          ? `<span class="badge badge-success">DA</span>`
          : `<span class="badge">NE</span>`;

      const delBtn = state.isAdmin
        ? `<button class="btn btn-danger-table" onclick="window._del('fieldVisits','${f.id}')">X</button>`
        : "";

      fieldTable.innerHTML += `
        <tr data-id="${f.id}" class="${getFieldRowClass(f)}">
          <td>${escapeHtml(f.ime || "")}</td>
          <td>${escapeHtml(f.adresa || "")}</td>
          <td>${escapeHtml(f.telefon || "")}</td>
          <td>${escapeHtml(f.datumTeren || "")}</td>
          <td>${escapeHtml(f.vremeTeren || "")}</td>
          <td><input class="inline-input" value="${escapeAttr(f.ishodTeren || "")}" onchange="window._updateFieldIshod('${f.id}', this.value)"></td>
          <td class="checkbox-center">${rnCell}</td>
          <td class="checkbox-center">${realizovanCell}</td>
          <td>${f.callId ? `<span class="badge badge-success">Vezan poziv</span>` : `<span class="badge">Ručno</span>`}</td>
          <td>${delBtn}</td>
        </tr>
      `;
    });

    const focusId = localStorage.getItem(FOCUS_FIELD_KEY);
    if (focusId) {
      const row = document.querySelector(`[data-id="${focusId}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.add("row-focus");
      }
      localStorage.removeItem(FOCUS_FIELD_KEY);
    }
  }

  function renderMiniStats() {
    const callsCount = state.calls.length;
    const fieldsCount = state.fields.length;
    const linkedFieldsCount = state.fields.filter((f) => !!f.callId).length;
    const realizedCount = state.fields.filter((f) => !!f.realizovan).length;
    const rnCount = state.fields.filter((f) => !!f.radniNalog).length;
    const conv = callsCount ? ((realizedCount / callsCount) * 100).toFixed(1) : "0.0";

    setText("kpiCalls", callsCount);
    setText("kpiScheduled", linkedFieldsCount);
    setText("kpiRealized", realizedCount);
    setText("kpiConv", `${conv}%`);

    setText("kpiFields", fieldsCount);
    setText("kpiLinkedFields", linkedFieldsCount);
    setText("kpiRN", rnCount);
  }

  function renderStats() {
    if (!statsEl) return;

    const calls = state.calls;
    const fields = state.fields;
    const realizedFields = fields.filter((f) => !!f.realizovan);

    const byAgent = {};
    AGENTS.forEach((a) => {
      byAgent[a] = { calls: 0, scheduled: 0, realized: 0 };
    });

    calls.forEach((c) => {
      const a = c.ponudaAgent || "";
      if (byAgent[a]) byAgent[a].calls += 1;
    });

    fields.forEach((f) => {
      const a = f.ponudaAgent || "";
      if (byAgent[a]) byAgent[a].scheduled += 1;
      if (byAgent[a] && f.realizovan) byAgent[a].realized += 1;
    });

    statsEl.innerHTML = AGENTS.map((a) => {
      const ac = byAgent[a].calls;
      const as = byAgent[a].scheduled;
      const ar = byAgent[a].realized;
      const agentConv = ac ? ((ar / ac) * 100).toFixed(1) : "0.0";

      return `
        <div class="agent-card">
          <h4>${escapeHtml(a)}</h4>
          <div class="agent-line"><span>Pozivi</span><strong>${ac}</strong></div>
          <div class="agent-line"><span>Zakazani tereni</span><strong>${as}</strong></div>
          <div class="agent-line"><span>Realizovani</span><strong>${ar}</strong></div>
          <div class="agent-line"><span>Konverzija</span><strong>${agentConv}%</strong></div>
        </div>
      `;
    }).join("");
  }

  async function renderChartAllMonths() {
    if (!chartCanvas) return;

    const snap = await getDocs(collection(db, "fieldVisits"));
    const counts = new Map();

    snap.forEach((d) => {
      const v = d.data();
      if (!v.realizovan) return;

      const k = monthKeyFromYMD(v.datumTeren);
      if (!k) return;

      counts.set(k, (counts.get(k) || 0) + 1);
    });

    const keys = Array.from(counts.keys()).sort();
    const last = keys.slice(Math.max(0, keys.length - 12));

    const monthNames = {
      "01": "Jan",
      "02": "Feb",
      "03": "Mar",
      "04": "Apr",
      "05": "Maj",
      "06": "Jun",
      "07": "Jul",
      "08": "Avg",
      "09": "Sep",
      "10": "Okt",
      "11": "Nov",
      "12": "Dec",
    };

    const labels = last.map((k) => {
      const y = k.slice(2, 4);
      const m = k.slice(5, 7);
      return `${monthNames[m] || m} ${y}`;
    });

    const values = last.map((k) => counts.get(k) || 0);
    drawBarChart(chartCanvas, labels, values);
  }

  function updateNavCounts() {
    setText("navCallsCount", state.calls.length);
    setText("navFieldsCount", state.fields.length);
    setText("navAlertsCount", getStaleItems().staleCalls.length + getStaleItems().staleFields.length);
  }

  function renderCalendar() {
    const cal = qs("calendar");
    const calHead = qs("calendarHead");
    if (!cal) return;

    if (calHead) {
      calHead.innerHTML = `
        <div>Pon</div>
        <div>Uto</div>
        <div>Sre</div>
        <div>Čet</div>
        <div>Pet</div>
        <div>Sub</div>
        <div>Ned</div>
      `;
    }

    const [year, month] = state.selectedMonth.split("-").map((v) => parseInt(v, 10));

    let firstDay = new Date(year, month - 1, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    const daysInMonth = new Date(year, month, 0).getDate();

    cal.innerHTML = "";

    for (let i = 0; i < firstDay; i++) {
      cal.innerHTML += `<div class="calendar-day is-empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const events = state.fields.filter((f) => f.datumTeren === dateStr);

      cal.innerHTML += `
        <div class="calendar-day">
          <div class="calendar-day-head">
            <div class="calendar-day-number">${d}</div>
            <div class="calendar-day-count">${events.length ? `${events.length} teren` : ""}</div>
          </div>

          ${events
            .map(
              (e) => `
                <div class="calendar-event ${e.realizovan ? "realized" : ""}">
                  <strong>${escapeHtml(e.ime || "")}</strong><br>
                  ${escapeHtml(e.vremeTeren || "")}
                </div>
              `
            )
            .join("")}
        </div>
      `;
    }
  }

  window._schedule = (callId) => {
    openScheduleModal(callId);
  };

  window._goToCall = (id) => {
    localStorage.setItem(FOCUS_CALL_KEY, id);
    window.location.href = "calls.html";
  };

  window._goToField = (id) => {
    localStorage.setItem(FOCUS_FIELD_KEY, id);
    window.location.href = "fields.html";
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

  window._toggleRealizovan = async (id, checked) => {
    if (!state.isAdmin) return;

    const fieldRef = doc(db, "fieldVisits", id);
    const fieldSnap = await getDoc(fieldRef);

    if (!fieldSnap.exists()) {
      alert("Teren više ne postoji.");
      return;
    }

    const fieldData = fieldSnap.data();

    await updateDoc(fieldRef, { realizovan: !!checked });

    if (fieldData.callId) {
      const callRef = doc(db, "calls", fieldData.callId);
      const callSnap = await getDoc(callRef);

      if (callSnap.exists()) {
        await updateDoc(callRef, {
          statusTerena: checked ? "realizovan" : "zakazan",
          teren: true,
        });
      }
    }

    renderChartAllMonths().catch(() => {});
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
            await updateDoc(callRef, {
              teren: false,
              statusTerena: "otkazan",
            });
          }
        }
      }
    }

    const ref = doc(db, col, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("Dokument više ne postoji.");
      return;
    }

    await deleteDoc(ref);

    renderChartAllMonths().catch(() => {});
  };
});

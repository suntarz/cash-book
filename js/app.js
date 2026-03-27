(function () {
  "use strict";

  const STORAGE_KEY = "cashBookData_v1";

  function useGas() {
    try {
      return typeof google !== "undefined" && google.script && google.script.run;
    } catch (e) {
      return false;
    }
  }

  /** GitHub Pages → Sheet ผ่าน Apps Script Web App (JSONP + POST) — ตั้งใน js/config.js */
  function useSheetApi() {
    try {
      var c = typeof window !== "undefined" && window.CASHBOOK_CONFIG;
      if (!c) return false;
      var url = c.webAppUrl && String(c.webAppUrl).trim();
      var sec = c.secret != null && String(c.secret).trim();
      return !!(url && sec);
    } catch (e) {
      return false;
    }
  }

  function saveToSheetApi() {
    var c = window.CASHBOOK_CONFIG;
    var payload = JSON.stringify(state);
    try {
      fetch(String(c.webAppUrl).trim(), {
        method: "POST",
        mode: "no-cors",
        cache: "no-cache",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ secret: String(c.secret).trim(), payload: payload }),
      });
    } catch (e) {
      alert("บันทึก Google Sheet ไม่สำเร็จ");
    }
  }

  function loadFromSheetApi(done) {
    var c = window.CASHBOOK_CONFIG;
    var base = String(c.webAppUrl).trim().replace(/\?$/, "");
    var sep = base.indexOf("?") >= 0 ? "&" : "?";
    var cbName = "__cashbook_jsonp_" + Date.now();
    var script = document.createElement("script");
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      try {
        delete window[cbName];
      } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
      if (typeof done === "function") done();
    }

    window[cbName] = function (data) {
      if (data !== null && data !== undefined) {
        applyServerState(data);
      } else {
        alert("โหลด Google Sheet ไม่สำเร็จ — ตรวจ URL Web App และรหัสลับ (ต้องตรงกับ Apps Script)");
        applyServerState("{}");
      }
      finish();
    };

    script.onerror = function () {
      alert("โหลด Google Sheet ไม่สำเร็จ — ตรวจเครือข่ายและ URL");
      loadFromLocalStorage();
      finish();
    };

    script.src =
      base +
      sep +
      "callback=" +
      encodeURIComponent(cbName) +
      "&secret=" +
      encodeURIComponent(String(c.secret).trim());
    document.body.appendChild(script);
  }

  /** @typedef {{ id: string, name: string, type: 'income'|'expense', expenseKind?: 'fixed'|'general' }} Category */
  /** @typedef {{ id: string, date: string, amount: number, type: 'income'|'expense', categoryId: string, note: string, bookMonth?: string }} Transaction */

  /** @type {{ categories: Category[], transactions: Transaction[] }} */
  let state = { categories: [], transactions: [] };

  /** @type {{ y: number, m: number }} month is 0-11 */
  let viewMonth = currentYM();

  function currentYM() {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatMonthTh(y, m) {
    const names = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
    ];
    return `${names[m]} ${y + 543}`;
  }

  function formatMoney(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return "0";
    return x.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        seedDefaults();
        return;
      }
      const data = JSON.parse(raw);
      state = {
        categories: Array.isArray(data.categories) ? data.categories : [],
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
      };
      normalizeCategories();
      if (state.categories.length === 0) seedDefaults();
    } catch (e) {
      state = { categories: [], transactions: [] };
      seedDefaults();
    }
  }

  function applyServerState(json) {
    try {
      const raw = typeof json === "string" ? json : JSON.stringify(json);
      const data = JSON.parse(raw || "{}");
      state = {
        categories: Array.isArray(data.categories) ? data.categories : [],
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
      };
      normalizeCategories();
      if (state.categories.length === 0) seedDefaults();
    } catch (e) {
      state = { categories: [], transactions: [] };
      seedDefaults();
    }
  }

  /** @param {Category|undefined} c */
  function getExpenseKind(c) {
    if (!c || c.type !== "expense") return "general";
    return c.expenseKind === "fixed" ? "fixed" : "general";
  }

  function normalizeCategories() {
    for (const c of state.categories) {
      if (c.type === "expense") {
        if (c.expenseKind !== "fixed" && c.expenseKind !== "general") {
          c.expenseKind = "general";
        }
      } else {
        delete c.expenseKind;
      }
    }
  }

  function seedDefaults() {
    if (state.categories.length > 0) return;
    state.categories = [
      { id: uid(), name: "เงินเดือน", type: "income" },
      { id: uid(), name: "อื่น ๆ (รายรับ)", type: "income" },
      { id: uid(), name: "อาหาร", type: "expense", expenseKind: "general" },
      { id: uid(), name: "ค่าที่พัก", type: "expense", expenseKind: "fixed" },
      { id: uid(), name: "ค่าเดินทาง", type: "expense", expenseKind: "general" },
      { id: uid(), name: "อื่น ๆ (รายจ่าย)", type: "expense", expenseKind: "general" },
    ];
    save();
  }

  function save() {
    if (useGas()) {
      google.script.run
        .withFailureHandler(function () {
          alert("บันทึก Google Sheet ไม่สำเร็จ");
        })
        .saveStateToServer(JSON.stringify(state));
    } else if (useSheetApi()) {
      saveToSheetApi();
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }

  function monthKey(y, m) {
    return `${y}-${pad2(m + 1)}`;
  }

  /** @param {string} dateStr */
  function dateStrToMonthKey(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }

  /** @param {Transaction} t */
  function transactionBookYM(t) {
    if (t.bookMonth && /^\d{4}-\d{2}$/.test(t.bookMonth)) {
      var p = t.bookMonth.split("-").map(Number);
      var yy = p[0];
      var mo = p[1];
      if (mo >= 1 && mo <= 12) return { y: yy, m: mo - 1 };
    }
    const d = new Date(t.date + "T12:00:00");
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  /** @param {Transaction} t */
  function transactionInViewMonth(t) {
    var ym = transactionBookYM(t);
    return ym.y === viewMonth.y && ym.m === viewMonth.m;
  }

  /** @param {string} dateStr */
  function formatDateTh(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    const names = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ];
    return `${d.getDate()} ${names[d.getMonth()]} ${d.getFullYear() + 543}`;
  }

  /**
   * @param {string} date
   * @param {string} bookMonthRaw
   * @returns {string|undefined} เก็บเฉพาะเมื่อต่างจากเดือนของวันที่จริง
   */
  function resolveBookMonth(date, bookMonthRaw) {
    const raw = (bookMonthRaw || "").trim();
    if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return undefined;
    if (raw === dateStrToMonthKey(date)) return undefined;
    return raw;
  }

  function transactionsInMonth() {
    return state.transactions.filter((t) => transactionInViewMonth(t)).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.amount - a.amount;
    });
  }

  function categoryById(id) {
    return state.categories.find((c) => c.id === id);
  }

  function renderMonthLabel() {
    const el = document.getElementById("monthLabel");
    el.textContent = formatMonthTh(viewMonth.y, viewMonth.m);
  }

  function renderSummary() {
    const list = transactionsInMonth();
    let inc = 0;
    let exp = 0;
    let expFixed = 0;
    let expGeneral = 0;
    for (const t of list) {
      if (t.type === "income") {
        inc += t.amount;
      } else {
        exp += t.amount;
        const cat = categoryById(t.categoryId);
        if (getExpenseKind(cat) === "fixed") expFixed += t.amount;
        else expGeneral += t.amount;
      }
    }
    document.getElementById("sumIncome").textContent = formatMoney(inc);
    document.getElementById("sumExpense").textContent = formatMoney(exp);
    document.getElementById("sumExpenseFixed").textContent = formatMoney(expFixed);
    document.getElementById("sumExpenseGeneral").textContent = formatMoney(expGeneral);
    const bal = inc - exp;
    const balEl = document.getElementById("sumBalance");
    balEl.textContent = formatMoney(bal);
    balEl.style.color = bal >= 0 ? "var(--balance)" : "var(--expense)";
  }

  function renderTransactions() {
    const ul = document.getElementById("txList");
    const empty = document.getElementById("txEmpty");
    const list = transactionsInMonth();
    ul.innerHTML = "";
    if (list.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    for (const t of list) {
      const cat = categoryById(t.categoryId);
      const catName = cat ? cat.name : "—";
      const ek = t.type === "expense" ? getExpenseKind(cat) : null;
      const kindHtml =
        ek === "fixed"
          ? ` <span class="tx-kind fixed">คงที่</span>`
          : ek === "general"
            ? ` <span class="tx-kind general">ทั่วไป</span>`
            : "";
      const bm = transactionBookYM(t);
      const dm = dateStrToMonthKey(t.date);
      const bookMonthStr = monthKey(bm.y, bm.m);
      const bookHint =
        t.bookMonth && bookMonthStr !== dm
          ? ` <span class="tx-book">→ ${formatMonthTh(bm.y, bm.m)}</span>`
          : "";
      const li = document.createElement("li");
      li.className = "tx-item";
      const sign = t.type === "income" ? "+" : "−";
      const cls = t.type === "income" ? "income" : "expense";
      li.innerHTML = `
        <div class="tx-main">
          <div class="tx-amount ${cls}">${sign}${formatMoney(t.amount)}</div>
          <div class="tx-meta">${catName} · ${formatDateTh(t.date)}${kindHtml}${bookHint}</div>
          ${t.note ? `<div class="tx-note">${escapeHtml(t.note)}</div>` : ""}
        </div>
        <div class="tx-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-edit-tx="${t.id}">แก้ไข</button>
          <button type="button" class="btn btn-danger btn-sm" data-del-tx="${t.id}">ลบ</button>
        </div>
      `;
      ul.appendChild(li);
    }
    ul.querySelectorAll("[data-edit-tx]").forEach((btn) => {
      btn.addEventListener("click", () => openTxModal(btn.getAttribute("data-edit-tx")));
    });
    ul.querySelectorAll("[data-del-tx]").forEach((btn) => {
      btn.addEventListener("click", () => deleteTx(btn.getAttribute("data-del-tx")));
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function renderCategories() {
    const ul = document.getElementById("catList");
    const empty = document.getElementById("catEmpty");
    const cats = [...state.categories].sort((a, b) => {
      if (a.type !== b.type) return a.type === "income" ? -1 : 1;
      return a.name.localeCompare(b.name, "th");
    });
    ul.innerHTML = "";
    if (cats.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    for (const c of cats) {
      const li = document.createElement("li");
      li.className = "cat-item";
      const badge = c.type === "income" ? "รับ" : "จ่าย";
      const badgeCls = c.type === "income" ? "income" : "expense";
      const kindBadge =
        c.type === "expense"
          ? getExpenseKind(c) === "fixed"
            ? `<span class="cat-badge expense-fixed">คงที่</span>`
            : `<span class="cat-badge expense-general">ทั่วไป</span>`
          : "";
      li.innerHTML = `
        <div class="cat-info">
          <div class="cat-name">${escapeHtml(c.name)}</div>
          <span class="cat-badge ${badgeCls}">${badge}</span>${kindBadge}
        </div>
        <div class="tx-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-edit-cat="${c.id}">แก้ไข</button>
          <button type="button" class="btn btn-danger btn-sm" data-del-cat="${c.id}">ลบ</button>
        </div>
      `;
      ul.appendChild(li);
    }
    ul.querySelectorAll("[data-edit-cat]").forEach((btn) => {
      btn.addEventListener("click", () => openCatModal(btn.getAttribute("data-edit-cat")));
    });
    ul.querySelectorAll("[data-del-cat]").forEach((btn) => {
      btn.addEventListener("click", () => deleteCat(btn.getAttribute("data-del-cat")));
    });
  }

  function fillCategorySelect(type) {
    const sel = document.getElementById("txCategory");
    const current = sel.value;
    sel.innerHTML = "";
    const opts = state.categories.filter((c) => c.type === type);
    for (const c of opts) {
      const o = document.createElement("option");
      o.value = c.id;
      const suffix = c.type === "expense" ? (getExpenseKind(c) === "fixed" ? " · คงที่" : " · ทั่วไป") : "";
      o.textContent = c.name + suffix;
      sel.appendChild(o);
    }
    if (opts.length === 0) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "— เพิ่มหมวดก่อน —";
      sel.appendChild(o);
    } else if (current && opts.some((c) => c.id === current)) {
      sel.value = current;
    }
  }

  function openTxModal(editId) {
    const modal = document.getElementById("modalTx");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    const title = document.getElementById("modalTxTitle");
    const form = document.getElementById("formTx");
    document.getElementById("txId").value = editId || "";
    if (editId) {
      const t = state.transactions.find((x) => x.id === editId);
      if (!t) return;
      title.textContent = "แก้ไข";
      document.getElementById("txType").value = t.type;
      document.getElementById("txDate").value = t.date;
      document.getElementById("txAmount").value = String(t.amount);
      document.getElementById("txNote").value = t.note || "";
      document.getElementById("txBookMonth").value = t.bookMonth || "";
      fillCategorySelect(t.type);
      document.getElementById("txCategory").value = t.categoryId;
    } else {
      title.textContent = "เพิ่ม";
      form.reset();
      document.getElementById("txId").value = "";
      document.getElementById("txBookMonth").value = "";
      const now = new Date();
      const y = viewMonth.y;
      const m = viewMonth.m;
      let day;
      if (now.getFullYear() === y && now.getMonth() === m) {
        day = now.getDate();
      } else {
        day = new Date(y, m + 1, 0).getDate();
      }
      document.getElementById("txDate").value = `${y}-${pad2(m + 1)}-${pad2(day)}`;
      document.getElementById("txType").value = "expense";
      fillCategorySelect("expense");
    }
  }

  function closeTxModal() {
    var m = document.getElementById("modalTx");
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
  }

  function syncCatExpenseKindVisibility() {
    const expense = document.getElementById("catType").value === "expense";
    document.getElementById("catExpenseKindWrap").hidden = !expense;
  }

  function openCatModal(editId) {
    const modal = document.getElementById("modalCat");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    const title = document.getElementById("modalCatTitle");
    document.getElementById("catId").value = editId || "";
    if (editId) {
      const c = state.categories.find((x) => x.id === editId);
      if (!c) return;
      title.textContent = "แก้ไข";
      document.getElementById("catType").value = c.type;
      document.getElementById("catName").value = c.name;
      document.getElementById("catExpenseKind").value = getExpenseKind(c) === "fixed" ? "fixed" : "general";
    } else {
      title.textContent = "เพิ่ม";
      document.getElementById("formCat").reset();
      document.getElementById("catId").value = "";
      document.getElementById("catExpenseKind").value = "general";
    }
    syncCatExpenseKindVisibility();
  }

  function closeCatModal() {
    var m = document.getElementById("modalCat");
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
  }

  function deleteTx(id) {
    if (!confirm("ลบรายการ?")) return;
    state.transactions = state.transactions.filter((t) => t.id !== id);
    save();
    refresh();
  }

  function deleteCat(id) {
    const used = state.transactions.some((t) => t.categoryId === id);
    if (used && !confirm("หมวดนี้มีรายการอ้างอิง — ลบต่อ?")) return;
    if (!used && !confirm("ลบหมวด?")) return;
    state.categories = state.categories.filter((c) => c.id !== id);
    save();
    refresh();
  }

  function submitTx(e) {
    e.preventDefault();
    const editId = document.getElementById("txId").value;
    const type = /** @type {'income'|'expense'} */ (document.getElementById("txType").value);
    const date = document.getElementById("txDate").value;
    const amount = parseFloat(document.getElementById("txAmount").value);
    const categoryId = document.getElementById("txCategory").value;
    const note = document.getElementById("txNote").value.trim();
    const bookMonth = resolveBookMonth(date, document.getElementById("txBookMonth").value);
    if (!categoryId) {
      alert("เพิ่มหมวดก่อน");
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      alert("จำนวนเงินไม่ถูกต้อง");
      return;
    }
    const cat = categoryById(categoryId);
    if (!cat || cat.type !== type) {
      alert("หมวดไม่ตรงประเภท");
      return;
    }
    if (editId) {
      const t = state.transactions.find((x) => x.id === editId);
      if (t) {
        Object.assign(t, { date, amount, type, categoryId, note });
        if (bookMonth) t.bookMonth = bookMonth;
        else delete t.bookMonth;
      }
    } else {
      /** @type {Transaction} */
      const tx = {
        id: uid(),
        date,
        amount,
        type,
        categoryId,
        note,
      };
      if (bookMonth) tx.bookMonth = bookMonth;
      state.transactions.push(tx);
    }
    save();
    closeTxModal();
    refresh();
  }

  function submitCat(e) {
    e.preventDefault();
    const editId = document.getElementById("catId").value;
    const type = /** @type {'income'|'expense'} */ (document.getElementById("catType").value);
    const name = document.getElementById("catName").value.trim();
    if (!name) return;
    if (editId) {
      const c = state.categories.find((x) => x.id === editId);
      if (c) {
        const oldType = c.type;
        c.name = name;
        c.type = type;
        if (type === "expense") {
          c.expenseKind = document.getElementById("catExpenseKind").value === "fixed" ? "fixed" : "general";
        } else {
          delete c.expenseKind;
        }
        if (oldType !== type) {
          state.transactions.forEach((t) => {
            if (t.categoryId === c.id && t.type !== type) t.type = type;
          });
        }
      }
    } else {
      /** @type {Category} */
      const cat = { id: uid(), name, type };
      if (type === "expense") {
        cat.expenseKind = document.getElementById("catExpenseKind").value === "fixed" ? "fixed" : "general";
      }
      state.categories.push(cat);
    }
    save();
    closeCatModal();
    refresh();
  }

  function refresh() {
    renderMonthLabel();
    renderSummary();
    renderTransactions();
    renderCategories();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cash-book-${monthKey(viewMonth.y, viewMonth.m)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.categories || !data.transactions) throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");
        state = {
          categories: data.categories,
          transactions: data.transactions,
        };
        normalizeCategories();
        save();
        refresh();
        alert("นำเข้าสำเร็จ");
      } catch (err) {
        alert("นำเข้าไม่สำเร็จ: " + (err.message || err));
      }
    };
    reader.readAsText(file);
  }

  function updateFooterNote() {
    const el = document.getElementById("footerNote");
    if (el) el.textContent = useGas() || useSheetApi() ? "บันทึกใน Google Sheet" : "เก็บในเครื่อง";
  }

  /** ผูกปุ่มครั้งเดียวทันที — ห้ามรอ loadStateFromServer (ถ้ารอ RPC ปุ่มจะกดไม่ได้จนกว่าโหลดเสร็จ / หรือค้างถาวร) */
  var uiBound = false;

  function start() {
    bindUi();
    updateFooterNote();
    if (useGas()) {
      refresh();
      google.script.run
        .withSuccessHandler(function (json) {
          applyServerState(json || '{"categories":[],"transactions":[]}');
          refresh();
        })
        .withFailureHandler(function () {
          alert("โหลด Google Sheet ไม่สำเร็จ — ใช้ข้อมูลในเครื่องชั่วคราว");
          loadFromLocalStorage();
          refresh();
        })
        .loadStateFromServer();
    } else if (useSheetApi()) {
      refresh();
      loadFromSheetApi(function () {
        refresh();
      });
    } else {
      loadFromLocalStorage();
      refresh();
    }
  }

  function enforceModalsClosed() {
    ["modalTx", "modalCat"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.remove("is-open");
        el.setAttribute("aria-hidden", "true");
      }
    });
  }

  function bindUi() {
    if (uiBound) return;
    uiBound = true;
    enforceModalsClosed();

    document.getElementById("prevMonth").addEventListener("click", () => {
      viewMonth.m -= 1;
      if (viewMonth.m < 0) {
        viewMonth.m = 11;
        viewMonth.y -= 1;
      }
      refresh();
    });
    document.getElementById("nextMonth").addEventListener("click", () => {
      viewMonth.m += 1;
      if (viewMonth.m > 11) {
        viewMonth.m = 0;
        viewMonth.y += 1;
      }
      refresh();
    });
    document.getElementById("goToday").addEventListener("click", () => {
      viewMonth = currentYM();
      refresh();
    });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const panel = tab.getAttribute("data-panel");
        document.querySelectorAll(".tab").forEach((t) => {
          t.classList.toggle("active", t === tab);
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });
        document.getElementById("panel-transactions").classList.toggle("active", panel === "transactions");
        document.getElementById("panel-transactions").hidden = panel !== "transactions";
        document.getElementById("panel-categories").classList.toggle("active", panel === "categories");
        document.getElementById("panel-categories").hidden = panel !== "categories";
      });
    });

    document.getElementById("openAddTx").addEventListener("click", () => openTxModal(null));
    document.getElementById("cancelTx").addEventListener("click", closeTxModal);
    document.getElementById("formTx").addEventListener("submit", submitTx);
    document.getElementById("txType").addEventListener("change", () => {
      const type = document.getElementById("txType").value;
      fillCategorySelect(type === "income" ? "income" : "expense");
    });

    document.getElementById("modalTx").addEventListener("click", (e) => {
      if (e.target.id === "modalTx") closeTxModal();
    });

    document.getElementById("openAddCat").addEventListener("click", () => openCatModal(null));
    document.getElementById("cancelCat").addEventListener("click", closeCatModal);
    document.getElementById("formCat").addEventListener("submit", submitCat);
    document.getElementById("catType").addEventListener("change", syncCatExpenseKindVisibility);
    document.getElementById("modalCat").addEventListener("click", (e) => {
      if (e.target.id === "modalCat") closeCatModal();
    });

    document.getElementById("exportData").addEventListener("click", exportJson);
    document.getElementById("importData").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importJson(f);
      e.target.value = "";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

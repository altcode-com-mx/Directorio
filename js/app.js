import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

/** Colección en Firestore. Ajusta reglas de seguridad en la consola de Firebase. */
const COLLECTION = "clientes";

const SERVICIO = {
  web: { label: "Desarrollo Web", cls: "tag-web" },
  saas: { label: "SaaS", cls: "tag-saas" },
  chatbot: { label: "ChatBot", cls: "tag-chatbot" },
  otro: { label: "Otro", cls: "tag-otro" },
};

const ESTADO = {
  pendiente: { label: "Pendiente", cls: "status-pendiente" },
  exitosa: { label: "Llamada Exitosa", cls: "status-exitosa" },
  fallida: { label: "Llamada Fallida", cls: "status-fallida" },
};

let contacts = [];
let unsubscribe = null;

const state = {
  filterServicio: "all",
  filterEstado: "all",
  filterCita: "all",
  sortBy: "created_desc",
  search: "",
};

function $(id) {
  return document.getElementById(id);
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

function formatCreated(v) {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCitaDisplay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isCitaPast(iso) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t < Date.now();
}

function showToast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("error", isError);
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

function getFormPayload() {
  const nombre = $("f-nombre").value.trim();
  const telefono = $("f-tel").value.trim();
  const direccion = $("f-dir").value.trim();
  const servicio = $("f-servicio").value;
  const notas = $("f-notas").value.trim();
  const estado = $("f-estado").value;
  const citaToggle = $("f-cita-toggle").checked;
  const citaVal = $("f-cita").value;

  let citaIso = null;
  if (citaToggle) {
    if (!citaVal) {
      showToast("Indica fecha y hora de la reunión virtual o desmarca la opción.", true);
      return null;
    }
    citaIso = new Date(citaVal).toISOString();
  }

  if (!nombre) {
    showToast("El nombre es obligatorio.", true);
    return null;
  }

  return {
    nombre,
    telefono,
    direccion,
    servicio,
    notas,
    estado,
    citaIso,
  };
}

async function addContact() {
  const payload = getFormPayload();
  if (!payload) return;

  const btn = $("btn-add");
  btn.disabled = true;
  try {
    await addDoc(collection(db, COLLECTION), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    clearForm();
    showToast("Cliente registrado correctamente.");
  } catch (e) {
    console.error(e);
    showToast(
      "No se pudo guardar. Revisa la conexión y las reglas de Firestore.",
      true
    );
  } finally {
    btn.disabled = false;
  }
}

async function deleteContact(id) {
  if (!confirm("¿Eliminar este registro?")) return;
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    showToast("Registro eliminado.");
  } catch (e) {
    console.error(e);
    showToast("No se pudo eliminar el registro.", true);
  }
}

function toggleEdit(id) {
  const view = $("view-" + id);
  const edit = $("edit-" + id);
  const isOpen = edit.classList.contains("active");

  document.querySelectorAll(".card-edit.active").forEach((el) => {
    el.classList.remove("active");
  });
  document.querySelectorAll(".card-view").forEach((el) => {
    el.style.display = "grid";
  });

  if (!isOpen) {
    view.style.display = "none";
    edit.classList.add("active");
  }
}

function cancelEdit(id) {
  $("view-" + id).style.display = "grid";
  $("edit-" + id).classList.remove("active");
}

function getEditPayload(id) {
  const nombre = $("e-nombre-" + id).value.trim();
  const telefono = $("e-tel-" + id).value.trim();
  const direccion = $("e-dir-" + id).value.trim();
  const servicio = $("e-servicio-" + id).value;
  const notas = $("e-notas-" + id).value.trim();
  const estado = $("e-estado-" + id).value;
  const citaToggle = $("e-cita-toggle-" + id).checked;
  const citaVal = $("e-cita-" + id).value;

  let citaIso = null;
  if (citaToggle) {
    if (!citaVal) {
      showToast("Indica fecha y hora de la cita o desmarca agendar reunión.", true);
      return null;
    }
    citaIso = new Date(citaVal).toISOString();
  }

  if (!nombre) {
    showToast("El nombre es obligatorio.", true);
    return null;
  }

  return {
    nombre,
    telefono,
    direccion,
    servicio,
    notas,
    estado,
    citaIso,
  };
}

async function saveEdit(id) {
  const payload = getEditPayload(id);
  if (!payload) return;

  try {
    await updateDoc(doc(db, COLLECTION, id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    showToast("Cambios guardados.");
  } catch (e) {
    console.error(e);
    showToast("No se pudieron guardar los cambios.", true);
  }
}

function setFilterServicio(btn, value) {
  state.filterServicio = value;
  document.querySelectorAll("[data-filter-servicio]").forEach((b) => {
    b.classList.toggle("active", b === btn);
  });
  renderCards();
}

function setFilterEstado(btn, value) {
  state.filterEstado = value;
  document.querySelectorAll("[data-filter-estado]").forEach((b) => {
    b.classList.toggle("active", b === btn);
  });
  renderCards();
}

function setFilterCita(btn, value) {
  state.filterCita = value;
  document.querySelectorAll("[data-filter-cita]").forEach((b) => {
    b.classList.toggle("active", b === btn);
  });
  renderCards();
}

function resetFilters() {
  state.filterServicio = "all";
  state.filterEstado = "all";
  state.filterCita = "all";
  state.sortBy = "created_desc";
  state.search = "";
  $("searchInput").value = "";
  $("sortBy").value = "created_desc";

  document.querySelectorAll("[data-filter-servicio]").forEach((b) => {
    b.classList.toggle(
      "active",
      b.getAttribute("data-filter-servicio") === "all"
    );
  });
  document.querySelectorAll("[data-filter-estado]").forEach((b) => {
    b.classList.toggle(
      "active",
      b.getAttribute("data-filter-estado") === "all"
    );
  });
  document.querySelectorAll("[data-filter-cita]").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-filter-cita") === "all");
  });
  renderCards();
}

function matchesSearch(c, q) {
  if (!q) return true;
  const hay = [
    c.nombre,
    c.telefono,
    c.direccion,
    c.notas,
    SERVICIO[c.servicio]?.label,
    ESTADO[c.estado]?.label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function passesFilters(c) {
  if (state.filterServicio !== "all" && c.servicio !== state.filterServicio) {
    return false;
  }
  if (state.filterEstado !== "all" && c.estado !== state.filterEstado) {
    return false;
  }
  if (state.filterCita === "con" && !c.citaIso) return false;
  if (state.filterCita === "sin" && c.citaIso) return false;
  if (state.filterCita === "proximas") {
    if (!c.citaIso) return false;
    const t = Date.parse(c.citaIso);
    if (Number.isNaN(t) || t < Date.now()) return false;
  }
  if (state.filterCita === "pasadas") {
    if (!c.citaIso) return false;
    if (!isCitaPast(c.citaIso)) return false;
  }
  return true;
}

function sortList(list) {
  const copy = [...list];
  const byNombre = (a, b) =>
    (a.nombre || "").localeCompare(b.nombre || "", "es", {
      sensitivity: "base",
    });

  switch (state.sortBy) {
    case "nombre_asc":
      return copy.sort(byNombre);
    case "nombre_desc":
      return copy.sort((a, b) => -byNombre(a, b));
    case "created_asc":
      return copy.sort(
        (a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)
      );
    case "created_desc":
      return copy.sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
      );
    case "cita_asc": {
      return copy.sort((a, b) => {
        const ta = a.citaIso ? Date.parse(a.citaIso) : Infinity;
        const tb = b.citaIso ? Date.parse(b.citaIso) : Infinity;
        if (!a.citaIso && !b.citaIso) return 0;
        if (!a.citaIso) return 1;
        if (!b.citaIso) return -1;
        return ta - tb;
      });
    }
    case "cita_desc": {
      return copy.sort((a, b) => {
        const ta = a.citaIso ? Date.parse(a.citaIso) : -Infinity;
        const tb = b.citaIso ? Date.parse(b.citaIso) : -Infinity;
        if (!a.citaIso && !b.citaIso) return 0;
        if (!a.citaIso) return 1;
        if (!b.citaIso) return -1;
        return tb - ta;
      });
    }
    default:
      return copy;
  }
}

function renderCards() {
  const q = ($("searchInput")?.value || "").toLowerCase().trim();
  state.search = q;

  let filtered = contacts.filter((c) => passesFilters(c) && matchesSearch(c, q));
  filtered = sortList(filtered);

  const list = $("cardsList");
  const total = contacts.length;
  $("totalCount").textContent = `${total} cliente${total !== 1 ? "s" : ""}`;

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📂</div>
        <p>${
          total === 0
            ? "<strong>Sin registros aún.</strong><br>Añade tu primer prospecto con el formulario."
            : "Ningún resultado coincide con los filtros o la búsqueda."
        }</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered
    .map((c) => {
      const tag = SERVICIO[c.servicio] || {
        label: c.servicio || "—",
        cls: "tag-custom",
      };
      const st = ESTADO[c.estado] || {
        label: c.estado || "—",
        cls: "status-pendiente",
      };
      const citaPast = c.citaIso && isCitaPast(c.citaIso);
      const citaClass = citaPast ? "cita-row past" : "cita-row";

      const citaLocalValue = c.citaIso
        ? (() => {
            const d = new Date(c.citaIso);
            const pad = (n) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          })()
        : "";

      return `
      <div class="card" id="card-${esc(c.id)}">
        <div class="card-view" id="view-${esc(c.id)}">
          <div class="card-left">
            <div class="card-top">
              <span class="card-name">${esc(c.nombre)}</span>
              <span class="tag ${tag.cls}">${esc(tag.label)}</span>
              <span class="status-badge ${st.cls}">${esc(st.label)}</span>
            </div>
            <div class="card-meta">
              ${
                c.telefono
                  ? `<div class="meta-row">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 15z"/>
                </svg>
                <span>${esc(c.telefono)}</span>
              </div>`
                  : ""
              }
              ${
                c.direccion
                  ? `<div class="meta-row">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <span>${esc(c.direccion)}</span>
              </div>`
                  : ""
              }
              <div class="meta-row">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span style="color:var(--muted)">Alta: ${formatCreated(c.createdAt)}</span>
              </div>
              ${
                c.citaIso
                  ? `<div class="${citaClass}">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                Reunión: ${esc(formatCitaDisplay(c.citaIso))}
              </div>`
                  : ""
              }
            </div>
            ${c.notas ? `<div class="card-notes">${esc(c.notas)}</div>` : ""}
          </div>
          <div class="card-actions">
            <button type="button" class="btn-icon edit" data-action="edit" data-id="${esc(c.id)}" title="Editar">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button type="button" class="btn-icon del" data-action="del" data-id="${esc(c.id)}" title="Eliminar">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="card-edit" id="edit-${esc(c.id)}">
          <div class="edit-row">
            <div class="edit-field" style="grid-column:1/-1">
              <label>Nombre / Empresa</label>
              <input type="text" id="e-nombre-${esc(c.id)}" value="${esc(c.nombre)}">
            </div>
            <div class="edit-field">
              <label>Teléfono</label>
              <input type="text" id="e-tel-${esc(c.id)}" value="${esc(c.telefono || "")}">
            </div>
            <div class="edit-field">
              <label>Servicio de interés</label>
              <select id="e-servicio-${esc(c.id)}">
                <option value="web" ${c.servicio === "web" ? "selected" : ""}>Desarrollo Web</option>
                <option value="saas" ${c.servicio === "saas" ? "selected" : ""}>SaaS</option>
                <option value="chatbot" ${c.servicio === "chatbot" ? "selected" : ""}>ChatBot</option>
                <option value="otro" ${c.servicio === "otro" ? "selected" : ""}>Otro</option>
              </select>
            </div>
            <div class="edit-field">
              <label>Estado</label>
              <select id="e-estado-${esc(c.id)}">
                <option value="pendiente" ${c.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
                <option value="exitosa" ${c.estado === "exitosa" ? "selected" : ""}>Llamada Exitosa</option>
                <option value="fallida" ${c.estado === "fallida" ? "selected" : ""}>Llamada Fallida</option>
              </select>
            </div>
            <div class="edit-field" style="grid-column:1/-1">
              <label>Dirección</label>
              <input type="text" id="e-dir-${esc(c.id)}" value="${esc(c.direccion || "")}">
            </div>
            <div class="edit-field" style="grid-column:1/-1">
              <label class="field-inline"><input type="checkbox" id="e-cita-toggle-${esc(c.id)}" ${c.citaIso ? "checked" : ""}> Agendar reunión virtual</label>
              <input type="datetime-local" id="e-cita-${esc(c.id)}" value="${esc(citaLocalValue)}">
            </div>
            <div class="edit-field" style="grid-column:1/-1">
              <label>Notas</label>
              <textarea id="e-notas-${esc(c.id)}" rows="2">${esc(c.notas || "")}</textarea>
            </div>
          </div>
          <div class="edit-actions">
            <button type="button" class="btn-cancel" data-action="cancel" data-id="${esc(c.id)}">Cancelar</button>
            <button type="button" class="btn-save" data-action="save" data-id="${esc(c.id)}">Guardar cambios</button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

function clearForm() {
  $("f-nombre").value = "";
  $("f-tel").value = "";
  $("f-dir").value = "";
  $("f-servicio").value = "web";
  $("f-notas").value = "";
  $("f-estado").value = "pendiente";
  $("f-cita-toggle").checked = false;
  $("f-cita").value = "";
  $("f-cita-fields").classList.remove("visible");
}

function bindCitaToggle() {
  const toggle = $("f-cita-toggle");
  const box = $("f-cita-fields");
  toggle.addEventListener("change", () => {
    box.classList.toggle("visible", toggle.checked);
    if (!toggle.checked) $("f-cita").value = "";
  });
}

function subscribe() {
  if (unsubscribe) unsubscribe();
  const col = collection(db, COLLECTION);
  unsubscribe = onSnapshot(
    col,
    (snap) => {
      contacts = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          ...x,
          direccion: x.direccion ?? x.dir ?? "",
        };
      });
      $("loadingLine").textContent = "";
      renderCards();
    },
    (err) => {
      console.error(err);
      $("loadingLine").textContent =
        "Error al sincronizar con Firestore. Comprueba reglas y red.";
      showToast("Error de sincronización con la base de datos.", true);
    }
  );
}

function bindEditCitaClear() {
  document.body.addEventListener("change", (e) => {
    const t = e.target;
    if (!t?.id?.startsWith("e-cita-toggle-")) return;
    const suffix = t.id.slice("e-cita-toggle-".length);
    const inp = document.getElementById(`e-cita-${suffix}`);
    if (inp && !t.checked) inp.value = "";
  });
}

function bindDelegated() {
  document.body.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const id = t.getAttribute("data-id");
    const action = t.getAttribute("data-action");
    if (action === "edit" && id) toggleEdit(id);
    if (action === "del" && id) deleteContact(id);
    if (action === "cancel" && id) cancelEdit(id);
    if (action === "save" && id) saveEdit(id);
  });
}

function bindFilterButtons() {
  document.querySelectorAll("[data-filter-servicio]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFilterServicio(btn, btn.getAttribute("data-filter-servicio"));
    });
  });
  document.querySelectorAll("[data-filter-estado]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFilterEstado(btn, btn.getAttribute("data-filter-estado"));
    });
  });
  document.querySelectorAll("[data-filter-cita]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFilterCita(btn, btn.getAttribute("data-filter-cita"));
    });
  });
}

function init() {
  $("btn-add").addEventListener("click", addContact);
  $("searchInput").addEventListener("input", renderCards);
  $("sortBy").addEventListener("change", () => {
    state.sortBy = $("sortBy").value;
    renderCards();
  });
  $("btn-reset-filters").addEventListener("click", resetFilters);
  bindCitaToggle();
  bindEditCitaClear();
  bindDelegated();
  bindFilterButtons();

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) addContact();
  });

  subscribe();
}

init();

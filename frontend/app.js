function resolverApiBaseUrl() {
  if (window.location.protocol === "file:") {
    return "http://localhost:3005";
  }
  const puertosSoloFrontend = [
    "4400",
    "4200",
    "5500",
    "5173",
    "8080",
    "4173",
    "5000"
  ];
  const port = window.location.port;
  if (puertosSoloFrontend.includes(port)) {
    const host = window.location.hostname;
    return `http://${host}:3005`;
  }
  return window.location.origin;
}

const API_BASE_URL = resolverApiBaseUrl();
const TOKEN_STORAGE_KEY = "inventarioScannerToken";

function obtenerToken() {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function guardarToken(token) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function borrarToken() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function apiFetch(ruta, opciones = {}) {
  const headers = new Headers(opciones.headers || {});
  const token = obtenerToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE_URL}${ruta}`, {
    ...opciones,
    headers
  });
  if (response.status === 401) {
    cerrarSesionUi(true);
  }
  return response;
}

const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const pantallaLogin = document.getElementById("pantallaLogin");
const formLogin = document.getElementById("formLogin");
const loginUsuarioEl = document.getElementById("loginUsuario");
const loginPasswordEl = document.getElementById("loginPassword");
const loginErrorEl = document.getElementById("loginError");
const loginSubmitEl = document.getElementById("loginSubmit");
const appPrincipal = document.getElementById("appPrincipal");
const sesionUsuarioEl = document.getElementById("sesionUsuario");
const cerrarSesionBtn = document.getElementById("cerrarSesionBtn");
const estadoEl = document.getElementById("estado");
const codigoInputEl = document.getElementById("codigoInput");
const buscarBtnEl = document.getElementById("buscarBtn");
const escanearBtnEl = document.getElementById("escanearBtn");
const fotoArchivoBtn = document.getElementById("fotoArchivoBtn");
const inputFotoProducto = document.getElementById("inputFotoProducto");
const capturarFotoBtn = document.getElementById("capturarFotoBtn");
const buscarZonaBtn = document.getElementById("buscarZonaBtn");
const volverCamaraBtn = document.getElementById("volverCamaraBtn");
const ocrVistaEl = document.getElementById("ocrVista");
const scannerShell = document.getElementById("scannerShell");
const canvasVisor = document.getElementById("canvasVisor");
const rectSeleccion = document.getElementById("rectSeleccion");
const resumenBusqueda = document.getElementById("resumenBusqueda");
const resultadosBody = document.getElementById("resultadosBody");
const sinResultados = document.getElementById("sinResultados");
const panelProducto = document.getElementById("panelProducto");
const prodCodigo = document.getElementById("prodCodigo");
const productoDescripcionInput = document.getElementById("productoDescripcionInput");
const prodMarca = document.getElementById("prodMarca");
const prodCat = document.getElementById("prodCat");
const prodStock = document.getElementById("prodStock");
const prodStockRealActual = document.getElementById("prodStockRealActual");
const stockCatalogoInput = document.getElementById("stockCatalogoInput");
const stockRealInput = document.getElementById("stockRealInput");
const chkGuardarStock = document.getElementById("chkGuardarStock");
const chkGuardarStockReal = document.getElementById("chkGuardarStockReal");
const chkGuardarVerificado = document.getElementById("chkGuardarVerificado");
const prodVerificadoActual = document.getElementById("prodVerificadoActual");
const guardarStockBtn = document.getElementById("guardarStockBtn");
const mensajeStock = document.getElementById("mensajeStock");
const abrirModalSyncStock = document.getElementById("abrirModalSyncStock");
const modalSyncStock = document.getElementById("modalSyncStock");
const modalSyncStockBackdrop = document.getElementById("modalSyncStockBackdrop");
const cerrarModalSyncStock = document.getElementById("cerrarModalSyncStock");
const ejecutarSyncStock = document.getElementById("ejecutarSyncStock");
const syncStockFile = document.getElementById("syncStockFile");
const syncStockResultado = document.getElementById("syncStockResultado");
const resumenTotalProductosRegistrados = document.getElementById(
  "resumenTotalProductosRegistrados"
);
const resumenDifNegativa = document.getElementById("resumenDifNegativa");
const resumenDifPositiva = document.getElementById("resumenDifPositiva");
const resumenStockConforme = document.getElementById("resumenStockConforme");
const resumenProductosVerificados = document.getElementById(
  "resumenProductosVerificados"
);
const resumenStockVsRealAviso = document.getElementById("resumenStockVsRealAviso");
const btnRefrescarResumenStock = document.getElementById("btnRefrescarResumenStock");
const btnVerDifNegativa = document.getElementById("btnVerDifNegativa");
const btnVerDifPositiva = document.getElementById("btnVerDifPositiva");
const resultadosBusquedaSection = document.getElementById(
  "resultadosBusquedaSection"
);
const resultadosTheadRow = document.getElementById("resultadosTheadRow");
const abrirModalReconciliacion = document.getElementById("abrirModalReconciliacion");
const modalReconciliacion = document.getElementById("modalReconciliacion");
const modalReconciliacionBackdrop = document.getElementById(
  "modalReconciliacionBackdrop"
);
const cerrarModalReconciliacion = document.getElementById("cerrarModalReconciliacion");
const ejecutarReconciliacionBtn = document.getElementById("ejecutarReconciliacion");
const reconFileStockAnterior = document.getElementById("reconFileStockAnterior");
const reconFileCompras = document.getElementById("reconFileCompras");
const reconFileVentas = document.getElementById("reconFileVentas");
const reconFileStockActual = document.getElementById("reconFileStockActual");
const reconResultado = document.getElementById("reconResultado");
const reconResumenBox = document.getElementById("reconResumenBox");
const reconProductosAnalizados = document.getElementById("reconProductosAnalizados");
const reconFaltantes = document.getElementById("reconFaltantes");
const reconSobrantes = document.getElementById("reconSobrantes");
const reconConformes = document.getElementById("reconConformes");
const btnVerReconFaltantes = document.getElementById("btnVerReconFaltantes");
const btnVerReconSobrantes = document.getElementById("btnVerReconSobrantes");

/** Último resumen cargado (refrescar resumen o tras sincronizar). */
let ultimoResumenStockVsReal = null;
/** @type {{ faltantes: object[], sobrantes: object[], conformes: object[] }|null} */
let ultimoResultadoReconciliacion = null;

let ultimoCodigoProcesado = "";
let ultimoTimestamp = 0;
const DEBOUNCE_MS = 1500;

let camaraActiva = false;
let quaggaListo = false;
let quaggaInicializado = false;
let deteccionRegistrada = false;
let buscandoEnExcel = false;
let ocrEnProceso = false;
let cargandoUi = false;
let modoFoto = false;
/** @type {HTMLCanvasElement|null} */
let canvasOrigen = null;
let visorMap = null;
let seleccion = null;
let arrastrandoSeleccion = false;
let codigoProductoPanel = "";
let guardandoStock = false;

function esOrigenCamaraPermitido() {
  if (typeof window.isSecureContext === "boolean" && window.isSecureContext) {
    return true;
  }
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

function setCargando(activo, texto = "Cargando…") {
  cargandoUi = activo;
  loadingOverlay.classList.toggle("visible", activo);
  loadingOverlay.setAttribute("aria-hidden", activo ? "false" : "true");
  loadingText.textContent = texto;
}

function setEstado(texto, fase = "idle") {
  estadoEl.textContent = `Estado: ${texto}`;
  estadoEl.setAttribute("data-fase", fase);
}

function val(v) {
  if (v === undefined || v === null || v === "") {
    return "—";
  }
  return String(v);
}

function textoVerificadoTabla(item) {
  return item?.verificado === true ? "Sí" : "No";
}

function renderPanelProducto(p) {
  if (!p || !p.codigo) {
    panelProducto.hidden = true;
    codigoProductoPanel = "";
    stockCatalogoInput.value = "";
    stockRealInput.value = "";
    if (productoDescripcionInput) {
      productoDescripcionInput.value = "";
    }
    chkGuardarStock.checked = false;
    chkGuardarStockReal.checked = true;
    if (chkGuardarVerificado) {
      chkGuardarVerificado.checked = false;
    }
    if (prodVerificadoActual) {
      prodVerificadoActual.textContent = "—";
    }
    mensajeStock.textContent = "";
    mensajeStock.className = "mensaje-stock";
    return;
  }
  codigoProductoPanel = String(p.codigo);
  panelProducto.hidden = false;
  prodCodigo.textContent = p.codigo;
  if (productoDescripcionInput) {
    productoDescripcionInput.value = String(p.producto ?? "").trim();
  }
  prodMarca.textContent = val(p.marca);
  prodCat.textContent = val(p.categoria);
  prodStock.textContent = val(p.stock);
  prodStockRealActual.textContent = val(p.stockReal);
  const sc =
    p.stock !== undefined && p.stock !== "" && Number.isFinite(Number(p.stock))
      ? String(Math.round(Number(p.stock)))
      : "";
  stockCatalogoInput.value = sc;
  const sr =
    p.stockReal !== undefined && p.stockReal !== "" && Number.isFinite(Number(p.stockReal))
      ? String(Math.round(Number(p.stockReal)))
      : "";
  stockRealInput.value = sr;
  chkGuardarStock.checked = false;
  chkGuardarStockReal.checked = true;
  if (chkGuardarVerificado) {
    chkGuardarVerificado.checked = p.verificado === true;
  }
  if (prodVerificadoActual) {
    prodVerificadoActual.textContent = p.verificado === true ? "Sí" : "No";
  }
  mensajeStock.textContent = "";
  mensajeStock.className = "mensaje-stock";
}

function renderResumenBusqueda(resultado) {
  const lista = resultado.resultados || [];
  const n = lista.length;
  const meta = resultado.meta || {};
  if (n === 0) {
    resumenBusqueda.textContent = meta.pedirZona
      ? "Ningún código de la etiqueta coincidió. Usa «Buscar texto en zona» sobre el código."
      : "Sin coincidencias en código ni en nombre de producto (ni campos relacionados).";
    resumenBusqueda.className = "muted";
    return;
  }
  let texto = `${n} resultado(s) en catálogo (código, producto, marca, categoría, etc.).`;
  if (meta.coincidenciaExactaCodigo) {
    texto += " Incluye coincidencia exacta de código si aplica.";
  }
  resumenBusqueda.textContent = texto;
  resumenBusqueda.className = "";
}

function renderTablaResultados(items) {
  restaurarTheadBusqueda();
  resultadosBody.innerHTML = "";
  if (!items.length) {
    sinResultados.hidden = false;
    return;
  }
  sinResultados.hidden = true;
  items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.codigo)}</td>
      <td>${escapeHtml(String(item.producto || ""))}</td>
      <td>${escapeHtml(String(item.marca || ""))}</td>
      <td>${escapeHtml(val(item.stock))}</td>
      <td>${escapeHtml(val(item.stockReal))}</td>
      <td class="celda-verif">${escapeHtml(textoVerificadoTabla(item))}</td>
      <td><button type="button" class="btn-elegir">Elegir</button></td>
    `;
    tr.querySelector("button").addEventListener("click", () => elegirProducto(item));
    resultadosBody.appendChild(tr);
  });
}

const THEAD_BUSQUEDA_HTML = `
  <th>Código</th>
  <th>Producto</th>
  <th>Marca</th>
  <th>Stock</th>
  <th>Stock real</th>
  <th title="Verificado">Verif.</th>
  <th></th>
`;

const THEAD_RECON_HTML = `
  <th>Código</th>
  <th>Producto</th>
  <th>Stock anterior</th>
  <th>Compras</th>
  <th>Ventas</th>
  <th>Stock esperado</th>
  <th>Stock sistema</th>
  <th>Diferencia</th>
`;

function restaurarTheadBusqueda() {
  if (resultadosTheadRow) {
    resultadosTheadRow.innerHTML = THEAD_BUSQUEDA_HTML;
  }
  resultadosBusquedaSection?.classList.remove("tabla-recon");
}

function aplicarTheadReconciliacion() {
  if (resultadosTheadRow) {
    resultadosTheadRow.innerHTML = THEAD_RECON_HTML;
  }
  resultadosBusquedaSection?.classList.add("tabla-recon");
}

function renderTablaReconciliacion(items) {
  aplicarTheadReconciliacion();
  resultadosBody.innerHTML = "";
  if (!items.length) {
    sinResultados.hidden = false;
    return;
  }
  sinResultados.hidden = true;
  items.forEach((item) => {
    const dif = Number(item.diferencia);
    let claseDif = "";
    if (dif < 0) {
      claseDif = "celda-dif-neg";
    } else if (dif > 0) {
      claseDif = "celda-dif-pos";
    }
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(String(item.codigo || ""))}</td>
      <td>${escapeHtml(String(item.producto || ""))}</td>
      <td class="celda-num">${escapeHtml(String(item.stockAnterior ?? item.stockBase ?? 0))}</td>
      <td class="celda-num">${escapeHtml(String(item.compras ?? 0))}</td>
      <td class="celda-num">${escapeHtml(String(item.ventas ?? 0))}</td>
      <td class="celda-num">${escapeHtml(String(item.stockEsperado ?? 0))}</td>
      <td class="celda-num">${escapeHtml(String(item.stockActual ?? 0))}</td>
      <td class="celda-num ${claseDif}">${escapeHtml(String(item.diferencia ?? 0))}</td>
    `;
    resultadosBody.appendChild(tr);
  });
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderResultado(resultado) {
  const lista = Array.isArray(resultado.resultados) ? resultado.resultados : [];
  renderResumenBusqueda(resultado);
  if (lista.length === 1) {
    renderPanelProducto(lista[0]);
    codigoInputEl.value = lista[0].codigo;
  } else {
    renderPanelProducto(null);
  }
  renderTablaResultados(lista);

  if (resultado.meta?.candidatosOcr?.length) {
    ocrVistaEl.hidden = false;
    ocrVistaEl.textContent = `Candidatos OCR: ${resultado.meta.candidatosOcr.join(", ")}`;
  } else {
    ocrVistaEl.hidden = true;
  }
}

function elegirProducto(item) {
  renderPanelProducto(item);
  codigoInputEl.value = item.codigo;
  setEstado(`Producto elegido: ${item.codigo}. Ajusta Stock y/o Stock real y guarda.`, "ok");
  panelProducto.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function guardarStockEnExcel() {
  if (guardandoStock) {
    return;
  }
  if (!codigoProductoPanel) {
    mensajeStock.textContent = "Primero busca o elige un producto.";
    mensajeStock.className = "mensaje-stock err";
    return;
  }

  const guardarStock = chkGuardarStock.checked;
  const guardarReal = chkGuardarStockReal.checked;

  const body = { codigo: codigoProductoPanel };

  if (chkGuardarVerificado) {
    body.verificado = chkGuardarVerificado.checked;
  }

  if (
    !guardarStock &&
    !guardarReal &&
    !Object.prototype.hasOwnProperty.call(body, "verificado")
  ) {
    mensajeStock.textContent =
      "Marca al menos una opción para guardar (stock, stock real o verificado).";
    mensajeStock.className = "mensaje-stock err";
    return;
  }

  if (guardarStock) {
    const rawS = stockCatalogoInput.value.trim();
    if (rawS === "") {
      mensajeStock.textContent = "Completa Stock (catálogo) o desmarca su casilla.";
      mensajeStock.className = "mensaje-stock err";
      return;
    }
    const numS = Number(rawS);
    if (!Number.isInteger(numS) || numS < 0) {
      mensajeStock.textContent = "Stock (catálogo): entero ≥ 0.";
      mensajeStock.className = "mensaje-stock err";
      return;
    }
    body.stock = numS;
  }

  if (guardarReal) {
    const rawR = stockRealInput.value.trim();
    if (rawR === "") {
      mensajeStock.textContent = "Completa Stock real o desmarca su casilla.";
      mensajeStock.className = "mensaje-stock err";
      return;
    }
    const numR = Number(rawR);
    if (!Number.isInteger(numR) || numR < 0) {
      mensajeStock.textContent = "Stock real: entero ≥ 0.";
      mensajeStock.className = "mensaje-stock err";
      return;
    }
    body.stockReal = numR;
    if (productoDescripcionInput) {
      body.producto = productoDescripcionInput.value.trim();
    }
  }

  const partes = [];
  if (body.stock !== undefined) {
    partes.push(`Stock = ${body.stock}`);
  }
  if (body.stockReal !== undefined) {
    partes.push(`Stock real = ${body.stockReal}`);
    partes.push("Descripción (Producto)");
  }
  if (body.verificado === true) {
    partes.push("Verificado = Sí");
  } else if (body.verificado === false) {
    partes.push("Verificado = NO VERIFICADO");
  }

  guardandoStock = true;
  setCargando(true, "Guardando en Excel…");
  try {
    const response = await apiFetch("/api/productos/stock-real", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "No se pudo guardar.");
    }
    mensajeStock.textContent = `Guardado: ${partes.join(" · ")}`;
    mensajeStock.className = "mensaje-stock ok";
    if (data.producto) {
      renderPanelProducto(data.producto);
    }
    setEstado("Cambios guardados en el archivo Excel.", "ok");
  } catch (error) {
    mensajeStock.textContent = error.message || "Error al guardar.";
    mensajeStock.className = "mensaje-stock err";
    console.error("Guardar stock:", error);
  } finally {
    setCargando(false);
    guardandoStock = false;
  }
}

function aplicarEstadoResultadoBusqueda(data, opciones = {}) {
  const meta = data?.meta || {};
  const lista = Array.isArray(data?.resultados) ? data.resultados : [];
  if (meta.pedirZona) {
    const cand = (meta.candidatosOcr || []).join(", ") || "ninguno reconocible";
    setEstado(
      `Ningún código de la etiqueta está en el catálogo (${cand}). Dibuja un recuadro sobre el código y pulsa «Buscar texto en zona».`,
      "error"
    );
    return;
  }
  if ((meta.coincidenciasExactas || 0) > 1) {
    setEstado(
      `Varios códigos de la etiqueta están en el catálogo (${(meta.candidatosCoincidentes || []).join(", ")}). Elige el producto correcto.`,
      "ok"
    );
    return;
  }
  if (meta.candidatoCoincidente) {
    codigoInputEl.value = meta.candidatoCoincidente;
    setEstado(
      `Encontrado por ${meta.candidatoCoincidente} (${meta.tiempoMs} ms).`,
      "ok"
    );
    return;
  }
  if (opciones.camaraActiva && lista.length === 0 && !meta.coincidenciaExactaCodigo) {
    setEstado(
      "Ese código de barras no está en el catálogo. Usa «Capturar foto» para leer los otros códigos de la etiqueta.",
      "idle"
    );
    return;
  }
  if (camaraActiva && quaggaListo && !modoFoto) {
    setEstado(`Listo (${meta.tiempoMs ?? 0} ms). Cámara activa.`, "ok");
    return;
  }
  setEstado(`Listo (${meta.tiempoMs ?? 0} ms).`, "ok");
}

async function buscarCodigo(codigo) {
  const codigoLimpio = String(codigo || "").trim();
  if (!codigoLimpio) {
    setEstado("Ingresa un código válido.", "error");
    return null;
  }

  ocrVistaEl.hidden = true;
  buscandoEnExcel = true;
  actualizarBotonesCamara();
  setCargando(true, "Buscando en el catálogo Excel…");
  setEstado("Buscando en Excel…", "buscando");

  try {
    const response = await apiFetch("/api/productos/buscar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: codigoLimpio })
    });
    if (!response.ok) {
      throw new Error("No se pudo consultar el producto.");
    }
    const data = await response.json();
    renderResultado(data);
    aplicarEstadoResultadoBusqueda(data, { camaraActiva: camaraActiva && !modoFoto });
    return data;
  } catch (error) {
    setEstado("Error al consultar el servidor.", "error");
    console.error(error);
    return null;
  } finally {
    buscandoEnExcel = false;
    setCargando(false);
    actualizarBotonesCamara();
  }
}

async function buscarPorTextoOcr(texto) {
  const textoLimpio = String(texto || "").trim();
  if (!textoLimpio) {
    setEstado("No hay texto para buscar.", "error");
    return null;
  }

  buscandoEnExcel = true;
  actualizarBotonesCamara();
  setCargando(true, "Buscando códigos de la etiqueta…");
  setEstado("Buscando códigos de la etiqueta…", "buscando");

  try {
    const response = await apiFetch("/api/productos/buscar-ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: textoLimpio })
    });
    if (!response.ok) {
      throw new Error("No se pudo consultar OCR.");
    }
    const data = await response.json();
    renderResultado(data);
    if (data.meta?.candidatoCoincidente) {
      codigoInputEl.value = data.meta.candidatoCoincidente;
    } else if (data.resultados?.length === 1) {
      codigoInputEl.value = data.resultados[0].codigo;
    }
    aplicarEstadoResultadoBusqueda(data);
    return data;
  } catch (error) {
    setEstado("Error al consultar el servidor.", "error");
    console.error(error);
    return null;
  } finally {
    buscandoEnExcel = false;
    setCargando(false);
    actualizarBotonesCamara();
  }
}

function hayCoincidenciaCatalogo(data) {
  return Boolean(
    data?.meta?.coincidenciaExactaCodigo ||
      (Array.isArray(data?.resultados) && data.resultados.length > 0 && !data?.meta?.pedirZona)
  );
}

function capturarFotogramaVideo() {
  const video = document.querySelector("#scanner video");
  if (!video || !video.videoWidth) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);
  return canvas;
}

function dibujarVisorDesdeOrigen() {
  if (!canvasOrigen) {
    return;
  }
  const cw = scannerShell.clientWidth;
  const ch = scannerShell.clientHeight;
  canvasVisor.width = cw;
  canvasVisor.height = ch;
  const ctx = canvasVisor.getContext("2d");
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, cw, ch);
  const w0 = canvasOrigen.width;
  const h0 = canvasOrigen.height;
  const ir = w0 / h0;
  const cr = cw / ch;
  let dw;
  let dh;
  let ox;
  let oy;
  if (ir > cr) {
    dw = cw;
    dh = cw / ir;
    ox = 0;
    oy = (ch - dh) / 2;
  } else {
    dh = ch;
    dw = ch * ir;
    ox = (cw - dw) / 2;
    oy = 0;
  }
  ctx.drawImage(canvasOrigen, ox, oy, dw, dh);
  visorMap = { ox, oy, dw, dh, w0, h0, cw, ch };
}

function actualizarRectVisual() {
  if (!seleccion || !visorMap) {
    rectSeleccion.hidden = true;
    return;
  }
  const { cw, ch } = visorMap;
  const x0 = Math.min(seleccion.x0, seleccion.x1);
  const y0 = Math.min(seleccion.y0, seleccion.y1);
  const w = Math.abs(seleccion.x1 - seleccion.x0);
  const h = Math.abs(seleccion.y1 - seleccion.y0);
  if (w < 4 || h < 4) {
    rectSeleccion.hidden = true;
    return;
  }
  rectSeleccion.hidden = false;
  rectSeleccion.style.left = `${(x0 / cw) * 100}%`;
  rectSeleccion.style.top = `${(y0 / ch) * 100}%`;
  rectSeleccion.style.width = `${(w / cw) * 100}%`;
  rectSeleccion.style.height = `${(h / ch) * 100}%`;
}

async function intentarCodigoBarrasEnCaptura() {
  setCargando(true, "Leyendo código de barras en la foto…");
  try {
    const { BrowserMultiFormatReader } = await import(
      "https://esm.sh/@zxing/browser@0.1.5"
    );
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromCanvas(canvasOrigen);
    const texto = result.getText().trim();
    if (texto) {
      codigoInputEl.value = texto;
      return await buscarCodigo(texto);
    }
  } catch (error) {
    const esNoEncontrado =
      error?.name === "NotFoundException" ||
      String(error?.message || "").includes("No MultiFormat Readers");
    if (!esNoEncontrado) {
      console.error("ZXing captura:", error);
    }
  } finally {
    setCargando(false);
  }
  return null;
}

async function leerOcrImagenCompleta() {
  if (!canvasOrigen) {
    return "";
  }
  if (typeof Tesseract === "undefined" || !Tesseract.createWorker) {
    return "";
  }
  ocrEnProceso = true;
  actualizarBotonesCamara();
  setCargando(true, "Leyendo códigos de la etiqueta…");
  let worker;
  try {
    worker = await Tesseract.createWorker("eng+spa");
    let ret;
    try {
      ret = await worker.recognize(canvasOrigen);
    } catch (e1) {
      await worker.terminate();
      worker = await Tesseract.createWorker("eng");
      ret = await worker.recognize(canvasOrigen);
    }
    return ret?.data?.text || "";
  } catch (error) {
    console.error("OCR etiqueta completa:", error);
    return "";
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.error(e);
      }
    }
    ocrEnProceso = false;
    setCargando(false);
    actualizarBotonesCamara();
  }
}

async function activarModoFotoDesdeCanvas(cap) {
  if (!cap || cap.width < 2 || cap.height < 2) {
    setEstado("Imagen no válida o demasiado pequeña.", "error");
    return;
  }
  if (quaggaInicializado && camaraActiva) {
    try {
      Quagga.stop();
    } catch (e) {
      console.error(e);
    }
  }
  canvasOrigen = cap;
  modoFoto = true;
  seleccion = null;
  rectSeleccion.hidden = true;
  const sc = document.querySelector("#scanner");
  if (sc) {
    sc.style.visibility = "hidden";
  }
  canvasVisor.hidden = false;
  dibujarVisorDesdeOrigen();
  actualizarBotonesCamara();

  const dataBarras = await intentarCodigoBarrasEnCaptura();
  if (hayCoincidenciaCatalogo(dataBarras)) {
    volverCamara();
    return;
  }

  const textoOcr = await leerOcrImagenCompleta();
  if (textoOcr.trim()) {
    ocrVistaEl.hidden = false;
    ocrVistaEl.textContent = `Texto de etiqueta:\n${textoOcr.trim()}`;
    const dataOcr = await buscarPorTextoOcr(textoOcr);
    if (hayCoincidenciaCatalogo(dataOcr)) {
      volverCamara();
      return;
    }
  }

  setEstado(
    "Ningún código de la etiqueta está en el catálogo. Dibuja un recuadro sobre el código (ej. CLT-45) y pulsa «Buscar texto en zona».",
    "escaneando"
  );
}

async function abrirSelectorFoto() {
  if (!inputFotoProducto) {
    setEstado("Selector de fotos no disponible en esta vista.", "error");
    return;
  }
  setEstado("Elige tomar foto o una imagen de la galería.", "idle");
  inputFotoProducto.click();
}

async function archivoImagenACanvas(file) {
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d").drawImage(bmp, 0, 0);
    if (typeof bmp.close === "function") {
      bmp.close();
    }
    return c;
  } catch (err) {
    console.error("createImageBitmap:", err);
    return new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          URL.revokeObjectURL(u);
          resolve(c);
        } catch (e) {
          URL.revokeObjectURL(u);
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(u);
        reject(new Error("No se pudo cargar la imagen"));
      };
      img.src = u;
    });
  }
}

async function capturarFotoPrincipal() {
  if (modoFoto) {
    setEstado("Ya estás en modo foto. Usa «Volver a cámara» o «Buscar texto en zona».", "idle");
    return;
  }
  if (hayVideoStreamListo()) {
    const cap = capturarFotogramaVideo();
    if (cap) {
      await activarModoFotoDesdeCanvas(cap);
      return;
    }
  }
  await abrirSelectorFoto();
}

function volverCamara() {
  if (!modoFoto) {
    setEstado("No hay foto cargada. Usa «Capturar foto» o «Foto desde celular».", "idle");
    return;
  }
  canvasOrigen = null;
  visorMap = null;
  seleccion = null;
  modoFoto = false;
  rectSeleccion.hidden = true;
  canvasVisor.hidden = true;
  const sc = document.querySelector("#scanner");
  if (sc) {
    sc.style.visibility = "";
  }
  if (quaggaInicializado) {
    try {
      Quagga.start();
    } catch (e) {
      console.error(e);
    }
  }
  actualizarBotonesCamara();
  programarRefrescoBotonesPorStream();
  if (!buscandoEnExcel && !ocrEnProceso) {
    setEstado("Cámara activa.", "escaneando");
  }
}

function obtenerSeleccionEnOrigen() {
  if (!seleccion || !visorMap || !canvasOrigen) {
    return null;
  }
  const { ox, oy, dw, dh, w0, h0 } = visorMap;
  let vx0 = Math.min(seleccion.x0, seleccion.x1);
  let vy0 = Math.min(seleccion.y0, seleccion.y1);
  let vx1 = Math.max(seleccion.x0, seleccion.x1);
  let vy1 = Math.max(seleccion.y0, seleccion.y1);
  const ix0 = Math.max(ox, vx0);
  const iy0 = Math.max(oy, vy0);
  const ix1 = Math.min(ox + dw, vx1);
  const iy1 = Math.min(oy + dh, vy1);
  if (ix1 - ix0 < 8 || iy1 - iy0 < 8) {
    return null;
  }
  const u0 = Math.floor(((ix0 - ox) / dw) * w0);
  const v0 = Math.floor(((iy0 - oy) / dh) * h0);
  const u1 = Math.ceil(((ix1 - ox) / dw) * w0);
  const v1 = Math.ceil(((iy1 - oy) / dh) * h0);
  const su0 = Math.max(0, u0);
  const sv0 = Math.max(0, v0);
  const su1 = Math.min(w0, u1);
  const sv1 = Math.min(h0, v1);
  if (su1 - su0 < 4 || sv1 - sv0 < 4) {
    return null;
  }
  return { su0, sv0, sw: su1 - su0, sh: sv1 - sv0 };
}

async function buscarTextoEnZona() {
  if (!modoFoto || !canvasOrigen) {
    setEstado(
      "Primero captura una foto del video, o usa «Foto desde celular» para cargar una imagen.",
      "error"
    );
    return;
  }
  const box = obtenerSeleccionEnOrigen();
  if (!box) {
    setEstado("Selecciona un área más grande sobre el texto (arrastra con el mouse).", "error");
    return;
  }
  if (typeof Tesseract === "undefined" || !Tesseract.createWorker) {
    setEstado("Tesseract no está disponible.", "error");
    return;
  }

  const crop = document.createElement("canvas");
  crop.width = box.sw;
  crop.height = box.sh;
  crop.getContext("2d").drawImage(
    canvasOrigen,
    box.su0,
    box.sv0,
    box.sw,
    box.sh,
    0,
    0,
    box.sw,
    box.sh
  );

  ocrEnProceso = true;
  actualizarBotonesCamara();
  setCargando(true, "Leyendo texto en la zona seleccionada…");
  let worker;
  try {
    worker = await Tesseract.createWorker("eng+spa");
    let ret;
    try {
      ret = await worker.recognize(crop);
    } catch (e1) {
      await worker.terminate();
      worker = await Tesseract.createWorker("eng");
      ret = await worker.recognize(crop);
    }
    const texto = ret?.data?.text || "";
    ocrVistaEl.hidden = false;
    ocrVistaEl.textContent = `Texto en zona:\n${texto.trim() || "(vacío)"}`;
    const dataZona = await buscarPorTextoOcr(texto);
    if (hayCoincidenciaCatalogo(dataZona)) {
      volverCamara();
    }
  } catch (error) {
    setEstado("Error en OCR de la zona.", "error");
    console.error(error);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.error(e);
      }
    }
    ocrEnProceso = false;
    setCargando(false);
    actualizarBotonesCamara();
  }
}

function aplicarLayoutCamara() {
  const root = document.querySelector("#scanner");
  if (!root) {
    return;
  }
  root.querySelectorAll("video, canvas").forEach((node) => {
    node.style.setProperty("width", "100%", "important");
    node.style.setProperty("height", "100%", "important");
    node.style.setProperty("object-fit", "cover", "important");
    node.style.setProperty("object-position", "center", "important");
    node.style.setProperty("position", "absolute", "important");
    node.style.setProperty("top", "0", "important");
    node.style.setProperty("left", "0", "important");
  });
}

function obtenerVideoQuagga() {
  return document.querySelector("#scanner video");
}

function hayVideoStreamListo() {
  const v = obtenerVideoQuagga();
  if (!v) {
    return false;
  }
  return v.readyState >= 2 && v.videoWidth > 0;
}

/**
 * Quagga a veces tarda en asignar dimensiones al video; sin esto quaggaListo
 * puede quedar desincronizado y «Capturar foto» sigue deshabilitado.
 */
function programarRefrescoBotonesPorStream() {
  const refrescar = () => actualizarBotonesCamara();
  refrescar();
  const v = obtenerVideoQuagga();
  if (v) {
    v.addEventListener("loadeddata", refrescar, { once: true });
    v.addEventListener("playing", refrescar, { once: true });
    v.addEventListener("canplay", refrescar, { once: true });
  }
  [50, 200, 600, 1500].forEach((ms) => setTimeout(refrescar, ms));
}

function actualizarBotonesCamara() {
  escanearBtnEl.textContent = camaraActiva ? "Detener escaneo" : "Iniciar escaneo";
  const ocupado = ocrEnProceso || buscandoEnExcel || cargandoUi;
  const streamListo =
    camaraActiva && quaggaInicializado && hayVideoStreamListo();
  if (streamListo) {
    quaggaListo = true;
  }

  const capturaDestacada = streamListo && !modoFoto && !ocupado;
  if (camaraActiva) {
    escanearBtnEl.classList.remove("btn-primary");
    escanearBtnEl.classList.add("btn-secondary");
  } else {
    escanearBtnEl.classList.add("btn-primary");
    escanearBtnEl.classList.remove("btn-secondary");
  }
  if (capturaDestacada) {
    capturarFotoBtn.classList.add("btn-primary");
    capturarFotoBtn.classList.remove("btn-secondary");
  } else {
    capturarFotoBtn.classList.remove("btn-primary");
    capturarFotoBtn.classList.add("btn-secondary");
  }
}

function manejarCodigoEscaneado(codigo) {
  if (buscandoEnExcel || ocrEnProceso || modoFoto || cargandoUi) {
    return;
  }
  const ahora = Date.now();
  if (codigo === ultimoCodigoProcesado && ahora - ultimoTimestamp < DEBOUNCE_MS) {
    return;
  }
  ultimoCodigoProcesado = codigo;
  ultimoTimestamp = ahora;
  codigoInputEl.value = codigo;
  buscarCodigo(codigo);
}

function detenerCamara() {
  if (modoFoto) {
    volverCamara();
  }
  if (window.Quagga && quaggaInicializado) {
    try {
      Quagga.stop();
    } catch (e) {
      console.error(e);
    }
  }
  camaraActiva = false;
  quaggaListo = false;
  actualizarBotonesCamara();
  if (!buscandoEnExcel && !ocrEnProceso) {
    setEstado("Cámara detenida.", "idle");
  }
}

function registrarDeteccionSiFalta() {
  if (deteccionRegistrada || !window.Quagga) {
    return;
  }
  Quagga.onDetected((result) => {
    const code = result?.codeResult?.code;
    if (code) {
      manejarCodigoEscaneado(code);
    }
  });
  deteccionRegistrada = true;
}

function iniciarCamara() {
  if (!window.Quagga) {
    setEstado("No se cargó Quagga.", "error");
    return;
  }

  if (quaggaInicializado) {
    try {
      Quagga.start();
      camaraActiva = true;
      quaggaListo = true;
      const nodoScanner = document.querySelector("#scanner");
      if (nodoScanner) {
        nodoScanner.style.visibility = "";
      }
      canvasVisor.hidden = true;
      rectSeleccion.hidden = true;
      actualizarBotonesCamara();
      programarRefrescoBotonesPorStream();
      setTimeout(aplicarLayoutCamara, 50);
      setTimeout(aplicarLayoutCamara, 400);
      if (!buscandoEnExcel) {
        setEstado("Cámara activa. Captura foto o espera lectura automática.", "escaneando");
      }
    } catch (e) {
      console.error(e);
      setEstado("No se pudo reanudar la cámara.", "error");
    }
    return;
  }

  if (!esOrigenCamaraPermitido()) {
    setEstado(
      "Iniciando cámara… Si el navegador la bloquea (habitual con HTTP por IP), usa «Foto desde celular».",
      "idle"
    );
  } else {
    setEstado("Iniciando cámara…", "idle");
  }

  Quagga.init(
    {
      inputStream: {
        type: "LiveStream",
        target: document.querySelector("#scanner"),
        constraints: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      locator: { patchSize: "large", halfSample: false },
      numOfWorkers: 2,
      frequency: 15,
      decoder: {
        readers: [
          "code_128_reader",
          "ean_reader",
          "ean_8_reader",
          "ean_extended_reader",
          "code_39_reader",
          "code_39_vin_reader",
          "codabar_reader",
          "i2of5_reader",
          "upc_reader",
          "upc_e_reader"
        ]
      }
    },
    (error) => {
      if (error) {
        const hint = esOrigenCamaraPermitido()
          ? "Revisa permisos de cámara o cierra otras apps que la usen."
          : "Por HTTP con dirección IP el navegador suele bloquear la cámara. Usa «Foto desde celular» para tomar o elegir una imagen.";
        setEstado(`No se pudo usar la cámara en vivo. ${hint}`, "error");
        console.error("Quagga init:", error);
        camaraActiva = false;
        quaggaListo = false;
        quaggaInicializado = false;
        actualizarBotonesCamara();
        return;
      }
      quaggaInicializado = true;
      registrarDeteccionSiFalta();
      Quagga.start();
      camaraActiva = true;
      quaggaListo = true;
      const nodoScanner = document.querySelector("#scanner");
      if (nodoScanner) {
        nodoScanner.style.visibility = "";
      }
      canvasVisor.hidden = true;
      rectSeleccion.hidden = true;
      actualizarBotonesCamara();
      programarRefrescoBotonesPorStream();
      setTimeout(aplicarLayoutCamara, 50);
      setTimeout(aplicarLayoutCamara, 400);
      if (!buscandoEnExcel) {
        setEstado("Cámara activa. Usa «Capturar foto» o lectura automática.", "escaneando");
      }
    }
  );
}

let punteroSeleccionId = null;

canvasVisor.addEventListener("pointerdown", (ev) => {
  if (!modoFoto || buscandoEnExcel || ocrEnProceso) {
    return;
  }
  if (ev.pointerType === "mouse" && ev.button !== 0) {
    return;
  }
  ev.preventDefault();
  punteroSeleccionId = ev.pointerId;
  try {
    canvasVisor.setPointerCapture(ev.pointerId);
  } catch (e) {
    console.error(e);
  }
  arrastrandoSeleccion = true;
  const r = canvasVisor.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * canvasVisor.width;
  const y = ((ev.clientY - r.top) / r.height) * canvasVisor.height;
  seleccion = { x0: x, y0: y, x1: x, y1: y };
  actualizarRectVisual();
});

canvasVisor.addEventListener("pointermove", (ev) => {
  if (!arrastrandoSeleccion || !seleccion || ev.pointerId !== punteroSeleccionId) {
    return;
  }
  ev.preventDefault();
  const r = canvasVisor.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * canvasVisor.width;
  const y = ((ev.clientY - r.top) / r.height) * canvasVisor.height;
  seleccion.x1 = x;
  seleccion.y1 = y;
  actualizarRectVisual();
});

function finalizarSeleccionPuntero(ev) {
  if (punteroSeleccionId === null || ev.pointerId !== punteroSeleccionId) {
    return;
  }
  try {
    canvasVisor.releasePointerCapture(ev.pointerId);
  } catch (e) {
    /* ignorar */
  }
  punteroSeleccionId = null;
  arrastrandoSeleccion = false;
  actualizarRectVisual();
}

canvasVisor.addEventListener("pointerup", finalizarSeleccionPuntero);
canvasVisor.addEventListener("pointercancel", finalizarSeleccionPuntero);

window.addEventListener("resize", () => {
  aplicarLayoutCamara();
  if (modoFoto && canvasOrigen) {
    dibujarVisorDesdeOrigen();
    actualizarRectVisual();
  }
});

escanearBtnEl.addEventListener("click", () => {
  escanearBtnEl.blur();
  if (camaraActiva) {
    detenerCamara();
    return;
  }
  iniciarCamara();
});

capturarFotoBtn.addEventListener("click", () => {
  capturarFotoBtn.blur();
  capturarFotoPrincipal();
});

if (fotoArchivoBtn) {
  fotoArchivoBtn.addEventListener("click", () => {
    fotoArchivoBtn.blur();
    abrirSelectorFoto();
  });
}

if (inputFotoProducto) {
  inputFotoProducto.addEventListener("change", async () => {
    const f = inputFotoProducto.files?.[0];
    inputFotoProducto.value = "";
    if (!f) {
      return;
    }
    if (!f.type.startsWith("image/")) {
      setEstado("Elige un archivo de imagen (jpg, png, etc.).", "error");
      return;
    }
    setCargando(true, "Cargando imagen…");
    try {
      const c = await archivoImagenACanvas(f);
      await activarModoFotoDesdeCanvas(c);
    } catch (error) {
      setEstado("No se pudo leer la imagen.", "error");
      console.error(error);
    } finally {
      setCargando(false);
    }
  });
}

buscarZonaBtn.addEventListener("click", () => {
  buscarTextoEnZona();
});

volverCamaraBtn.addEventListener("click", () => {
  volverCamara();
});

buscarBtnEl.addEventListener("click", () => buscarCodigo(codigoInputEl.value));
codigoInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    buscarCodigo(codigoInputEl.value);
  }
});

guardarStockBtn.addEventListener("click", () => guardarStockEnExcel());

function actualizarBotonesVerDiscrepancia(resumen) {
  const ok = Boolean(resumen?.disponible);
  if (btnVerDifNegativa) {
    btnVerDifNegativa.disabled =
      !ok || (resumen?.productosDiferenciaNegativa ?? 0) === 0;
  }
  if (btnVerDifPositiva) {
    btnVerDifPositiva.disabled =
      !ok || (resumen?.productosDiferenciaPositiva ?? 0) === 0;
  }
}

function pintarListaDiscrepanciaEnTablaResultados(lista, tipo) {
  cerrarModalSincronizarStock();
  ocrVistaEl.hidden = true;
  renderPanelProducto(null);
  const etiqueta =
    tipo === "negativa"
      ? "negativa (STOCK REAL menor que Stock)"
      : "positiva (STOCK REAL mayor que Stock)";
  resumenBusqueda.textContent = `${lista.length} producto(s) con diferencia ${etiqueta}.`;
  resumenBusqueda.className = "";
  renderTablaResultados(lista);
  if (resultadosBusquedaSection) {
    resultadosBusquedaSection.classList.add("result-card--destacado");
    window.setTimeout(() => {
      resultadosBusquedaSection.classList.remove("result-card--destacado");
    }, 4000);
    window.requestAnimationFrame(() => {
      resultadosBusquedaSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }
  setEstado("Listado mostrado en la tabla de resultados de búsqueda.", "ok");
}

async function mostrarListaDiscrepanciaEnTabla(tipo) {
  setCargando(true, "Cargando lista de productos…");
  try {
    const response = await apiFetch(
      `/api/productos/discrepancias-stock-lista?tipo=${encodeURIComponent(tipo)}`
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "No se pudo cargar la lista.");
    }
    const lista = Array.isArray(data.resultados) ? data.resultados : [];
    if (!lista.length) {
      setEstado("No hay productos en esa categoría.", "idle");
      return;
    }
    pintarListaDiscrepanciaEnTablaResultados(lista, tipo);
  } catch (error) {
    setEstado(error.message || "Error al cargar la lista.", "error");
    console.error("Lista discrepancia stock:", error);
  } finally {
    setCargando(false);
  }
}

function pintarResumenStockVsReal(resumen) {
  if (
    !resumenDifNegativa ||
    !resumenDifPositiva ||
    !resumenStockConforme ||
    !resumenProductosVerificados
  ) {
    return;
  }
  if (!resumen) {
    ultimoResumenStockVsReal = null;
    resumenDifNegativa.textContent = "—";
    resumenDifPositiva.textContent = "—";
    resumenStockConforme.textContent = "—";
    resumenProductosVerificados.textContent = "—";
    if (resumenTotalProductosRegistrados) {
      resumenTotalProductosRegistrados.textContent = "—";
    }
    actualizarBotonesVerDiscrepancia(null);
    return;
  }
  ultimoResumenStockVsReal = resumen;
  if (resumenTotalProductosRegistrados) {
    const tp = resumen.totalProductosRegistrados;
    resumenTotalProductosRegistrados.textContent =
      tp !== undefined && tp !== null ? String(tp) : "—";
  }
  if (!resumen.disponible) {
    resumenDifNegativa.textContent = "—";
    resumenDifPositiva.textContent = "—";
    resumenStockConforme.textContent = "—";
    resumenProductosVerificados.textContent = "—";
    if (resumenStockVsRealAviso) {
      resumenStockVsRealAviso.hidden = false;
      resumenStockVsRealAviso.textContent =
        "No se puede calcular el resumen: en el catálogo hacen falta las columnas Código, Stock y STOCK REAL.";
    }
    actualizarBotonesVerDiscrepancia(resumen);
    return;
  }
  if (resumenStockVsRealAviso) {
    resumenStockVsRealAviso.hidden = true;
    resumenStockVsRealAviso.textContent = "";
  }
  resumenDifNegativa.textContent = String(resumen.productosDiferenciaNegativa);
  resumenDifPositiva.textContent = String(resumen.productosDiferenciaPositiva);
  resumenStockConforme.textContent = String(resumen.productosStockConforme);
  resumenProductosVerificados.textContent = String(
    resumen.productosVerificados ?? 0
  );
  actualizarBotonesVerDiscrepancia(resumen);
}

function resetResumenStockVsRealAlAbrirModal() {
  if (
    resumenDifNegativa &&
    resumenDifPositiva &&
    resumenStockConforme &&
    resumenProductosVerificados
  ) {
    resumenDifNegativa.textContent = "—";
    resumenDifPositiva.textContent = "—";
    resumenStockConforme.textContent = "—";
    resumenProductosVerificados.textContent = "—";
  }
  if (resumenTotalProductosRegistrados) {
    resumenTotalProductosRegistrados.textContent = "—";
  }
  if (resumenStockVsRealAviso) {
    resumenStockVsRealAviso.hidden = false;
    resumenStockVsRealAviso.textContent =
      "Pulsa «Refrescar resumen» para cargar los totales (no se actualizan solos al guardar un producto).";
  }
  actualizarBotonesVerDiscrepancia(ultimoResumenStockVsReal);
}

async function cargarResumenStockVsRealDesdeServidor() {
  if (
    resumenDifNegativa &&
    resumenDifPositiva &&
    resumenStockConforme &&
    resumenProductosVerificados
  ) {
    resumenDifNegativa.textContent = "…";
    resumenDifPositiva.textContent = "…";
    resumenStockConforme.textContent = "…";
    resumenProductosVerificados.textContent = "…";
  }
  if (resumenTotalProductosRegistrados) {
    resumenTotalProductosRegistrados.textContent = "…";
  }
  if (resumenStockVsRealAviso) {
    resumenStockVsRealAviso.hidden = false;
    resumenStockVsRealAviso.textContent = "Cargando resumen…";
  }
  if (btnRefrescarResumenStock) {
    btnRefrescarResumenStock.disabled = true;
  }
  try {
    const response = await apiFetch("/api/productos/resumen-stock-vs-real");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.resumen) {
      throw new Error(data.message || "No se pudo obtener el resumen.");
    }
    pintarResumenStockVsReal(data.resumen);
  } catch (error) {
    if (
      resumenDifNegativa &&
      resumenDifPositiva &&
      resumenStockConforme &&
      resumenProductosVerificados
    ) {
      resumenDifNegativa.textContent = "—";
      resumenDifPositiva.textContent = "—";
      resumenStockConforme.textContent = "—";
      resumenProductosVerificados.textContent = "—";
    }
    if (resumenTotalProductosRegistrados) {
      resumenTotalProductosRegistrados.textContent = "—";
    }
    ultimoResumenStockVsReal = null;
    actualizarBotonesVerDiscrepancia(null);
    if (resumenStockVsRealAviso) {
      resumenStockVsRealAviso.hidden = false;
      resumenStockVsRealAviso.textContent =
        error.message || "Error al cargar el resumen del catálogo.";
    }
    console.error("Resumen stock vs real:", error);
  } finally {
    if (btnRefrescarResumenStock) {
      btnRefrescarResumenStock.disabled = false;
    }
  }
}

function abrirModalSincronizarStock() {
  if (!modalSyncStock) {
    return;
  }
  modalSyncStock.hidden = false;
  modalSyncStock.setAttribute("aria-hidden", "false");
  if (syncStockResultado) {
    syncStockResultado.hidden = true;
    syncStockResultado.textContent = "";
    syncStockResultado.classList.remove("err");
  }
  if (syncStockFile) {
    syncStockFile.value = "";
  }
  resetResumenStockVsRealAlAbrirModal();
  cargarResumenStockVsRealDesdeServidor();
}

function cerrarModalSincronizarStock() {
  if (!modalSyncStock) {
    return;
  }
  modalSyncStock.hidden = true;
  modalSyncStock.setAttribute("aria-hidden", "true");
}

function formatearResumenSyncStock(data) {
  if (!data || !data.ok) {
    return data?.message || "Error desconocido.";
  }
  const m = data.meta || {};
  const rs = m.resumenStockVsReal;
  const lineaTotalRegistrados =
    rs &&
    rs.totalProductosRegistrados !== undefined &&
    rs.totalProductosRegistrados !== null
      ? `Total productos registrados en catálogo: ${rs.totalProductosRegistrados}`
      : null;
  const bloqueResumen =
    rs && rs.disponible
      ? [
          "— Resumen catálogo (filas con STOCK REAL informado) —",
          ...(lineaTotalRegistrados ? [lineaTotalRegistrados] : []),
          `Productos diferencia negativa: ${rs.productosDiferenciaNegativa}`,
          `Productos diferencia positiva: ${rs.productosDiferenciaPositiva}`,
          `Productos stock conforme: ${rs.productosStockConforme}`,
          `Productos verificados: ${rs.productosVerificados ?? 0}`,
          ""
        ]
      : rs && !rs.disponible
        ? [
            "— Resumen catálogo: no disponible (faltan columnas en el Excel) —",
            ...(lineaTotalRegistrados ? [lineaTotalRegistrados] : []),
            ""
          ]
        : [];
  const lineas = [
    ...bloqueResumen,
    `Hoja del export: ${m.nombreHojaExport || "—"}`,
    `Columnas detectadas en export: código «${m.encabezadoCodigo || "—"}», stock «${m.encabezadoStock || "—"}»`,
    `Filas válidas en export (código + stock): ${m.filasConCodigoYStock ?? "—"}`,
    `Filas omitidas en export (código vacío o stock inválido): ${m.filasOmitidas ?? "—"}`,
    `Filas del catálogo emparejadas con el export: ${m.filasCatalogoConCoincidencia ?? "—"}`,
    `Filas omitidas (Stock = STOCK REAL y Modificacion con fecha; no se toca Stock): ${m.filasStockOmitidasPorVerificacion ?? "—"}`,
    `Celdas Stock con valor distinto (se escribió nuevo valor): ${m.filasStockValorCambiado ?? "—"}`,
    `Filas con mismo stock (sin cambiar archivo): ${m.filasStockSinCambio ?? "—"}`,
    `Productos nuevos agregados al catálogo: ${m.productosNuevosAgregados ?? 0}`,
    `¿Se guardó el Excel del servidor?: ${m.archivoCatalogoEscrito ? "Sí" : "No"}`,
    `Códigos del export no agregados al catálogo: ${m.totalCodigosExportSinProducto ?? 0}`
  ];
  if (
    Array.isArray(m.codigosProductosNuevos) &&
    m.codigosProductosNuevos.length > 0
  ) {
    lineas.push(
      `Ejemplos de productos nuevos: ${m.codigosProductosNuevos.join(", ")}`
    );
  }
  if (
    Array.isArray(m.codigosExportSinProductoEnCatalogo) &&
    m.codigosExportSinProductoEnCatalogo.length > 0
  ) {
    lineas.push(
      `Ejemplos no agregados: ${m.codigosExportSinProductoEnCatalogo.join(", ")}`
    );
  }
  return lineas.join("\n");
}

async function ejecutarSincronizarStockDesdeExport() {
  if (!syncStockFile?.files?.length) {
    if (syncStockResultado) {
      syncStockResultado.hidden = false;
      syncStockResultado.classList.add("err");
      syncStockResultado.textContent = "Elige un archivo Excel exportado desde la web.";
    }
    return;
  }
  const archivo = syncStockFile.files[0];
  const fd = new FormData();
  fd.append("archivo", archivo);

  if (ejecutarSyncStock) {
    ejecutarSyncStock.disabled = true;
  }
  setCargando(true, "Comparando y actualizando Stock…");
  try {
    const response = await apiFetch("/api/productos/sincronizar-stock-export", {
      method: "POST",
      body: fd
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "No se pudo sincronizar.");
    }
    if (syncStockResultado) {
      syncStockResultado.hidden = false;
      syncStockResultado.classList.remove("err");
      syncStockResultado.textContent = formatearResumenSyncStock(data);
    }
    if (data.meta?.resumenStockVsReal) {
      pintarResumenStockVsReal(data.meta.resumenStockVsReal);
    }
    const meta = data.meta || {};
    let mensajeEstado = "Comparación lista; no hubo cambios en el catálogo.";
    if (meta.archivoCatalogoEscrito) {
      const partes = [];
      if ((meta.filasStockValorCambiado ?? 0) > 0) {
        partes.push("Stock actualizado");
      }
      if ((meta.productosNuevosAgregados ?? 0) > 0) {
        partes.push(
          `${meta.productosNuevosAgregados} producto(s) nuevo(s) agregado(s)`
        );
      }
      mensajeEstado =
        partes.length > 0
          ? `${partes.join("; ")} desde el export.`
          : "Catálogo guardado desde el export.";
    }
    setEstado(mensajeEstado, meta.archivoCatalogoEscrito ? "ok" : "idle");
  } catch (error) {
    if (syncStockResultado) {
      syncStockResultado.hidden = false;
      syncStockResultado.classList.add("err");
      syncStockResultado.textContent = error.message || "Error al sincronizar.";
    }
    setEstado("Error al sincronizar stock desde export.", "error");
    console.error("Sincronizar stock export:", error);
  } finally {
    setCargando(false);
    if (ejecutarSyncStock) {
      ejecutarSyncStock.disabled = false;
    }
  }
}

if (abrirModalSyncStock && modalSyncStock) {
  abrirModalSyncStock.addEventListener("click", () => {
    abrirModalSincronizarStock();
  });
}
if (cerrarModalSyncStock) {
  cerrarModalSyncStock.addEventListener("click", () => cerrarModalSincronizarStock());
}
if (modalSyncStockBackdrop) {
  modalSyncStockBackdrop.addEventListener("click", () => cerrarModalSincronizarStock());
}
if (ejecutarSyncStock) {
  ejecutarSyncStock.addEventListener("click", () => ejecutarSincronizarStockDesdeExport());
}
if (btnRefrescarResumenStock) {
  btnRefrescarResumenStock.addEventListener("click", () =>
    cargarResumenStockVsRealDesdeServidor()
  );
}
if (btnVerDifNegativa) {
  btnVerDifNegativa.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    mostrarListaDiscrepanciaEnTabla("negativa");
  });
}
if (btnVerDifPositiva) {
  btnVerDifPositiva.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    mostrarListaDiscrepanciaEnTabla("positiva");
  });
}

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && modalSyncStock && !modalSyncStock.hidden) {
    cerrarModalSincronizarStock();
  }
  if (ev.key === "Escape" && modalReconciliacion && !modalReconciliacion.hidden) {
    cerrarModalReconciliacionFn();
  }
});

async function descargarPlantillaReconciliacion(tipo) {
  const response = await apiFetch(
    `/api/reconciliacion/plantillas/${encodeURIComponent(tipo)}`
  );
  if (!response.ok) {
    throw new Error("No se pudo descargar la plantilla.");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const nombre = match?.[1] || `plantilla-${tipo}.xlsx`;
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function configurarEnlacesPlantillasReconciliacion() {
  document.querySelectorAll(".recon-plantilla-link").forEach((link) => {
    link.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const tipo = link.getAttribute("data-plantilla");
      if (!tipo) {
        return;
      }
      try {
        await descargarPlantillaReconciliacion(tipo);
      } catch (error) {
        console.error("Descargar plantilla:", error);
        setEstado(error.message || "No se pudo descargar la plantilla.", "error");
      }
    });
  });
}

function abrirModalReconciliacionFn() {
  if (!modalReconciliacion) {
    return;
  }
  modalReconciliacion.hidden = false;
  modalReconciliacion.setAttribute("aria-hidden", "false");
  if (reconResultado) {
    reconResultado.hidden = true;
    reconResultado.textContent = "";
    reconResultado.classList.remove("err");
  }
  if (reconResumenBox) {
    reconResumenBox.hidden = true;
  }
  if (reconFileStockAnterior) {
    reconFileStockAnterior.value = "";
  }
  if (reconFileCompras) {
    reconFileCompras.value = "";
  }
  if (reconFileVentas) {
    reconFileVentas.value = "";
  }
  if (reconFileStockActual) {
    reconFileStockActual.value = "";
  }
  ultimoResultadoReconciliacion = null;
  actualizarBotonesVerReconciliacion(null);
}

function cerrarModalReconciliacionFn() {
  if (!modalReconciliacion) {
    return;
  }
  modalReconciliacion.hidden = true;
  modalReconciliacion.setAttribute("aria-hidden", "true");
}

function actualizarBotonesVerReconciliacion(data) {
  const ok = Boolean(data);
  if (btnVerReconFaltantes) {
    btnVerReconFaltantes.disabled = !ok || (data?.faltantes?.length ?? 0) === 0;
  }
  if (btnVerReconSobrantes) {
    btnVerReconSobrantes.disabled = !ok || (data?.sobrantes?.length ?? 0) === 0;
  }
}

function pintarResumenReconciliacion(data) {
  if (!reconResumenBox) {
    return;
  }
  const meta = data?.meta || {};
  reconResumenBox.hidden = false;
  if (reconProductosAnalizados) {
    reconProductosAnalizados.textContent = String(meta.productosAnalizados ?? "—");
  }
  if (reconFaltantes) {
    reconFaltantes.textContent = String(meta.productosFaltante ?? 0);
  }
  if (reconSobrantes) {
    reconSobrantes.textContent = String(meta.productosSobrante ?? 0);
  }
  if (reconConformes) {
    reconConformes.textContent = String(meta.productosConformes ?? 0);
  }
  actualizarBotonesVerReconciliacion(data);
}

function formatearDetalleReconciliacion(data) {
  const m = data?.meta || {};
  const ar = m.archivoResultado || {};
  const lineas = [
    m.formula || "",
    "",
    `Criterio de emparejamiento: ${m.criterioEmparejamiento || "Producto"}`,
    "",
    "— Archivos y columnas —",
    `Base del cálculo: archivo stock anterior (Producto + Cantidad o Stock)`,
    `Columna cantidad compras/ventas: «${m.compras?.encabezadoCantidad ?? "Cantidad"}» / «${m.ventas?.encabezadoCantidad ?? "Cantidad"}»`,
    m.stockActual?.nota || "",
    "",
    `Resultado guardado en: ${ar.rutaRelativa || ar.rutaAbsoluta || "—"}`,
    ar.formato ? `Formato archivo: ${ar.formato}` : "",
    "",
    "— Stock anterior —",
    `Filas procesadas: ${m.stockAnterior?.filasProcesadas ?? "—"}`,
    `Productos únicos: ${m.stockAnterior?.productosUnicos ?? "—"}`,
    `Filas nombre duplicado (sumadas): ${m.stockAnterior?.filasNombreDuplicado ?? "—"}`,
    "",
    "— Compras —",
    `Filas procesadas: ${m.compras?.filasProcesadas ?? "—"}`,
    `Productos únicos: ${m.compras?.productosUnicos ?? "—"}`,
    `Filas nombre duplicado (sumadas): ${m.compras?.filasNombreDuplicado ?? "—"}`,
    "",
    "— Ventas —",
    `Filas procesadas: ${m.ventas?.filasProcesadas ?? "—"}`,
    `Productos únicos: ${m.ventas?.productosUnicos ?? "—"}`,
    `Filas nombre duplicado (sumadas): ${m.ventas?.filasNombreDuplicado ?? "—"}`,
    "",
    "— Export stock actual (columna Stock) —",
    `Filas procesadas: ${m.stockActual?.filasProcesadas ?? "—"}`,
    `Productos únicos: ${m.stockActual?.productosUnicos ?? "—"}`,
    `Filas omitidas (código vacío o Stock vacío/inválido): ${m.stockActual?.filasOmitidas ?? "—"}`,
    "",
    `Productos analizados: ${m.productosAnalizados ?? "—"}`,
    `Productos con compras aplicadas: ${m.productosConCompras ?? "—"}`,
    `Productos con ventas aplicadas: ${m.productosConVentas ?? "—"}`,
    `Faltantes: ${m.productosFaltante ?? 0}`,
    `Sobrantes: ${m.productosSobrante ?? 0}`,
    `Conformes: ${m.productosConformes ?? 0}`
  ];
  return lineas.join("\n");
}

function pintarListaReconciliacionEnTabla(lista, tipo) {
  cerrarModalReconciliacionFn();
  cerrarModalSincronizarStock();
  ocrVistaEl.hidden = true;
  renderPanelProducto(null);
  const etiqueta =
    tipo === "faltantes"
      ? "faltantes (sistema con menos stock del esperado)"
      : "sobrantes (sistema con más stock del esperado)";
  resumenBusqueda.textContent = `${lista.length} producto(s) ${etiqueta}.`;
  resumenBusqueda.className = "";
  renderTablaReconciliacion(lista);
  if (resultadosBusquedaSection) {
    resultadosBusquedaSection.classList.add("result-card--destacado");
    window.setTimeout(() => {
      resultadosBusquedaSection.classList.remove("result-card--destacado");
    }, 4000);
    window.requestAnimationFrame(() => {
      resultadosBusquedaSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }
  setEstado("Listado de reconciliación mostrado en la tabla de resultados.", "ok");
}

function mostrarListaReconciliacion(tipo) {
  if (!ultimoResultadoReconciliacion) {
    setEstado("Ejecuta primero la reconciliación.", "idle");
    return;
  }
  const lista =
    tipo === "faltantes"
      ? ultimoResultadoReconciliacion.faltantes || []
      : ultimoResultadoReconciliacion.sobrantes || [];
  if (!lista.length) {
    setEstado("No hay productos en esa categoría.", "idle");
    return;
  }
  pintarListaReconciliacionEnTabla(lista, tipo);
}

async function ejecutarReconciliacionMovimientos() {
  if (!reconFileStockAnterior?.files?.length) {
    if (reconResultado) {
      reconResultado.hidden = false;
      reconResultado.classList.add("err");
      reconResultado.textContent =
        "Elige el archivo de stock anterior (inventario al corte).";
    }
    return;
  }
  if (!reconFileCompras?.files?.length) {
    if (reconResultado) {
      reconResultado.hidden = false;
      reconResultado.classList.add("err");
      reconResultado.textContent = "Elige el archivo de compras.";
    }
    return;
  }
  if (!reconFileVentas?.files?.length) {
    if (reconResultado) {
      reconResultado.hidden = false;
      reconResultado.classList.add("err");
      reconResultado.textContent = "Elige el archivo de ventas.";
    }
    return;
  }
  if (!reconFileStockActual?.files?.length) {
    if (reconResultado) {
      reconResultado.hidden = false;
      reconResultado.classList.add("err");
      reconResultado.textContent = "Elige el archivo de stock actual del sistema.";
    }
    return;
  }

  const fd = new FormData();
  fd.append("stockAnterior", reconFileStockAnterior.files[0]);
  fd.append("compras", reconFileCompras.files[0]);
  fd.append("ventas", reconFileVentas.files[0]);
  fd.append("stockActual", reconFileStockActual.files[0]);

  if (ejecutarReconciliacionBtn) {
    ejecutarReconciliacionBtn.disabled = true;
  }
  setCargando(true, "Reconciliando movimientos…");
  try {
    const response = await apiFetch("/api/reconciliacion/ejecutar", {
      method: "POST",
      body: fd
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "No se pudo ejecutar la reconciliación.");
    }
    ultimoResultadoReconciliacion = {
      faltantes: data.faltantes || [],
      sobrantes: data.sobrantes || [],
      conformes: data.conformes || []
    };
    pintarResumenReconciliacion(data);
    if (reconResultado) {
      reconResultado.hidden = false;
      reconResultado.classList.remove("err");
      reconResultado.textContent = formatearDetalleReconciliacion(data);
    }
    const meta = data.meta || {};
    setEstado(
      `Reconciliación lista: ${meta.productosFaltante ?? 0} faltante(s), ${meta.productosSobrante ?? 0} sobrante(s).`,
      "ok"
    );
  } catch (error) {
    if (reconResultado) {
      reconResultado.hidden = false;
      reconResultado.classList.add("err");
      reconResultado.textContent = error.message || "Error al reconciliar.";
    }
    setEstado("Error en reconciliación de movimientos.", "error");
    console.error("Reconciliación movimientos:", error);
  } finally {
    setCargando(false);
    if (ejecutarReconciliacionBtn) {
      ejecutarReconciliacionBtn.disabled = false;
    }
  }
}

if (abrirModalReconciliacion && modalReconciliacion) {
  abrirModalReconciliacion.addEventListener("click", () => {
    abrirModalReconciliacionFn();
  });
}
if (cerrarModalReconciliacion) {
  cerrarModalReconciliacion.addEventListener("click", () =>
    cerrarModalReconciliacionFn()
  );
}
if (modalReconciliacionBackdrop) {
  modalReconciliacionBackdrop.addEventListener("click", () =>
    cerrarModalReconciliacionFn()
  );
}
if (ejecutarReconciliacionBtn) {
  ejecutarReconciliacionBtn.addEventListener("click", () =>
    ejecutarReconciliacionMovimientos()
  );
}
if (btnVerReconFaltantes) {
  btnVerReconFaltantes.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    mostrarListaReconciliacion("faltantes");
  });
}
if (btnVerReconSobrantes) {
  btnVerReconSobrantes.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    mostrarListaReconciliacion("sobrantes");
  });
}

function mostrarErrorLogin(texto) {
  if (!loginErrorEl) {
    return;
  }
  if (!texto) {
    loginErrorEl.hidden = true;
    loginErrorEl.textContent = "";
    return;
  }
  loginErrorEl.hidden = false;
  loginErrorEl.textContent = texto;
}

function mostrarAppAutenticada(usuario) {
  if (pantallaLogin) {
    pantallaLogin.hidden = true;
  }
  if (appPrincipal) {
    appPrincipal.hidden = false;
  }
  if (sesionUsuarioEl) {
    sesionUsuarioEl.hidden = !usuario;
    sesionUsuarioEl.textContent = usuario ? `Sesión: ${usuario}` : "";
  }
}

function cerrarSesionUi(silencioso = false) {
  borrarToken();
  if (appPrincipal) {
    appPrincipal.hidden = true;
  }
  if (pantallaLogin) {
    pantallaLogin.hidden = false;
  }
  if (sesionUsuarioEl) {
    sesionUsuarioEl.hidden = true;
    sesionUsuarioEl.textContent = "";
  }
  if (loginPasswordEl) {
    loginPasswordEl.value = "";
  }
  if (!silencioso) {
    mostrarErrorLogin("");
  } else {
    mostrarErrorLogin("Sesión vencida. Inicia sesión de nuevo.");
  }
}

async function verificarSesionGuardada() {
  const token = obtenerToken();
  if (!token) {
    cerrarSesionUi(false);
    return;
  }
  try {
    const response = await apiFetch("/api/auth/me");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Sesión inválida.");
    }
    mostrarAppAutenticada(data.usuario);
  } catch (error) {
    console.error("Verificar sesión:", error);
    cerrarSesionUi(true);
  }
}

async function enviarLogin(ev) {
  ev.preventDefault();
  const usuario = String(loginUsuarioEl?.value || "").trim();
  const password = String(loginPasswordEl?.value || "");
  if (!usuario || !password) {
    mostrarErrorLogin("Escribe usuario y contraseña.");
    return;
  }
  if (loginSubmitEl) {
    loginSubmitEl.disabled = true;
  }
  mostrarErrorLogin("");
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.token) {
      throw new Error(data.message || "No se pudo iniciar sesión.");
    }
    guardarToken(data.token);
    mostrarAppAutenticada(data.usuario);
    if (loginPasswordEl) {
      loginPasswordEl.value = "";
    }
  } catch (error) {
    console.error("Login:", error);
    mostrarErrorLogin(error.message || "No se pudo iniciar sesión.");
  } finally {
    if (loginSubmitEl) {
      loginSubmitEl.disabled = false;
    }
  }
}

if (formLogin) {
  formLogin.addEventListener("submit", enviarLogin);
}
if (cerrarSesionBtn) {
  cerrarSesionBtn.addEventListener("click", () => cerrarSesionUi(false));
}

configurarEnlacesPlantillasReconciliacion();
verificarSesionGuardada();

if (!window.Quagga) {
  setEstado("Esperando Quagga… Recarga la página.", "error");
} else {
  setEstado("Pulsa «Iniciar escaneo» o escribe un código.", "idle");
}
actualizarBotonesCamara();

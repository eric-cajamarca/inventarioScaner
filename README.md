# Inventario Scanner (Web Local)

Sistema de escaneo de productos con cámara: lectura de **código de barras** (QuaggaJS) y **texto en etiquetas** (Tesseract.js OCR), comparado contra un Excel local.

## Tecnologías

- Backend: Node.js + Express + xlsx + fuse.js
- Frontend: HTML + JS + QuaggaJS + ZXing (fotograma) + Tesseract.js (OCR, CDN)

## Estructura

- `backend`: API y lógica de negocio
- `frontend`: UI web para escaneo y búsqueda

## Requisitos

- Node.js 18+ recomendado
- Primera vez que usas OCR: Tesseract descarga idiomas por red (eng/spa); requiere internet estable

## Instalación

```bash
cd backend
npm install
```

## Ejecución en desarrollo local (manual)

**Terminal 1 — backend (API), puerto 3005:**

```bash
cd backend
node app.js
```

**Terminal 2 — frontend, puerto 4400** (elige **una** forma):

- Desde la **raíz** del repo (`inventarioScaner`), sirviendo la carpeta `frontend`:

  ```bash
  cd /c/inventarioScaner
  npx serve frontend --listen tcp://0.0.0.0:4400
  ```

- Si ya estás **dentro** de `frontend/`, sirve el directorio actual (`.`).  
  **No** uses `npx serve frontend` ahí: buscaría `frontend/frontend` y devolverá **404**.

  ```bash
  cd /c/inventarioScaner/frontend
  npx serve . --listen tcp://0.0.0.0:4400
  ```

  O simplemente: `npm start` (escucha en **todas las interfaces** para la red local).  
  **No** ejecutes `npm start --listen …`: el script ya incluye `--listen`; repetirlo hace que `serve` reciba dos rutas y falle con *“Please provide one path argument at maximum”*. Para cambiar puerto u opciones: `npm start -- --listen tcp://0.0.0.0:OTRO_PUERTO`.

También puedes abrir solo el backend: **http://localhost:3005** (ya sirve el frontend).  
Si usas el frontend aparte en 4400: **http://localhost:4400**. La app llama a la API en el **mismo host** (en local, **http://localhost:3005**; desde el móvil por IP, **http://TU_IP:3005**).

### Acceso desde otro equipo o móvil (misma Wi‑Fi / LAN)

1. Arranca **backend** y **frontend** como arriba. Al iniciar, el backend imprime URLs tipo `http://192.168.x.x:3005` para tu red.
2. En el **teléfono u otro PC**, abre: **http://TU_IP:4400** o **http://TU_IP:3005**. Sustituye `TU_IP` por la que muestre `ipconfig` o el listado del backend al arrancar.
3. **Firewall de Windows**: la primera vez puede pedir permiso a Node.js; si no carga, crea reglas entrantes que permitan **TCP 3005** y **TCP 4400** (o “Permitir aplicación” para `node.exe`).
4. **Cámara en el móvil**: muchos navegadores solo permiten `getUserMedia` en **HTTPS** o **localhost**. En `http://192.168…` la cámara en vivo suele estar bloqueada; usa **Foto desde celular** o publica la app en un servidor con HTTPS (p. ej. Render).

La UI incluye ajustes **responsive** (botones táctiles, tabla con desplazamiento horizontal, visor de cámara acotado en pantallas pequeñas).

## Publicar en Render (HTTPS y cámara en el móvil)

Puedes crear **otro Web Service** en la misma cuenta de Render; no reemplaza la app Node.js que ya tienes.

1. Sube este repo a GitHub/GitLab (incluye `backend/data/productos.xlsx`).
2. En Render: **New → Web Service** → conecta **este** repositorio (no el de la otra app).
3. Ajustes:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance:** Free o Starter
4. Variables de entorno en Render (Environment):
   - `AUTH_USER` — usuario de login
   - `AUTH_PASSWORD` — contraseña
   - `JWT_SECRET` — frase larga y secreta (no uses la de local)
   - `JWT_EXPIRES_IN` — opcional, por defecto `12h`
5. Render asigna `PORT` solo. La URL será `https://tu-servicio.onrender.com` (la cámara del móvil funciona porque ya es HTTPS).

### Login (sin base de datos)

Las credenciales **no se guardan en SQL ni en Excel**. Van en variables de entorno:

- Local: `backend/.env` (`AUTH_USER`, `AUTH_PASSWORD`, `JWT_SECRET`)
- Render: el panel **Environment** del Web Service

Para varios usuarios, usa `AUTH_USERS_JSON`:

```json
[{"usuario":"admin","password":"clave1"},{"usuario":"almacen","password":"clave2"}]
```

### Dónde va `productos.xlsx`

La app lee y escribe **`backend/data/productos.xlsx`**.

- **Al publicar:** deja el Excel en esa carpeta **antes del `git push`**, para que Render lo despliegue con el código.
- **Importante:** en el plan Free el disco es **temporal**. Si actualizas stock desde la web, esos cambios se pierden al reiniciar o redesplegar. Para conservarlos, añade un **Persistent Disk** en Render montado en `backend/data`.

### Liberar puertos en Windows

Si el puerto está ocupado:

```text
netstat -ano | findstr :3005
netstat -ano | findstr :4400
```

Anota el **PID** de la línea `LISTENING` y ejecuta:

```text
taskkill /PID <número> /F
```

## API

### `GET /api/health`

Devuelve estado del backend.

### `POST /api/productos/buscar`

Búsqueda por **código** y por **texto** (nombre de producto, marca, categoría, etc.) en una sola petición. Si hay coincidencia exacta de código, ese registro aparece primero; el resto son coincidencias aproximadas (Fuse.js) hasta 30 filas.

Body:

```json
{
  "codigo": "YARIS"
}
```

El campo `codigo` en el JSON es en realidad el **término de búsqueda** (puede ser nombre de producto o parte del código).

### `POST /api/productos/buscar-ocr`

Recibe el texto crudo del OCR; el backend extrae candidatos (por ejemplo `CLT-45`, `38BWD15A`) y busca en el catálogo.

Body:

```json
{
  "texto": "CL0574 | CLT-45\n8806199133299"
}
```

Respuesta: arreglo `resultados` (misma forma que `/buscar`) y `meta` con `candidatosOcr` / `candidatoCoincidente` cuando aplique.

### `POST /api/productos/stock-real`

Actualiza **solo las columnas que envíes** en el JSON (no mandes la clave si no quieres tocar esa columna):

- **`stockReal`** → columna **STOCK REAL**
- **`stock`** → columna **Stock** (catálogo; el encabezado debe ser exactamente `Stock`, no «STOCK REAL»)

Valores: **enteros ≥ 0**. El **Código** usa la misma normalización que en búsqueda.

Ejemplos:

```json
{ "codigo": "CLT-45", "stockReal": 12 }
```

```json
{ "codigo": "CLT-45", "stock": 23, "stockReal": 12 }
```

Cierra el `.xlsx` en Excel antes de guardar; si está abierto, Windows puede devolver archivo bloqueado (`EBUSY`).

## Formato esperado de Excel

Archivo: `backend/data/productos.xlsx`

Encabezados reconocidos (primera hoja):

| Columna        | Uso                          |
|----------------|------------------------------|
| Código         | Clave principal de búsqueda  |
| Producto       | Nombre / descripción         |
| Categoría      | Categoría                    |
| Marca          | Marca                        |
| UNIDAD MEDIDA  | Unidad                       |
| Almacen        | Almacén                      |
| Stock          | Stock                        |
| STOCK REAL     | Stock real                   |

Se aceptan variantes de nombre sin tilde o en distinto caso cuando coinciden con las anteriores.

## Pruebas manuales

1. Código de barras o código exacto del Excel con **Buscar en Excel**.
2. Cámara + **Leer texto (OCR)** apuntando a una etiqueta con código alfanumérico.
3. Búsqueda aproximada escribiendo parte del código o del producto.
4. Sin Excel o archivo dañado: debe responder error controlado desde 
el backend.

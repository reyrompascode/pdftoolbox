pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

let filesArray = [];
let currentMode = "merge";

// UI Logic
window.switchMode = (mode) => {
  currentMode = mode;
  document
    .getElementById("tab-merge")
    .classList.toggle("active", mode === "merge");
  document
    .getElementById("tab-split")
    .classList.toggle("active", mode === "split");
  document
    .getElementById("tab-compress")
    .classList.toggle("active", mode === "compress");

  document.getElementById("extra-settings").style.display =
    mode === "merge" ? "block" : "none";

  const compressSettings = document.getElementById("compress-settings");
  if (compressSettings) {
    compressSettings.style.display = mode === "compress" ? "block" : "none";
  }

  const btnText = {
    merge: "Gabungkan PDF",
    split: "Pecah ke ZIP",
    compress: "Kompres PDF",
  };
  document.getElementById("action-btn").innerText = btnText[mode];

  filesArray = [];
  renderList();
};

async function handleFiles(files) {
  const valid = Array.from(files).filter((f) => f.type === "application/pdf");
  if (
    (currentMode === "split" || currentMode === "compress") &&
    filesArray.length + valid.length > 1
  ) {
    return alert("Pilih 1 file saja untuk mode ini.");
  }
  for (let f of valid) {
    f.tempId = Math.random().toString(36).substr(2, 9);
    f.rotation = 0;
    f.thumb = await generateThumb(f);
    filesArray.push(f);
  }
  renderList();
}

async function generateThumb(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() })
    .promise;
  const page = await pdf.getPage(1);
  const canvas = document.createElement("canvas");
  const viewport = page.getViewport({ scale: 0.2 });
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport })
    .promise;
  return canvas;
}

window.rotateFile = (id) => {
  const file = filesArray.find((f) => f.tempId === id);
  file.rotation = (file.rotation + 90) % 360;
  const canvas = document.querySelector(`[data-id="${id}"] canvas`);
  canvas.style.transform = `rotate(${file.rotation}deg)`;
};

window.removeFile = (id) => {
  filesArray = filesArray.filter((f) => f.tempId !== id);
  renderList();
};

function renderList() {
  fileListContainer.innerHTML = "";
  filesArray.forEach((f) => {
    const li = document.createElement("li");
    li.className = "file-item";
    li.dataset.id = f.tempId;
    li.innerHTML = `
      <div class="thumb-box"></div>
      <div class="info"><b>${f.name}</b></div>
      <div class="controls">
        <button class="btn-icon" onclick="rotateFile('${f.tempId}')" title="Putar">🔄</button>
        <button class="btn-icon" onclick="removeFile('${f.tempId}')" style="color:red">✕</button>
      </div>`;
    li.querySelector(".thumb-box").appendChild(f.thumb);
    f.thumb.style.transform = `rotate(${f.rotation}deg)`;
    fileListContainer.appendChild(li);
  });
  actionBtn.disabled =
    currentMode === "merge" ? filesArray.length < 2 : filesArray.length !== 1;
}

// Inject compress-settings UI
document.addEventListener("DOMContentLoaded", () => {
  const compressDiv = document.createElement("div");
  compressDiv.id = "compress-settings";
  compressDiv.style.cssText =
    "display:none; margin:12px 0; padding:10px 14px; background:var(--card-bg, #f5f5f5); border-radius:8px; border:1px solid var(--border, #ddd);";
  compressDiv.innerHTML = `
    <div style="font-weight:600; margin-bottom:8px;">🗜️ Level Kompresi:</div>
    <div style="display:flex; flex-wrap:wrap; gap:10px;">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:6px;border:1px solid #ccc;background:white;">
        <input type="radio" name="compress-level" value="low"> 🟢 <span><b>Rendah</b><br><small style="color:#666">Kualitas terbaik, ukuran sedikit berkurang</small></span>
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:6px;border:2px solid #f0a500;background:white;">
        <input type="radio" name="compress-level" value="medium" checked> 🟡 <span><b>Sedang</b><br><small style="color:#666">Seimbang antara kualitas & ukuran</small></span>
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:6px;border:1px solid #ccc;background:white;">
        <input type="radio" name="compress-level" value="high"> 🔴 <span><b>Tinggi</b><br><small style="color:#666">Ukuran terkecil, kualitas lebih rendah</small></span>
      </label>
    </div>
  `;
  const dropZone = document.getElementById("drop-zone");
  dropZone.parentNode.insertBefore(compressDiv, dropZone.nextSibling);
});

// Level config
const COMPRESS_LEVELS = {
  low: { quality: 0.85, scale: 2.0 },
  medium: { quality: 0.65, scale: 1.5 },
  high: { quality: 0.4, scale: 1.2 },
};

// Core Action
const actionBtn = document.getElementById("action-btn");
const fileListContainer = document.getElementById("file-list");
const status = document.getElementById("status");

actionBtn.addEventListener("click", async () => {
  status.innerText = "⏳ Sedang memproses...";
  actionBtn.disabled = true;
  try {
    if (currentMode === "merge") {
      const merged = await PDFLib.PDFDocument.create();
      const wmText = document.getElementById("watermark-text").value;
      const password = document.getElementById("pdf-password").value;
      for (let f of filesArray) {
        const doc = await PDFLib.PDFDocument.load(await f.arrayBuffer());
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => {
          p.setRotation(PDFLib.degrees(f.rotation));
          if (wmText) {
            const { width, height } = p.getSize();
            p.drawText(wmText, {
              x: 50,
              y: height - 50,
              size: 30,
              opacity: 0.2,
              color: PDFLib.rgb(0.5, 0.5, 0.5),
            });
          }
          merged.addPage(p);
        });
      }
      const pdfBytes = await merged.save({
        userPassword: password || undefined,
      });
      download(pdfBytes, "merged.pdf", "application/pdf");
      status.innerText = "✅ Selesai!";
    } else if (currentMode === "compress") {
      const levelEl = document.querySelector(
        'input[name="compress-level"]:checked',
      );
      const level = levelEl ? levelEl.value : "medium";
      const { quality, scale: renderScale } = COMPRESS_LEVELS[level];

      const fileBuffer = await filesArray[0].arrayBuffer();
      const originalSize = fileBuffer.byteLength;

      // pdf.js untuk render visual (sudah menerapkan rotasi secara otomatis)
      const pdfJsDoc = await pdfjsLib.getDocument({ data: fileBuffer.slice(0) })
        .promise;
      const totalPages = pdfJsDoc.numPages;

      // pdf-lib hanya untuk baca ukuran & rotasi metadata asli
      const pdfLibDoc = await PDFLib.PDFDocument.load(fileBuffer.slice(0));

      const newPdf = await PDFLib.PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        status.innerText = `⏳ Mengompres halaman ${i}/${totalPages}...`;

        // Ukuran asli dalam points + rotasi metadata
        const origPage = pdfLibDoc.getPage(i - 1);
        const { width: ptWidth, height: ptHeight } = origPage.getSize();
        const rotDeg = origPage.getRotation().angle; // 0, 90, 180, 270

        // Jika ada rotasi 90/270, swap dimensi agar tidak terpotong
        const swapped = rotDeg === 90 || rotDeg === 270;
        const finalPtW = swapped ? ptHeight : ptWidth;
        const finalPtH = swapped ? ptWidth : ptHeight;

        // Render via pdf.js — pdf.js otomatis menerapkan rotasi secara visual
        const pdfJsPage = await pdfJsDoc.getPage(i);
        const viewport = pdfJsPage.getViewport({ scale: renderScale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfJsPage.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
        }).promise;

        // Canvas → JPEG
        const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
        const jpegBytes = Uint8Array.from(
          atob(jpegDataUrl.split(",")[1]),
          (c) => c.charCodeAt(0),
        );

        // Halaman baru dengan dimensi asli yang sudah diperhitungkan rotasinya
        const jpgImage = await newPdf.embedJpg(jpegBytes);
        const newPage = newPdf.addPage([finalPtW, finalPtH]);
        newPage.drawImage(jpgImage, {
          x: 0,
          y: 0,
          width: finalPtW,
          height: finalPtH,
        });
      }

      const pdfBytes = await newPdf.save();
      const compressedSize = pdfBytes.byteLength;
      const savedPercent = Math.round(
        (1 - compressedSize / originalSize) * 100,
      );
      const levelLabel = { low: "Rendah", medium: "Sedang", high: "Tinggi" }[
        level
      ];

      download(pdfBytes, "compressed.pdf", "application/pdf");
      status.innerText = `✅ Selesai! [Level: ${levelLabel}] Ukuran berkurang ${
        savedPercent > 0 ? savedPercent + "%" : "minimal (PDF sudah optimal)"
      }. (${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressedSize / 1024 / 1024).toFixed(2)} MB)`;
    } else {
      const zip = new JSZip();
      const mainDoc = await PDFLib.PDFDocument.load(
        await filesArray[0].arrayBuffer(),
      );
      for (let i = 0; i < mainDoc.getPageCount(); i++) {
        const sub = await PDFLib.PDFDocument.create();
        const [p] = await sub.copyPages(mainDoc, [i]);
        sub.addPage(p);
        zip.file(`Hal_${i + 1}.pdf`, await sub.save());
      }
      download(
        await zip.generateAsync({ type: "blob" }),
        "split.zip",
        "application/zip",
      );
      status.innerText = "✅ Selesai!";
    }
  } catch (e) {
    status.innerText = "❌ Terjadi kesalahan: " + e.message;
    console.error(e);
  }
  actionBtn.disabled = false;
});

function download(data, name, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
}

document.getElementById("theme-toggle").onclick = () => {
  const d = document.documentElement;
  d.setAttribute(
    "data-theme",
    d.getAttribute("data-theme") === "dark" ? "light" : "dark",
  );
};

const dz = document.getElementById("drop-zone");
dz.ondragover = (e) => {
  e.preventDefault();
  dz.classList.add("highlight");
};
dz.ondragleave = () => dz.classList.remove("highlight");
dz.ondrop = (e) => {
  e.preventDefault();
  dz.classList.remove("highlight");
  handleFiles(e.dataTransfer.files);
};
document.getElementById("pdf-input").onchange = (e) =>
  handleFiles(e.target.files);
new Sortable(fileListContainer, { animation: 150 });

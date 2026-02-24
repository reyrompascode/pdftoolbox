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
  document.getElementById("extra-settings").style.display =
    mode === "merge" ? "block" : "none";
  document.getElementById("action-btn").innerText =
    mode === "merge" ? "Gabungkan PDF" : "Pecah ke ZIP";
  filesArray = [];
  renderList();
};

async function handleFiles(files) {
  const valid = Array.from(files).filter((f) => f.type === "application/pdf");
  if (currentMode === "split" && filesArray.length + valid.length > 1)
    return alert("Pilih 1 file saja untuk split.");

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
      // Enkripsi (pdf-lib membutuhkan password via save options)
      const pdfBytes = await merged.save({
        userPassword: password || undefined,
      });
      download(pdfBytes, "merged.pdf", "application/pdf");
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
    }
    status.innerText = "✅ Selesai!";
  } catch (e) {
    status.innerText = "❌ Terjadi kesalahan.";
    console.error(e);
  }
  actionBtn.disabled = false;
});

// Helpers
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

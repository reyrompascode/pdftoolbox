pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

let filesArray = [];
let currentMode = "merge";

const actionBtn = document.getElementById("action-btn");
const fileListContainer = document.getElementById("file-list");
const status = document.getElementById("status");

// Switch Mode
window.switchMode = (mode) => {
  currentMode = mode;
  document
    .getElementById("tab-merge")
    .classList.toggle("active", mode === "merge");
  document
    .getElementById("tab-split")
    .classList.toggle("active", mode === "split");
  actionBtn.innerText = mode === "merge" ? "Gabungkan PDF" : "Pecah PDF ke ZIP";
  document.getElementById("drop-text").innerText =
    mode === "merge"
      ? "Tarik & Lepaskan beberapa file PDF"
      : "Tarik & Lepaskan 1 file PDF untuk dipecah";
  filesArray = [];
  renderList();
};

// Thumbnail & Files
async function handleFiles(files) {
  const validFiles = Array.from(files).filter(
    (f) => f.type === "application/pdf",
  );
  if (currentMode === "split" && filesArray.length + validFiles.length > 1) {
    alert("Mode Split hanya mendukung 1 file saja.");
    return;
  }
  for (let f of validFiles) {
    f.tempId = Math.random().toString(36).substr(2, 9);
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

function renderList() {
  fileListContainer.innerHTML = "";
  filesArray.forEach((f) => {
    const li = document.createElement("li");
    li.className = "file-item";
    li.dataset.id = f.tempId;
    li.innerHTML = `<div class="thumb"></div><div class="info"><b>${f.name}</b>${(f.size / 1024).toFixed(0)} KB</div><button class="btn-del" onclick="removeFile('${f.tempId}')">✕</button>`;
    li.querySelector(".thumb").appendChild(f.thumb.cloneNode(true));
    fileListContainer.appendChild(li);
  });
  actionBtn.disabled =
    currentMode === "merge" ? filesArray.length < 2 : filesArray.length !== 1;
}

window.removeFile = (id) => {
  filesArray = filesArray.filter((f) => f.tempId !== id);
  renderList();
};

// Core Logic: Merge & Split
actionBtn.addEventListener("click", async () => {
  status.innerText = "⏳ Memproses...";
  actionBtn.disabled = true;
  try {
    if (currentMode === "merge") {
      const merged = await PDFLib.PDFDocument.create();
      for (let f of filesArray) {
        const doc = await PDFLib.PDFDocument.load(await f.arrayBuffer());
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      download(await merged.save(), "combined.pdf", "application/pdf");
    } else {
      const zip = new JSZip();
      const mainDoc = await PDFLib.PDFDocument.load(
        await filesArray[0].arrayBuffer(),
      );
      for (let i = 0; i < mainDoc.getPageCount(); i++) {
        const subDoc = await PDFLib.PDFDocument.create();
        const [page] = await subDoc.copyPages(mainDoc, [i]);
        subDoc.addPage(page);
        zip.file(`Halaman_${i + 1}.pdf`, await subDoc.save());
      }
      const content = await zip.generateAsync({ type: "blob" });
      download(content, "splitted_pdf.zip", "application/zip");
    }
    status.innerText = "✅ Berhasil!";
  } catch (e) {
    status.innerText = "❌ Gagal!";
    console.error(e);
  }
  actionBtn.disabled = false;
});

function download(data, name, type) {
  const b = new Blob([data], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
}

// UI Helpers (Theme & DragDrop)
document.getElementById("theme-toggle").onclick = () => {
  const d = document.documentElement;
  d.setAttribute(
    "data-theme",
    d.getAttribute("data-theme") === "dark" ? "light" : "dark",
  );
};
const dz = document.getElementById("drop-zone");
dz.addEventListener("dragover", (e) => {
  e.preventDefault();
  dz.classList.add("highlight");
});
dz.addEventListener("dragleave", () => dz.classList.remove("highlight"));
dz.addEventListener("drop", (e) => {
  e.preventDefault();
  dz.classList.remove("highlight");
  handleFiles(e.dataTransfer.files);
});
document.getElementById("pdf-input").onchange = (e) =>
  handleFiles(e.target.files);

new Sortable(fileListContainer, {
  animation: 150,
  onEnd: () => {
    const order = Array.from(fileListContainer.children).map(
      (li) => li.dataset.id,
    );
    filesArray.sort(
      (a, b) => order.indexOf(a.tempId) - order.indexOf(b.tempId),
    );
  },
});

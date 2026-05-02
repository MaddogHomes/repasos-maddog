import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Upload, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, CheckCircle2, FileDown, Trash2, Edit2, Loader2, Building2, ArrowLeft, Calendar, MapPin, Plus, Megaphone, X, Check, ImagePlus, FolderOpen, FileText, Clock, MoreVertical, Pencil, Undo2, ArrowUpRight, Circle, Mic, Camera } from 'lucide-react';

const GREMIOS = [
  'AIRE ACONDICIONADO', 'ALBAÑILERÍA', 'ASCENSOR', 'APARATOS SANITARIOS',
  'CARPINTERIA EXTERIOR', 'CARPINTERÍA MADERA', 'CERRAJERÍA', 'COCINA Y ELECTR.',
  'ELECTRICIDAD', 'FONTANERÍA Y CALEFACCIÓN', 'GAS', 'JARDINERIA', 'LIMPIEZA',
  'PINTURAS Y PAPELES', 'PISCINA', 'SOLADOS Y ALICATADOS', 'VENTILACIÓN', 'VIDRIERÍA'
];

const PRIORITIES = [
  { id: 'alta',  label: 'Alta',  order: 1, icon: AlertTriangle, rgb: [220, 38, 38],  bg: 'bg-red-600',     soft: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'media', label: 'Media', order: 2, icon: AlertCircle,   rgb: [245, 158, 11], bg: 'bg-amber-500',   soft: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'baja',  label: 'Baja',  order: 3, icon: CheckCircle2,  rgb: [16, 185, 129], bg: 'bg-emerald-600', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
];

const getPrio = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[1];

// ---------- IndexedDB ----------
const DB_NAME = 'maddog-repasos';
const STORE_DEFECTS = 'defects';
const STORE_OBRA = 'obra';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DEFECTS)) {
        db.createObjectStore(STORE_DEFECTS, { keyPath: 'description' });
      }
      if (!db.objectStoreNames.contains(STORE_OBRA)) {
        db.createObjectStore(STORE_OBRA, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllDefects() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_DEFECTS, 'readonly');
      const req = tx.objectStore(STORE_DEFECTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

async function saveDefect(description, gremio) {
  if (!description?.trim()) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DEFECTS, 'readwrite');
    const store = tx.objectStore(STORE_DEFECTS);
    const existing = await new Promise(r => {
      const req = store.get(description);
      req.onsuccess = () => r(req.result);
      req.onerror = () => r(null);
    });
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.lastUsed = Date.now();
      existing.gremio = gremio;
      store.put(existing);
    } else {
      store.put({ description, gremio, count: 1, lastUsed: Date.now() });
    }
  } catch (e) {}
}

async function clearDefects() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DEFECTS, 'readwrite');
    tx.objectStore(STORE_DEFECTS).clear();
  } catch {}
}

async function listObras() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_OBRA, 'readonly');
      const req = tx.objectStore(STORE_OBRA).getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        all.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        resolve(all);
      };
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

async function getObra(id) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_OBRA, 'readonly');
      const req = tx.objectStore(STORE_OBRA).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function putObra(obra) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_OBRA, 'readwrite');
    tx.objectStore(STORE_OBRA).put(obra);
    return new Promise((resolve) => { tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); });
  } catch { return false; }
}

async function deleteObra(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_OBRA, 'readwrite');
    tx.objectStore(STORE_OBRA).delete(id);
  } catch {}
}

function newObraId() {
  return `obra_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function compressImage(file, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  if (hour < 24) return `hace ${hour} h`;
  if (day < 7) return `hace ${day} ${day === 1 ? 'día' : 'días'}`;
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RepasosApp() {
  const [screen, setScreen] = useState('library');
  const [activeObraId, setActiveObraId] = useState(null);
  const [obrasList, setObrasList] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [defectHistory, setDefectHistory] = useState([]);
  const [libsReady, setLibsReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [hydrated, setHydrated] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [downloadHandle, setDownloadHandle] = useState(null);

  const requestConfirm = useCallback(({ message, confirmLabel = 'Eliminar', danger = true }) => {
    return new Promise((resolve) => {
      setConfirmRequest({ message, confirmLabel, danger, resolve });
    });
  }, []);

  const closeConfirm = (result) => {
    if (confirmRequest) confirmRequest.resolve(result);
    setConfirmRequest(null);
  };

  useEffect(() => {
    let loaded = 0;
    const onload = () => { loaded += 1; if (loaded === 2) setLibsReady(true); };
    const s1 = document.createElement('script');
    s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s1.onload = onload;
    document.head.appendChild(s1);
    const s2 = document.createElement('script');
    s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s2.onload = onload;
    document.head.appendChild(s2);

    getAllDefects().then(setDefectHistory);
  }, []);

  useEffect(() => {
    (async () => {
      const list = await listObras();
      const legacy = list.find(o => o.id === 'current');
      if (legacy && (legacy.photos?.length || legacy.projectName)) {
        const newId = newObraId();
        const migrated = { ...legacy, id: newId, lastModified: legacy.lastModified || Date.now(), createdAt: legacy.createdAt || Date.now() };
        await putObra(migrated);
        await deleteObra('current');
        const refreshed = await listObras();
        setObrasList(refreshed);
      } else {
        setObrasList(list);
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated || !activeObraId) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      const existing = await getObra(activeObraId);
      const payload = {
        id: activeObraId,
        projectName,
        reviewDate,
        photos,
        currentIndex,
        screen,
        createdAt: existing?.createdAt || Date.now(),
        lastModified: Date.now(),
        exportCount: existing?.exportCount || 0,
        lastExported: existing?.lastExported || null
      };
      await putObra(payload);
      setSaveStatus('saved');
      const list = await listObras();
      setObrasList(list);
    }, 350);
    return () => clearTimeout(t);
  }, [photos, projectName, reviewDate, currentIndex, screen, activeObraId, hydrated]);

  const refreshDefectHistory = useCallback(() => {
    getAllDefects().then(setDefectHistory);
  }, []);

  const refreshObrasList = useCallback(async () => {
    const list = await listObras();
    setObrasList(list);
  }, []);

  const zones = useMemo(() => {
    const set = new Set();
    photos.forEach(p => {
      if (!p.isGeneral && p.zone?.trim()) set.add(p.zone.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [photos]);

  const goToLibrary = async () => {
    setActiveObraId(null);
    setPhotos([]);
    setCurrentIndex(0);
    setProjectName('');
    setReviewDate(new Date().toISOString().split('T')[0]);
    setScreen('library');
    await refreshObrasList();
  };

  const startNewObra = () => {
    setActiveObraId(null);
    setPhotos([]);
    setCurrentIndex(0);
    setProjectName('');
    setReviewDate(new Date().toISOString().split('T')[0]);
    setScreen('upload');
  };

  const openObra = async (id) => {
    const obra = await getObra(id);
    if (!obra) return;
    setActiveObraId(id);
    setProjectName(obra.projectName || '');
    setReviewDate(obra.reviewDate || new Date().toISOString().split('T')[0]);
    setPhotos(obra.photos || []);
    setCurrentIndex(Math.min(obra.currentIndex || 0, Math.max(0, (obra.photos?.length || 1) - 1)));
    const targetScreen = obra.screen && obra.photos?.length > 0 ? obra.screen : (obra.photos?.length > 0 ? 'review' : 'upload');
    setScreen(targetScreen);
  };

  const handleDeleteObra = async (id, name) => {
    const ok = await requestConfirm({
      message: `¿Eliminar la obra "${name || 'sin nombre'}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar obra'
    });
    if (!ok) return;
    await deleteObra(id);
    if (activeObraId === id) {
      goToLibrary();
    } else {
      await refreshObrasList();
    }
  };

  const handleRenameObra = async (id, newName) => {
    const obra = await getObra(id);
    if (!obra) return;
    await putObra({ ...obra, projectName: newName, lastModified: Date.now() });
    if (activeObraId === id) setProjectName(newName);
    await refreshObrasList();
  };

  const startReview = async (newPhotos) => {
    let id = activeObraId;
    if (!id) {
      id = newObraId();
      setActiveObraId(id);
      const payload = {
        id,
        projectName,
        reviewDate,
        photos: newPhotos,
        currentIndex: 0,
        screen: 'review',
        createdAt: Date.now(),
        lastModified: Date.now(),
        exportCount: 0,
        lastExported: null
      };
      await putObra(payload);
    }
    setPhotos(newPhotos);
    setCurrentIndex(0);
    setScreen('review');
  };

  const addMorePhotos = (newPhotos) => {
    setPhotos(prev => {
      const updated = [...prev, ...newPhotos];
      setCurrentIndex(prev.length);
      return updated;
    });
    if (screen !== 'review') setScreen('review');
  };

  const updatePhoto = (index, patch) => {
    setPhotos(prev => prev.map((p, i) => i === index ? { ...p, ...patch } : p));
  };

  const removePhoto = (index) => {
    setPhotos(prev => {
      const updated = prev.filter((_, i) => i !== index);
      setCurrentIndex(ci => Math.max(0, Math.min(ci, updated.length - 1)));
      return updated;
    });
  };

  const goToReview = (index) => {
    setCurrentIndex(index);
    setScreen('review');
  };

  const generatePDFs = async () => {
    if (!libsReady) return;
    setGenerating(true);
    try {
      const { jsPDF } = window.jspdf;
      const zip = new window.JSZip();

      const validPhotos = photos.filter(p => p.gremio);
      const byGremio = {};
      validPhotos.forEach(p => {
        if (!byGremio[p.gremio]) byGremio[p.gremio] = [];
        byGremio[p.gremio].push(p);
      });

      const dateFormat = new Date(reviewDate + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

      const sortItems = (items) => [...items].sort((a, b) => {
        if (a.isGeneral !== b.isGeneral) return a.isGeneral ? -1 : 1;
        return getPrio(a.priority).order - getPrio(b.priority).order;
      });

      for (const gremio of Object.keys(byGremio).sort()) {
        const items = sortItems(byGremio[gremio]);
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW = 297;
        const pageH = 210;
        const margin = 10;

        const drawCoverHeader = () => {
          pdf.setFillColor(15, 15, 15);
          pdf.rect(0, 0, pageW, 22, 'F');
          pdf.setTextColor(255);
          pdf.setFontSize(8);
          pdf.text('MADDOG HOMES · REPASOS DE OBRA', margin, 8);
          pdf.setFontSize(13);
          pdf.setFont(undefined, 'bold');
          pdf.text(gremio, margin, 16);
          pdf.setFont(undefined, 'normal');
          pdf.setFontSize(9);
          pdf.text(projectName || 'Obra sin nombre', pageW - margin, 8, { align: 'right' });
          pdf.text(`Fecha de revisión: ${dateFormat}`, pageW - margin, 16, { align: 'right' });
        };

        const drawCoverFooter = () => {
          pdf.setDrawColor(220);
          pdf.line(margin, pageH - 12, pageW - margin, pageH - 12);
          pdf.setFontSize(7);
          pdf.setTextColor(140);
          pdf.text('Maddog Homes SL  ·  marcos@maddoghomes.com  ·  www.maddoghomes.com  ·  C/ Jorge Juan 68, 5º·5, 28009 Madrid', pageW / 2, pageH - 6, { align: 'center' });
        };

        const colX = { num: margin, prio: margin + 12, zona: margin + 42, desc: margin + 92 };
        const descMaxW = pageW - margin - colX.desc;

        const drawTableHeader = (yy) => {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yy - 5, pageW - 2 * margin, 8, 'F');
          pdf.setTextColor(80);
          pdf.setFontSize(8);
          pdf.setFont(undefined, 'bold');
          pdf.text('#', colX.num, yy);
          pdf.text('PRIORIDAD', colX.prio, yy);
          pdf.text('ZONA', colX.zona, yy);
          pdf.text('DESCRIPCIÓN', colX.desc, yy);
          pdf.setFont(undefined, 'normal');
        };

        drawCoverHeader();

        let y = 32;
        const counts = { alta: 0, media: 0, baja: 0 };
        const generalCount = items.filter(it => it.isGeneral).length;
        items.forEach(it => { counts[it.priority] = (counts[it.priority] || 0) + 1; });

        pdf.setTextColor(20);
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Resumen de repasos (${items.length})`, margin, y);
        pdf.setFont(undefined, 'normal');

        let xPos = margin + 70;
        if (generalCount > 0) {
          pdf.setFillColor(220, 38, 38);
          pdf.roundedRect(xPos, y - 4, 36, 6, 1, 1, 'F');
          pdf.setTextColor(255);
          pdf.setFontSize(8);
          pdf.setFont(undefined, 'bold');
          pdf.text(`${generalCount} GENERAL${generalCount > 1 ? 'ES' : ''}`, xPos + 18, y, { align: 'center' });
          pdf.setFont(undefined, 'normal');
          xPos += 42;
        }
        PRIORITIES.forEach(pr => {
          const c = counts[pr.id] || 0;
          if (c === 0) return;
          pdf.setFillColor(...pr.rgb);
          pdf.circle(xPos + 1.5, y - 1.5, 1.8, 'F');
          pdf.setTextColor(40);
          pdf.setFontSize(9);
          const lbl = `${c} ${pr.label}`;
          pdf.text(lbl, xPos + 5, y);
          xPos += pdf.getTextWidth(lbl) + 12;
        });

        y += 10;
        drawTableHeader(y);
        y += 6;

        items.forEach((item, idx) => {
          const pr = getPrio(item.priority);
          const desc = item.description?.trim() || '(sin descripción)';
          pdf.setFontSize(9);
          const lines = pdf.splitTextToSize(desc, descMaxW);
          const rowH = Math.max(8, lines.length * 4 + 3);

          if (y + rowH > pageH - 16) {
            drawCoverFooter();
            pdf.addPage();
            drawCoverHeader();
            y = 30;
            drawTableHeader(y);
            y += 6;
          }

          pdf.setTextColor(120);
          pdf.setFontSize(9);
          pdf.text(`${idx + 1}`, colX.num, y);

          pdf.setFillColor(...pr.rgb);
          pdf.roundedRect(colX.prio, y - 4, 24, 5.5, 1, 1, 'F');
          pdf.setTextColor(255);
          pdf.setFontSize(7);
          pdf.setFont(undefined, 'bold');
          pdf.text(pr.label.toUpperCase(), colX.prio + 12, y - 0.3, { align: 'center' });
          pdf.setFont(undefined, 'normal');

          if (item.isGeneral) {
            pdf.setFillColor(220, 38, 38);
            pdf.roundedRect(colX.zona, y - 4, 26, 5.5, 1, 1, 'F');
            pdf.setTextColor(255);
            pdf.setFontSize(7);
            pdf.setFont(undefined, 'bold');
            pdf.text('GENERAL', colX.zona + 13, y - 0.3, { align: 'center' });
            pdf.setFont(undefined, 'normal');
          } else if (item.zone) {
            pdf.setTextColor(20);
            pdf.setFontSize(9);
            const zoneLines = pdf.splitTextToSize(item.zone, 45);
            pdf.text(zoneLines.slice(0, 2), colX.zona, y);
          } else {
            pdf.setTextColor(180);
            pdf.setFontSize(9);
            pdf.text('—', colX.zona, y);
          }

          pdf.setTextColor(20);
          pdf.setFontSize(9);
          pdf.text(lines, colX.desc, y);

          y += rowH;
          pdf.setDrawColor(235);
          pdf.line(margin, y - 2, pageW - margin, y - 2);
        });

        drawCoverFooter();

        const itemsPerPage = 4;
        const cellsPerRow = 2;
        const headerH = 12;
        const footerH = 10;
        const cellGap = 4;
        const usableW = pageW - 2 * margin;
        const usableH = pageH - headerH - footerH - 6;
        const cellW = (usableW - cellGap) / cellsPerRow;
        const cellH = (usableH - cellGap) / 2;

        for (let i = 0; i < items.length; i += itemsPerPage) {
          pdf.addPage();

          pdf.setFillColor(15, 15, 15);
          pdf.rect(0, 0, pageW, headerH, 'F');
          pdf.setTextColor(255);
          pdf.setFontSize(9);
          pdf.text(gremio, margin, 8);
          const last = Math.min(i + itemsPerPage, items.length);
          pdf.text(`Repasos ${i + 1}–${last} de ${items.length}`, pageW - margin, 8, { align: 'right' });

          pdf.setDrawColor(220);
          pdf.line(margin, pageH - 8, pageW - margin, pageH - 8);
          pdf.setFontSize(7);
          pdf.setTextColor(140);
          pdf.text(`${projectName || 'Obra'}  ·  ${dateFormat}  ·  Maddog Homes SL`, pageW / 2, pageH - 4, { align: 'center' });

          for (let j = 0; j < itemsPerPage; j++) {
            const itemIdx = i + j;
            if (itemIdx >= items.length) break;
            const item = items[itemIdx];
            const row = Math.floor(j / cellsPerRow);
            const col = j % cellsPerRow;
            const cx = margin + col * (cellW + cellGap);
            const cy = headerH + 4 + row * (cellH + cellGap);
            const pr = getPrio(item.priority);

            pdf.setFillColor(252, 252, 252);
            pdf.setDrawColor(220);
            pdf.roundedRect(cx, cy, cellW, cellH, 1.5, 1.5, 'FD');

            pdf.setTextColor(120);
            pdf.setFontSize(8);
            pdf.setFont(undefined, 'bold');
            pdf.text(`#${itemIdx + 1}`, cx + 3, cy + 5);
            pdf.setFont(undefined, 'normal');

            pdf.setFillColor(...pr.rgb);
            pdf.roundedRect(cx + 12, cy + 1.5, 22, 5, 1, 1, 'F');
            pdf.setTextColor(255);
            pdf.setFontSize(6.5);
            pdf.setFont(undefined, 'bold');
            pdf.text(pr.label.toUpperCase(), cx + 23, cy + 5, { align: 'center' });
            pdf.setFont(undefined, 'normal');

            if (item.isGeneral) {
              pdf.setFillColor(220, 38, 38);
              pdf.roundedRect(cx + cellW - 28, cy + 1.5, 26, 5, 1, 1, 'F');
              pdf.setTextColor(255);
              pdf.setFontSize(6.5);
              pdf.setFont(undefined, 'bold');
              pdf.text('GENERAL', cx + cellW - 15, cy + 5, { align: 'center' });
              pdf.setFont(undefined, 'normal');
            } else if (item.zone) {
              pdf.setTextColor(80);
              pdf.setFontSize(7.5);
              const zone = item.zone.length > 22 ? item.zone.slice(0, 21) + '…' : item.zone;
              pdf.text(zone, cx + cellW - 3, cy + 5, { align: 'right' });
            }

            const cellHeaderH = 7;
            const descH = 18;
            const imgPad = 2;
            const imgY = cy + cellHeaderH + 1;
            const imgH = cellH - cellHeaderH - descH - 2;
            const imgW = cellW - 2 * imgPad;

            try {
              const props = pdf.getImageProperties(item.dataUrl);
              const imgRatio = props.width / props.height;
              const cellRatio = imgW / imgH;
              let drawW, drawH;
              if (imgRatio > cellRatio) {
                drawW = imgW;
                drawH = imgW / imgRatio;
              } else {
                drawH = imgH;
                drawW = imgH * imgRatio;
              }
              const dx = cx + imgPad + (imgW - drawW) / 2;
              const dy = imgY + (imgH - drawH) / 2;
              pdf.addImage(item.dataUrl, 'JPEG', dx, dy, drawW, drawH);
            } catch (e) {
              pdf.setTextColor(180);
              pdf.setFontSize(8);
              pdf.text('(error al cargar imagen)', cx + cellW / 2, imgY + imgH / 2, { align: 'center' });
            }

            pdf.setTextColor(20);
            pdf.setFontSize(8);
            const descText = item.description?.trim() || '(Sin descripción)';
            const descLines = pdf.splitTextToSize(descText, cellW - 4);
            const maxLines = 3;
            const shown = descLines.slice(0, maxLines);
            if (descLines.length > maxLines) {
              shown[maxLines - 1] = shown[maxLines - 1].replace(/\s*\S*$/, '') + '…';
            }
            const descStartY = cy + cellH - descH + 5;
            pdf.text(shown, cx + 2, descStartY);
          }
        }

        const safeName = gremio.replace(/[^a-zA-Z0-9]/g, '_');
        zip.file(`${safeName}.pdf`, pdf.output('blob'));
      }

      const safeProj = (projectName || 'obra').replace(/[^a-zA-Z0-9]/g, '_');
      const blob = await zip.generateAsync({ type: 'blob' });
      const filename = `Repasos_${safeProj}_${reviewDate}.zip`;
      setDownloadHandle(prev => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return null;
      });
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 100);
      } catch (err) {
        console.warn('Auto-download failed', err);
      }
      setDownloadHandle({ url, filename });

      if (activeObraId) {
        const existing = await getObra(activeObraId);
        if (existing) {
          await putObra({
            ...existing,
            exportCount: (existing.exportCount || 0) + 1,
            lastExported: Date.now(),
            lastModified: Date.now()
          });
          await refreshObrasList();
        }
      }
    } catch (e) {
      console.error(e);
      alert('Error al generar los PDFs. Revisa la consola.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={goToLibrary}
            className="flex items-center gap-2 group"
            disabled={screen === 'library'}
          >
            <div className="w-8 h-8 bg-stone-900 text-white rounded flex items-center justify-center group-hover:bg-stone-700 transition-colors">
              <Building2 size={18} />
            </div>
            <div className="leading-tight text-left">
              <div className="text-sm font-semibold">MADDOG HOMES</div>
              <div className="text-xs text-stone-500">Repasos de obra</div>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <SaveIndicator status={saveStatus} hasData={!!activeObraId && (photos.length > 0 || projectName.length > 0)} />
            {screen !== 'library' && (
              <button onClick={goToLibrary} className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-stone-100">
                <FolderOpen size={13} /> Mis obras
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {screen === 'library' && (
          <LibraryScreen
            obras={obrasList}
            hydrated={hydrated}
            onOpen={openObra}
            onNew={startNewObra}
            onDelete={handleDeleteObra}
            onRename={handleRenameObra}
            defectHistory={defectHistory}
            onClearHistory={async () => {
              const ok = await requestConfirm({
                message: '¿Borrar todo el historial de descripciones guardadas? Esto no afecta a las obras.',
                confirmLabel: 'Borrar historial'
              });
              if (ok) {
                await clearDefects();
                refreshDefectHistory();
              }
            }}
          />
        )}

        {screen === 'upload' && (
          <UploadScreen
            projectName={projectName}
            setProjectName={setProjectName}
            reviewDate={reviewDate}
            setReviewDate={setReviewDate}
            onStart={startReview}
          />
        )}

        {screen === 'review' && photos.length > 0 && (
          <ReviewScreen
            photos={photos}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            updatePhoto={updatePhoto}
            removePhoto={removePhoto}
            defectHistory={defectHistory}
            refreshHistory={refreshDefectHistory}
            zones={zones}
            onAddMore={addMorePhotos}
            onFinish={() => setScreen('summary')}
            requestConfirm={requestConfirm}
          />
        )}

        {screen === 'summary' && (
          <SummaryScreen
            photos={photos}
            projectName={projectName}
            reviewDate={reviewDate}
            obraMeta={obrasList.find(o => o.id === activeObraId)}
            onEdit={goToReview}
            onDelete={removePhoto}
            onAddMore={addMorePhotos}
            onGenerate={generatePDFs}
            generating={generating}
            libsReady={libsReady}
            onBack={() => setScreen('review')}
            requestConfirm={requestConfirm}
          />
        )}
      </main>

      {downloadHandle && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md bg-emerald-600 text-white rounded-xl shadow-2xl z-30 p-3 flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 bg-emerald-700 rounded-full flex items-center justify-center">
            <FileDown size={18} />
          </div>
          <div className="flex-1 text-sm min-w-0">
            <div className="font-semibold">PDFs listos</div>
            <div className="text-xs text-emerald-100 truncate">{downloadHandle.filename}</div>
          </div>
          <a
            href={downloadHandle.url}
            download={downloadHandle.filename}
            className="px-3 py-2 bg-white text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-50 flex-shrink-0"
          >
            Descargar
          </a>
          <button
            onClick={() => {
              URL.revokeObjectURL(downloadHandle.url);
              setDownloadHandle(null);
            }}
            className="p-1.5 hover:bg-emerald-700 rounded flex-shrink-0"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {confirmRequest && (
        <ConfirmDialog
          message={confirmRequest.message}
          confirmLabel={confirmRequest.confirmLabel}
          danger={confirmRequest.danger}
          onCancel={() => closeConfirm(false)}
          onConfirm={() => closeConfirm(true)}
        />
      )}
    </div>
  );
}

function ConfirmDialog({ message, confirmLabel, danger, onCancel, onConfirm }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          {danger && (
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
          )}
          <p className="text-sm text-stone-800 leading-relaxed pt-1.5">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-stone-900 hover:bg-stone-800'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ status, hasData }) {
  if (!hasData) return null;
  if (status === 'saving') {
    return (
      <span className="text-xs text-stone-500 flex items-center gap-1">
        <Loader2 size={11} className="animate-spin" /> Guardando…
      </span>
    );
  }
  return (
    <span className="text-xs text-emerald-600 flex items-center gap-1">
      <Check size={11} /> Guardado
    </span>
  );
}

function LibraryScreen({ obras, hydrated, onOpen, onNew, onDelete, onRename, defectHistory, onClearHistory }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);

  const startRename = (obra) => {
    setRenamingId(obra.id);
    setRenameValue(obra.projectName || '');
    setMenuOpenId(null);
  };

  const commitRename = async (id) => {
    await onRename(id, renameValue.trim());
    setRenamingId(null);
    setRenameValue('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Mis obras</h1>
          <p className="text-stone-600 text-sm">Todas tus revisiones guardadas. Abre cualquiera para añadir más repasos o re-exportar.</p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-semibold hover:bg-stone-800 shadow-sm"
        >
          <Plus size={16} /> Nueva obra
        </button>
      </div>

      {!hydrated ? (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center text-sm text-stone-500">
          <Loader2 size={24} className="mx-auto animate-spin mb-2" />
          Cargando…
        </div>
      ) : obras.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-stone-300 p-10 text-center">
          <Building2 size={36} className="mx-auto text-stone-300 mb-3" />
          <p className="font-semibold text-stone-700 mb-1">Aún no tienes obras</p>
          <p className="text-sm text-stone-500 mb-4">Empieza creando tu primera revisión.</p>
          <button
            onClick={onNew}
            className="px-5 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800"
          >
            <Plus size={14} className="inline mr-1" /> Crear primera obra
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {obras.map(obra => {
            const photoCount = obra.photos?.length || 0;
            const classifiedCount = obra.photos?.filter(p => p.gremio).length || 0;
            const generalCount = obra.photos?.filter(p => p.isGeneral && p.gremio).length || 0;
            const dateLabel = obra.reviewDate
              ? new Date(obra.reviewDate + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—';
            const isRenaming = renamingId === obra.id;

            return (
              <div key={obra.id} className="bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition-colors overflow-hidden group">
                <div className="p-4 flex items-start gap-3">
                  <button
                    onClick={() => onOpen(obra.id)}
                    className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 hover:border-stone-400 transition-colors"
                  >
                    {obra.photos?.[0]?.dataUrl ? (
                      <img src={obra.photos[0].dataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400">
                        <Building2 size={20} />
                      </div>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(obra.id);
                          if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                        }}
                        onBlur={() => commitRename(obra.id)}
                        autoFocus
                        className="w-full px-2 py-1 text-base font-semibold border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-stone-900"
                      />
                    ) : (
                      <button
                        onClick={() => onOpen(obra.id)}
                        className="text-base font-semibold text-left hover:text-stone-700 truncate w-full block"
                      >
                        {obra.projectName || 'Obra sin nombre'}
                      </button>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1 flex-wrap">
                      <Calendar size={10} /> {dateLabel}
                      <span className="text-stone-300">·</span>
                      <FileText size={10} /> {classifiedCount}/{photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
                      {generalCount > 0 && (
                        <>
                          <span className="text-stone-300">·</span>
                          <span className="text-red-600 font-medium">{generalCount} general{generalCount > 1 ? 'es' : ''}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-stone-400 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={10} /> {relativeTime(obra.lastModified)}</span>
                      {obra.exportCount > 0 ? (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium">
                          Exportado {obra.exportCount}× · {relativeTime(obra.lastExported)}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-stone-100 text-stone-500 border border-stone-200 rounded text-[10px]">
                          Sin exportar
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onOpen(obra.id)}
                      className="px-3 py-1.5 bg-stone-900 text-white rounded-md text-xs font-medium hover:bg-stone-800"
                    >
                      Abrir
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === obra.id ? null : obra.id)}
                        className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {menuOpenId === obra.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                          <div className="absolute right-0 mt-1 w-44 bg-white border border-stone-200 rounded-lg shadow-lg z-20 overflow-hidden">
                            <button
                              onClick={() => startRename(obra)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-stone-50 flex items-center gap-2"
                            >
                              <Edit2 size={12} /> Renombrar
                            </button>
                            <button
                              onClick={() => { setMenuOpenId(null); onDelete(obra.id, obra.projectName); }}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-stone-100"
                            >
                              <Trash2 size={12} /> Eliminar obra
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-stone-500 flex items-center justify-between pt-2 border-t border-stone-200">
        <span>{defectHistory.length} descripciones guardadas para autocompletar</span>
        {defectHistory.length > 0 && (
          <button onClick={onClearHistory} className="hover:text-red-600 underline">
            Limpiar historial
          </button>
        )}
      </div>
    </div>
  );
}

function AddMoreButton({ onAddMore, label = 'Añadir más fotos' }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef();
  const galleryRef = useRef();

  const handleFiles = async (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    setLoading(true);
    setProgress(0);
    const newPhotos = [];
    for (let i = 0; i < imgs.length; i++) {
      const dataUrl = await compressImage(imgs[i]);
      newPhotos.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${i}`,
        dataUrl,
        originalName: imgs[i].name,
        gremio: '',
        description: '',
        priority: 'media',
        zone: '',
        isGeneral: false
      });
      setProgress(((i + 1) / imgs.length) * 100);
    }
    setLoading(false);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
    onAddMore(newPhotos);
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-stone-300 rounded-lg text-sm font-medium bg-white text-stone-700">
        <Loader2 size={14} className="animate-spin" /> Procesando {Math.round(progress)}%
      </div>
    );
  }

  return (
    <div>
      {label && <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2 text-center">{label}</p>}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center justify-center gap-2 px-3 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors cursor-pointer">
          <Camera size={14} /> Hacer foto
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
          />
        </label>
        <label className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors cursor-pointer">
          <ImagePlus size={14} /> Desde galería
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}

function UploadScreen({ projectName, setProjectName, reviewDate, setReviewDate, onStart }) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef();
  const galleryRef = useRef();

  const handleFiles = async (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imgs.length) {
      alert('Por favor selecciona archivos de imagen.');
      return;
    }
    setLoading(true);
    setProgress(0);
    const newPhotos = [];
    for (let i = 0; i < imgs.length; i++) {
      const dataUrl = await compressImage(imgs[i]);
      newPhotos.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${i}`,
        dataUrl,
        originalName: imgs[i].name,
        gremio: '',
        description: '',
        priority: 'media',
        zone: '',
        isGeneral: false
      });
      setProgress(((i + 1) / imgs.length) * 100);
    }
    setLoading(false);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
    onStart(newPhotos);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Nueva revisión de obra</h1>
        <p className="text-stone-600 text-sm">Sube las fotos del repaso y clasifícalas por gremio para generar el PDF de cada contratista.</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">Nombre de la obra</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Ej: Reforma Jorge Juan 68"
            className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
            <Calendar size={12} className="inline mr-1" /> Fecha de revisión
          </label>
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
          />
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`bg-white rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? 'border-stone-900 bg-stone-50' : 'border-stone-300'
        }`}
      >
        {loading ? (
          <div className="space-y-3">
            <Loader2 className="mx-auto animate-spin text-stone-900" size={32} />
            <p className="text-sm text-stone-600">Procesando imágenes... {Math.round(progress)}%</p>
            <div className="w-full max-w-xs mx-auto bg-stone-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-stone-900 h-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <Upload className="mx-auto text-stone-400 mb-3" size={32} />
            <p className="font-semibold text-stone-900 mb-4">Añade las fotos de la obra</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-stone-900 text-white rounded-lg text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer">
                <Camera size={16} /> Hacer foto
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFiles(e.target.files)}
                  className="sr-only"
                />
              </label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-stone-300 text-stone-900 rounded-lg text-sm font-semibold hover:bg-stone-50 transition-colors cursor-pointer">
                <ImagePlus size={16} /> Desde galería
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="text-xs text-stone-400 mt-4">O arrastra desde tu ordenador · podrás añadir más fotos en cualquier momento</p>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewScreen({ photos, currentIndex, setCurrentIndex, updatePhoto, removePhoto, defectHistory, refreshHistory, zones, onAddMore, onFinish, requestConfirm }) {
  const photo = photos[currentIndex];
  const [description, setDescription] = useState(photo?.description || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newZone, setNewZone] = useState('');
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const handleAnnotationSave = ({ dataUrl, annotations, originalDataUrl }) => {
    updatePhoto(currentIndex, { dataUrl, annotations, originalDataUrl });
    setShowAnnotator(false);
  };

  const toggleDictation = () => {
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch {}
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      requestConfirm({
        message: 'Tu navegador no permite el dictado por voz. Prueba con Chrome, Edge o Safari actualizados (en iOS necesitas Safari).',
        confirmLabel: 'Entendido',
        danger: false
      });
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';
    const baseText = description.trim();
    let dictatedFinal = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          dictatedFinal += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const combined = (baseText ? baseText + ' ' : '') + dictatedFinal + interim;
      setDescription(combined.replace(/\s+/g, ' '));
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (e) => {
      console.error('Dictado:', e.error);
      setIsListening(false);
      recognitionRef.current = null;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        requestConfirm({
          message: 'No se pudo acceder al micrófono. Asegúrate de dar permiso al navegador y vuelve a intentarlo.',
          confirmLabel: 'Entendido',
          danger: false
        });
      }
    };
    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch (e) {
      console.error('Error iniciando dictado:', e);
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, [currentIndex]);

  useEffect(() => {
    setDescription(photo?.description || '');
    setNewZone('');
  }, [currentIndex, photo?.description]);

  const suggestions = useMemo(() => {
    const q = description.trim().toLowerCase();
    if (q.length < 2) return [];
    return defectHistory
      .filter(d => d.description.toLowerCase().includes(q) && d.description !== description)
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 5);
  }, [description, defectHistory]);

  if (!photo) return null;

  const saveDescription = () => updatePhoto(currentIndex, { description });

  const next = async () => {
    saveDescription();
    if (description.trim() && photo.gremio) {
      await saveDefect(description.trim(), photo.gremio);
      refreshHistory();
    }
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish();
    }
  };

  const prev = () => {
    saveDescription();
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleDelete = async () => {
    const ok = await requestConfirm({
      message: '¿Eliminar esta foto? No se incluirá en ningún PDF.',
      confirmLabel: 'Eliminar foto'
    });
    if (ok) removePhoto(currentIndex);
  };

  const commitNewZone = () => {
    const trimmed = newZone.trim();
    if (!trimmed) return;
    const existing = zones.find(z => z.toLowerCase() === trimmed.toLowerCase());
    const finalZone = existing || trimmed;
    updatePhoto(currentIndex, { zone: finalZone, isGeneral: false });
    setNewZone('');
  };

  const toggleGeneral = () => {
    if (photo.isGeneral) {
      updatePhoto(currentIndex, { isGeneral: false });
    } else {
      updatePhoto(currentIndex, { isGeneral: true, zone: '' });
    }
  };

  const progress = ((currentIndex + 1) / photos.length) * 100;
  const completedCount = photos.filter(p => p.gremio).length;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-sm font-medium text-stone-700">Foto {currentIndex + 1} de {photos.length}</span>
            <span className="text-xs text-stone-500">· {completedCount}/{photos.length} clasificadas</span>
          </div>
          <button
            onClick={onFinish}
            className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-800 font-medium flex-shrink-0"
            title="Ir al resumen de la obra"
          >
            <FileText size={12} /> Ver resumen
          </button>
        </div>
        <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
          <div className="bg-stone-900 h-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="bg-stone-100 flex items-center justify-center" style={{ minHeight: '300px', maxHeight: '500px' }}>
          <img src={photo.dataUrl} alt="" className="max-h-[500px] max-w-full object-contain" />
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between border-t border-stone-100 gap-2">
          <span className="text-xs text-stone-500 truncate flex-1 flex items-center gap-2">
            <span className="truncate">{photo.originalName || `Foto ${currentIndex + 1}`}</span>
            {photo.annotations?.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-stone-900 text-white font-medium flex-shrink-0">
                <Pencil size={9} /> Marcada
              </span>
            )}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowAnnotator(true)}
              className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-800 font-medium"
            >
              <Pencil size={12} /> {photo.annotations?.length > 0 ? 'Editar marcas' : 'Marcar foto'}
            </button>
            <button
              onClick={handleDelete}
              className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-medium"
            >
              <Trash2 size={12} /> Descartar
            </button>
          </div>
        </div>
      </div>

      {showAnnotator && (
        <AnnotationEditor
          photo={photo}
          onSave={handleAnnotationSave}
          onClose={() => setShowAnnotator(false)}
        />
      )}

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">Prioridad</label>
        <div className="grid grid-cols-3 gap-2">
          {PRIORITIES.map(pr => {
            const Icon = pr.icon;
            const active = photo.priority === pr.id;
            return (
              <button
                key={pr.id}
                onClick={() => updatePhoto(currentIndex, { priority: pr.id })}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                  active ? `${pr.bg} text-white border-transparent` : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'
                }`}
              >
                <Icon size={16} />
                {pr.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">
          Gremio {!photo.gremio && <span className="text-red-600 normal-case font-normal">· requerido para incluir en PDF</span>}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {GREMIOS.map(g => (
            <button
              key={g}
              onClick={() => updatePhoto(currentIndex, { gremio: g })}
              className={`text-xs px-2.5 py-2 rounded-md border transition-all text-left leading-tight ${
                photo.gremio === g
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
        <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide">
          Zona o ámbito
        </label>

        <button
          onClick={toggleGeneral}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
            photo.isGeneral
              ? 'bg-red-600 text-white border-red-600 shadow-sm'
              : 'bg-white border-red-200 text-red-700 hover:border-red-400'
          }`}
        >
          <Megaphone size={16} />
          {photo.isGeneral ? 'Marcado como repaso general' : 'Marcar como repaso general (toda la obra)'}
        </button>

        {!photo.isGeneral && (
          <>
            {zones.length > 0 && (
              <div>
                <div className="text-xs text-stone-500 mb-1.5">Zonas creadas en esta obra:</div>
                <div className="flex flex-wrap gap-1.5">
                  {zones.map(z => {
                    const active = photo.zone === z;
                    return (
                      <button
                        key={z}
                        onClick={() => updatePhoto(currentIndex, { zone: active ? '' : z })}
                        className={`text-xs px-2.5 py-1.5 rounded-full border transition-all flex items-center gap-1 ${
                          active
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white border-stone-300 text-stone-700 hover:border-stone-500'
                        }`}
                      >
                        <MapPin size={11} />
                        {z}
                        {active && <X size={11} className="ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs text-stone-500 mb-1.5">
                {zones.length > 0 ? 'O añade una zona nueva:' : 'Añade la primera zona:'}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newZone}
                  onChange={(e) => setNewZone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitNewZone(); }
                  }}
                  placeholder="Ej: Cocina, Baño principal, Salón..."
                  className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
                <button
                  onClick={commitNewZone}
                  disabled={!newZone.trim()}
                  className="px-3 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Plus size={14} /> Añadir
                </button>
              </div>
              {photo.zone && !zones.includes(photo.zone) && (
                <div className="text-xs text-emerald-700 mt-1.5">✓ Zona seleccionada: <strong>{photo.zone}</strong></div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4 relative">
        <div className="flex items-center justify-between mb-2 gap-2">
          <label className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Descripción del repaso</label>
          <button
            onClick={toggleDictation}
            className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors flex-shrink-0 ${isListening ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'}`}
            title={isListening ? 'Pulsa para detener el dictado' : 'Dictar la descripción por voz'}
          >
            {isListening ? (
              <>
                <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
                Detener
              </>
            ) : (
              <>
                <Mic size={12} /> Dictar
              </>
            )}
          </button>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => { saveDescription(); setTimeout(() => setShowSuggestions(false), 150); }}
          placeholder="Ej: Junta de silicona en mal estado en encuentro pared-bañera"
          rows={3}
          className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent resize-none"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-4 right-4 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-10 overflow-hidden">
            <div className="px-3 py-1.5 text-xs text-stone-500 bg-stone-50 border-b border-stone-100">Sugerencias del historial</div>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDescription(s.description);
                  updatePhoto(currentIndex, { description: s.description });
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 border-b border-stone-100 last:border-b-0"
              >
                <div className="text-stone-900">{s.description}</div>
                <div className="text-xs text-stone-400 mt-0.5">{s.gremio} · usado {s.count} {s.count === 1 ? 'vez' : 'veces'}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <AddMoreButton onAddMore={onAddMore} label="Añadir más fotos a esta obra" />
        <p className="text-xs text-stone-500 mt-2 text-center">Las nuevas fotos se añaden al final · no se pierde nada de lo que ya has hecho</p>
      </div>

      <div className="flex gap-2 pt-2 sticky bottom-4">
        <button
          onClick={prev}
          disabled={currentIndex === 0}
          className="flex items-center justify-center gap-1.5 px-4 py-3 bg-white border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <ChevronLeft size={16} /> Anterior
        </button>
        <button
          onClick={next}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-stone-900 text-white rounded-lg text-sm font-semibold hover:bg-stone-800 shadow-sm"
        >
          {currentIndex === photos.length - 1 ? 'Ver resumen' : 'Siguiente'}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function SummaryScreen({ photos, projectName, reviewDate, obraMeta, onEdit, onDelete, onAddMore, onGenerate, generating, libsReady, onBack, requestConfirm }) {
  const grouped = useMemo(() => {
    const g = {};
    const unclassified = [];
    photos.forEach((p, originalIndex) => {
      const item = { ...p, originalIndex };
      if (!p.gremio) unclassified.push(item);
      else {
        if (!g[p.gremio]) g[p.gremio] = [];
        g[p.gremio].push(item);
      }
    });
    Object.keys(g).forEach(k => {
      g[k].sort((a, b) => {
        if (a.isGeneral !== b.isGeneral) return a.isGeneral ? -1 : 1;
        return getPrio(a.priority).order - getPrio(b.priority).order;
      });
    });
    return { g, unclassified };
  }, [photos]);

  const totalClassified = Object.values(grouped.g).reduce((acc, arr) => acc + arr.length, 0);
  const totalGeneral = photos.filter(p => p.isGeneral && p.gremio).length;
  const dateFormat = new Date(reviewDate + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  const handleDelete = async (index) => {
    const ok = await requestConfirm({
      message: '¿Eliminar esta foto? No se incluirá en ningún PDF.',
      confirmLabel: 'Eliminar foto'
    });
    if (ok) onDelete(index);
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900">
        <ArrowLeft size={14} /> Volver a revisión
      </button>

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h1 className="text-2xl font-bold mb-1">Resumen de la obra</h1>
        <div className="text-sm text-stone-600">
          <div><strong>{projectName || 'Obra sin nombre'}</strong></div>
          <div>Revisión del {dateFormat}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-stone-100 rounded">{totalClassified} repasos</span>
            <span className="px-2 py-1 bg-stone-100 rounded">{Object.keys(grouped.g).length} gremios</span>
            {totalGeneral > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-medium">{totalGeneral} general{totalGeneral > 1 ? 'es' : ''}</span>
            )}
            {grouped.unclassified.length > 0 && (
              <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">{grouped.unclassified.length} sin clasificar</span>
            )}
            {obraMeta?.exportCount > 0 && (
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                Exportado {obraMeta.exportCount}× · último: {relativeTime(obraMeta.lastExported)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <AddMoreButton onAddMore={onAddMore} label="Añadir más fotos a esta obra" />
      </div>

      {grouped.unclassified.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm mb-2">
            <AlertCircle size={16} /> Fotos sin gremio asignado
          </div>
          <p className="text-xs text-amber-800 mb-3">Estas fotos no se incluirán en ningún PDF. Edítalas para asignarles un gremio o descártalas con la X.</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {grouped.unclassified.map(item => (
              <div key={item.id} className="relative aspect-square rounded-md overflow-hidden border-2 border-amber-300 hover:border-amber-500">
                <button
                  onClick={() => onEdit(item.originalIndex)}
                  className="w-full h-full block"
                >
                  <img src={item.dataUrl} alt="" className="w-full h-full object-cover" />
                </button>
                <button
                  onClick={() => handleDelete(item.originalIndex)}
                  className="absolute top-1 right-1 p-1 bg-white/90 hover:bg-red-600 hover:text-white text-stone-700 rounded shadow-sm transition-colors"
                  title="Descartar foto"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {Object.keys(grouped.g).sort().map(gremio => (
          <div key={gremio} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold text-sm">{gremio}</div>
                <div className="text-xs text-stone-500">{grouped.g[gremio].length} {grouped.g[gremio].length === 1 ? 'repaso' : 'repasos'}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {grouped.g[gremio].some(i => i.isGeneral) && (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 font-medium">
                    {grouped.g[gremio].filter(i => i.isGeneral).length} general{grouped.g[gremio].filter(i => i.isGeneral).length > 1 ? 'es' : ''}
                  </span>
                )}
                {PRIORITIES.map(pr => {
                  const c = grouped.g[gremio].filter(i => i.priority === pr.id).length;
                  if (!c) return null;
                  return (
                    <span key={pr.id} className={`text-xs px-2 py-0.5 rounded-full border ${pr.soft}`}>
                      {c} {pr.label.toLowerCase()}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="divide-y divide-stone-100">
              {grouped.g[gremio].map((item, idx) => {
                const pr = getPrio(item.priority);
                const Icon = pr.icon;
                return (
                  <div key={item.id} className={`p-3 flex gap-3 items-start hover:bg-stone-50 ${item.isGeneral ? 'border-l-4 border-red-500' : ''}`}>
                    <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-stone-100 border border-stone-200">
                      <img src={item.dataUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-xs text-stone-400 font-mono">#{idx + 1}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${pr.soft}`}>
                          <Icon size={10} /> {pr.label}
                        </span>
                        {item.isGeneral ? (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border bg-red-600 text-white border-red-600 font-bold">
                            <Megaphone size={10} /> GENERAL
                          </span>
                        ) : item.zone ? (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border bg-stone-100 text-stone-700 border-stone-200">
                            <MapPin size={10} /> {item.zone}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-stone-700 line-clamp-2">{item.description?.trim() || <span className="text-stone-400 italic">(Sin descripción)</span>}</p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col gap-1">
                      <button
                        onClick={() => onEdit(item.originalIndex)}
                        className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.originalIndex)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Eliminar foto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {totalClassified > 0 ? (
        <div className="sticky bottom-4 bg-white rounded-xl border border-stone-200 p-4 shadow-lg">
          <button
            onClick={onGenerate}
            disabled={!libsReady || generating}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-stone-900 text-white rounded-lg text-sm font-semibold hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <><Loader2 size={16} className="animate-spin" /> Generando PDFs...</>
            ) : !libsReady ? (
              <><Loader2 size={16} className="animate-spin" /> Cargando librerías PDF...</>
            ) : (
              <><FileDown size={16} /> {obraMeta?.exportCount > 0 ? 'Re-exportar PDFs por gremio (ZIP)' : 'Generar PDFs por gremio (ZIP)'}</>
            )}
          </button>
          <p className="text-xs text-stone-500 text-center mt-2">
            Puedes exportar tantas veces como quieras · cada vez se descarga un ZIP nuevo con todos los PDFs actualizados.
          </p>
        </div>
      ) : (
        <div className="bg-stone-100 rounded-xl p-6 text-center text-sm text-stone-600">
          Aún no hay repasos clasificados. Asigna un gremio a las fotos para poder generar los PDFs.
        </div>
      )}
    </div>
  );
}

function AnnotationEditor({ photo, onSave, onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const currentStrokeRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [strokes, setStrokes] = useState(photo.annotations || []);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#dc2626');
  const [width, setWidth] = useState(8);
  const [imgLoaded, setImgLoaded] = useState(false);

  const baseImageSrc = photo.originalDataUrl || photo.dataUrl;

  useEffect(() => {
    setImgLoaded(false);
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = baseImageSrc;
    return () => { cancelled = true; };
  }, [baseImageSrc]);

  useEffect(() => {
    if (!imgLoaded) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const fit = () => {
      if (!canvas || !canvas.parentElement) return;
      const parent = canvas.parentElement;
      const cs = window.getComputedStyle(parent);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const cw = parent.clientWidth - padX;
      const ch = parent.clientHeight - padY;
      if (cw <= 0 || ch <= 0) return;
      const ratio = canvas.width / canvas.height;
      const cratio = cw / ch;
      let dw, dh;
      if (ratio > cratio) {
        dw = cw;
        dh = cw / ratio;
      } else {
        dh = ch;
        dw = ch * ratio;
      }
      canvas.style.width = `${dw}px`;
      canvas.style.height = `${dh}px`;
    };
    const raf = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, [imgLoaded]);

  const drawShape = (ctx, stroke) => {
    if (!stroke) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const type = stroke.type || 'pencil';
    if (type === 'pencil') {
      if (!stroke.points || stroke.points.length < 1) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      if (stroke.points.length === 1) {
        ctx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y + 0.1);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
      }
      ctx.stroke();
    } else if (type === 'arrow') {
      const { start, end } = stroke;
      if (!start || !end) return;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return;
      const angle = Math.atan2(dy, dx);
      const headLen = Math.max(18, stroke.width * 4);
      const headAngle = Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle - headAngle), end.y - headLen * Math.sin(angle - headAngle));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle + headAngle), end.y - headLen * Math.sin(angle + headAngle));
      ctx.stroke();
    } else if (type === 'circle') {
      const { start, end } = stroke;
      if (!start || !end) return;
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      if (rx < 2 && ry < 2) return;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0);
    strokes.forEach(s => drawShape(ctx, s));
    if (currentStrokeRef.current) drawShape(ctx, currentStrokeRef.current);
  };

  useEffect(() => {
    if (imgLoaded) redrawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded, strokes]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    try { e.target.setPointerCapture?.(e.pointerId); } catch {}
    const coords = getCanvasCoords(e);
    if (tool === 'pencil') {
      currentStrokeRef.current = { type: 'pencil', color, width, points: [coords] };
    } else {
      currentStrokeRef.current = { type: tool, color, width, start: coords, end: coords };
    }
    isDrawingRef.current = true;
    redrawAll();
  };

  const onPointerMove = (e) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    const stroke = currentStrokeRef.current;
    if (stroke.type === 'pencil') {
      stroke.points.push(coords);
    } else {
      stroke.end = coords;
    }
    redrawAll();
  };

  const onPointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (!stroke) {
      redrawAll();
      return;
    }
    let valid = false;
    if (stroke.type === 'pencil') {
      valid = stroke.points && stroke.points.length > 0;
    } else if (stroke.type === 'arrow') {
      const dx = stroke.end.x - stroke.start.x;
      const dy = stroke.end.y - stroke.start.y;
      valid = Math.hypot(dx, dy) > 8;
    } else if (stroke.type === 'circle') {
      const rx = Math.abs(stroke.end.x - stroke.start.x);
      const ry = Math.abs(stroke.end.y - stroke.start.y);
      valid = rx > 8 || ry > 8;
    }
    if (valid) {
      setStrokes(prev => [...prev, stroke]);
    } else {
      redrawAll();
    }
  };

  const undo = () => setStrokes(prev => prev.slice(0, -1));
  const clearAll = () => setStrokes([]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onSave({
      dataUrl,
      annotations: strokes,
      originalDataUrl: photo.originalDataUrl || photo.dataUrl
    });
  };

  const TOOLS = [
    { id: 'pencil', icon: Pencil, label: 'Lápiz' },
    { id: 'arrow', icon: ArrowUpRight, label: 'Flecha' },
    { id: 'circle', icon: Circle, label: 'Círculo' }
  ];

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-stone-900 text-white px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded" title="Cancelar">
            <X size={18} />
          </button>
          <span className="text-sm font-medium hidden sm:inline">Marcar foto</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {TOOLS.map(t => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${active ? 'bg-white text-stone-900' : 'hover:bg-stone-800 text-white'}`}
                  title={t.label}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
          <div className="w-px h-6 bg-stone-700 mx-1" />
          <div className="flex gap-1">
            {['#dc2626', '#f59e0b', '#10b981', '#ffffff'].map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-stone-600'}`}
                style={{ backgroundColor: c }}
                title={`Color ${c}`}
              />
            ))}
          </div>
          <div className="w-px h-6 bg-stone-700 mx-1" />
          <div className="flex gap-1">
            {[4, 8, 16].map(w => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                className={`w-9 h-9 flex items-center justify-center rounded ${width === w ? 'bg-stone-700' : 'hover:bg-stone-800'}`}
                title={`Grosor ${w}`}
              >
                <div className="rounded-full bg-white" style={{ width: Math.max(4, w/2), height: Math.max(4, w/2) }} />
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-stone-700 mx-1" />
          <button onClick={undo} disabled={strokes.length === 0} className="p-2 hover:bg-stone-800 rounded disabled:opacity-30 disabled:cursor-not-allowed" title="Deshacer último trazo">
            <Undo2 size={18} />
          </button>
          <button onClick={clearAll} disabled={strokes.length === 0} className="p-2 hover:bg-stone-800 rounded disabled:opacity-30 disabled:cursor-not-allowed" title="Borrar todas las marcas">
            <Trash2 size={18} />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 rounded text-sm">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded text-sm font-semibold flex items-center gap-1">
            <Check size={14} /> Guardar
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-4">
        {!imgLoaded ? (
          <Loader2 size={28} className="animate-spin text-white" />
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="max-w-full max-h-full touch-none cursor-crosshair shadow-2xl"
            style={{ objectFit: 'contain' }}
          />
        )}
      </div>

      <div className="bg-stone-900 text-white text-xs text-center py-1.5 px-3 border-t border-stone-800">
        {tool === 'pencil' && 'Dibuja libremente sobre la foto'}
        {tool === 'arrow' && 'Mantén pulsado y arrastra para trazar la flecha'}
        {tool === 'circle' && 'Mantén pulsado y arrastra para trazar el círculo'}
        {' · '}
        {strokes.length === 0 ? 'sin marcas' : `${strokes.length} ${strokes.length === 1 ? 'marca' : 'marcas'}`}
      </div>
    </div>
  );
}

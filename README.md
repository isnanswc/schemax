# 📖 Schemax - Story & Lore Studio

> **Local-First Story Management & Worldbuilding Suite** dioptimalkan dengan tampilan **Mobile-First**, berbasis **Client-Side**, **IndexedDB (Blob Media Storage)**, dan **Rich Text Editor**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-emerald.svg)
![Platform](https://img.shields.io/badge/platform-web%20%7C%20mobile-amber.svg)

---

## ✨ Fitur Utama

- 📱 **Mobile-First UI & Thumb-Friendly Navigation**: Didesain khusus agar nyaman diakses lewat smartphone maupun desktop, lengkap dengan *Bottom Navigation Bar* dan *Floating Action Button (FAB)*.
- 📑 **Sheet Kategori Draft & Released**: Pemisahan karya draf dan karya yang siap rilis dengan penghitung jumlah karya secara instan.
- ✍️ **Distraction-Free Rich Text Editor**: Editor naskah lengkap (Bold, Italic, Underline, H2/H3, Kutipan/Monolog, Poin, Angka, Pembagi Adegan `***`, Undo/Redo) dengan penyimpanan otomatis (*auto-save debounced*) langsung ke **IndexedDB**.
- 🧭 **World Building Studio**: Manajemen ensiklopedia dunia terbagi dalam 4 kategori (Karakter, Lokasi/Latar, Item/Relik, dan Lore/Faksi) lengkap dengan atribut kustom dinamis.
- 🖼️ **Manajemen Gambar Lokal (IndexedDB Blob)**: Menyimpan foto visual sampul buku, potret karakter, dan galeri konsep langsung di browser tanpa batas server eksternal, dilengkapi penampil *lightbox*.
- ☁️ **Arsitektur Cloud-Ready (Local-First)**: Berfungsi 100% offline, dengan skema ID unik berbasis *timestamp* yang siap dihubungkan ke backend cloud (Supabase, Firebase, CouchDB, atau Google Drive).
- 💾 **Cadangkan & Pulihkan**: Ekspor seluruh basis data cerita ke file JSON cadangan lokal kapan saja.

---

## 🚀 Cara Menjalankan

Aplikasi ini dapat dijalankan secara instan tanpa perlu kompilasi:

1. Letakkan folder di web server lokal (seperti XAMPP `htdocs` atau Nginx).
2. Akses melalui browser di:
   ```
   http://localhost:8080/schemax/
   ```
   *atau buka langsung file `index.html` di peramban web.*

---

## 🛠️ Tumpukan Teknologi

- **Frontend Core**: Vanilla JS ES6+ / React 18 & TypeScript (Modular source under `src/`)
- **Database Klien**: IndexedDB API (`SchemaxStoryStudioDB`) dengan penyimpanan native `Blob` untuk media gambar
- **Styling**: Tailwind CSS dengan palet tema gelap modern (*Midnight Slate & Amber*)
- **Tipografi**: Google Fonts (*Plus Jakarta Sans* untuk UI & *Lora Serif* untuk naskah cerita)

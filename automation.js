// ==============================
// PAIRING ENGINE FINAL STABLE
// ==============================

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const fs = require('fs');
const path = require('path');

const adbPath = '"C:\\LDPlayer\\LDPlayer9\\adb.exe"';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let botStatus = false;

// ==============================
// SISTEM MEMORI DUPLICATE (JSON)
// ==============================
const historyPath = path.join(__dirname, 'history_customer.json');

function loadHistory() {
    if (fs.existsSync(historyPath)) {
        const data = fs.readFileSync(historyPath, 'utf8');
        return JSON.parse(data);
    }
    return {};
}

function saveHistory(data) {
    fs.writeFileSync(historyPath, JSON.stringify(data, null, 2));
}

// TRACK DUPLICATE CUSTOMER (Sekarang ngambil dari JSON)
let historyCustomerTerpilih = loadHistory();

function setBotStatus(status) {
    botStatus = status;
}

function getBotStatus() {
    return botStatus;
}

async function runAdb(command) {

    try {

        const fullCommand = command.startsWith('connect')
            ? `${adbPath} ${command}`
            : `${adbPath} -s 127.0.0.1:5555 ${command}`;

        const { stdout } = await execPromise(fullCommand);

        return stdout ? stdout.trim() : '';

    } catch (error) {

        return null;
    }
}

// ==============================
// GET UI XML (ANTI STALE CACHE)
// ==============================
async function getUIXML() {

    await runAdb('shell rm /data/local/tmp/uidump.xml');

    await delay(300);

    await runAdb('shell uiautomator dump /data/local/tmp/uidump.xml');

    await delay(1000);

    return await runAdb('shell cat /data/local/tmp/uidump.xml');
}

// ==============================
// CARI KOORDINAT TEXT
// ==============================
async function cariKoordinatTeks(targetText, xmlInput = null) {

    const xml = xmlInput || await getUIXML();

    if (!xml) return null;

    const escapedText = targetText.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
    );

    const regex = new RegExp(
        `(?:text|content-desc)="[^"]*${escapedText}[^"]*".*?bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
        'i'
    );

    const match = regex.exec(xml);

    if (match) {

        const x1 = parseInt(match[1]);
        const y1 = parseInt(match[2]);
        const x2 = parseInt(match[3]);
        const y2 = parseInt(match[4]);

        return {
            x: Math.floor((x1 + x2) / 2),
            y: Math.floor((y1 + y2) / 2)
        };
    }

    return null;
}

// ==============================
// INPUT SN AWAL
// ==============================
async function prosesSatuSN(sn) {

    await runAdb('connect 127.0.0.1:5555');

    let xml = await getUIXML();

    let posInput =
        await cariKoordinatTeks("Scan RFID atau Barcode...", xml)
        || await cariKoordinatTeks("Scan", xml);

    if (!posInput) {

        return {
            sukses: false,
            pesan: "KOLOM INPUT GAK KETEMU"
        };
    }

    await runAdb(
        `shell input tap ${posInput.x} ${posInput.y}`
    );

    await delay(500);

    for (let i = 0; i < 5; i++) {

        await runAdb("shell input keyevent 67");
    }

    await runAdb(`shell input text '${sn}'`);

    await delay(1000);

    await runAdb(`shell input keyevent 66`);

    await delay(4000);

    let xmlHasil = await getUIXML();

    const txt = xmlHasil
        ? xmlHasil.toLowerCase()
        : "";

    if (
        txt.includes("not found")
        || txt.includes("tidak ditemukan")
        || txt.includes("gagal")
    ) {

        console.log(`❌ GAGAL! SN ${sn} tidak ditemukan di sistem.`);

        return {
            sukses: false,
            pesan: "TIDAK KETEMU"
        };
    }

    else if (txt.includes(sn.toLowerCase())) {

        return {
            sukses: true,
            pesan: "KETEMU & ADDED"
        };
    }

    else {

        return {
            sukses: false,
            pesan: "GAGAL / TIDAK MUNCUL"
        };
    }
}

// ==============================
// PAIRING ENGINE
// ==============================
async function prosesPairingAplikasi(dataList) {

    console.log(
        `\n🎮 Memulai Proses Pairing SN & Customer di Emulator untuk ${dataList.length} data...`
    );

    for (let i = 0; i < dataList.length; i++) {

        const cust = dataList[i];

        console.log(
            `\n[Pairing ${i + 1}/${dataList.length}] Menghubungkan SN: ${cust.sn} -> Cust: ${cust.nama}`
        );

        await runAdb('connect 127.0.0.1:5555');

        await delay(300);

        let xml = await getUIXML();

        // ==============================
        // DASHBOARD RECOVERY
        // ==============================
        if (
            xml &&
            (
                xml.includes("Terpasang di Pelanggan")
                || xml.includes("Tugas Kunjungan")
            )
        ) {

            console.log(
                "🔄 Deteksi Dashboard Utama. Masuk kembali..."
            );

            let posMenuUtama =
                await cariKoordinatTeks(
                    "Terpasang di Pelanggan",
                    xml
                );

            if (posMenuUtama) {

                await runAdb(
                    `shell input tap ${posMenuUtama.x} ${posMenuUtama.y}`
                );

                await delay(2500);

                xml = await getUIXML();
            }
        }

        // ==============================
        // INPUT SN
        // ==============================
        let posScan =
            await cariKoordinatTeks("Scan", xml)
            || await cariKoordinatTeks("RFID", xml);

        if (!posScan) {

            console.log(
                "❌ CRITICAL ERROR: Kolom Scan tidak ditemukan!"
            );

            process.exit(1);
        }

        await runAdb(
            `shell input tap ${posScan.x} ${posScan.y}`
        );

        await delay(400);

        for (let k = 0; k < 15; k++) {

            await runAdb("shell input keyevent 67");
        }

        await runAdb(`shell input text '${cust.sn}'`);

        await delay(400);

        await runAdb("shell input keyevent 66");

        await delay(1500);

        // ==============================
        // RADIO BUTTON SEMUA CUSTOMER
        // ==============================
        xml = await getUIXML();

        let posSemuaCustomer =
            await cariKoordinatTeks(
                "Semua Customer",
                xml
            );

        if (posSemuaCustomer) {

            await runAdb(
                `shell input tap ${posSemuaCustomer.x} ${posSemuaCustomer.y}`
            );

            await delay(600);
        }

        // ==============================
        // BERSIHKAN CUSTOMER LAMA
        // ==============================
        xml = await getUIXML();

        let posHapusNama =
            await cariKoordinatTeks("×", xml)
            || await cariKoordinatTeks("x", xml);

        if (posHapusNama) {

            console.log(
                "[Pairing] Membersihkan nama lama..."
            );

            await runAdb(
                `shell input tap ${posHapusNama.x} ${posHapusNama.y}`
            );

            await delay(1000);

            xml = await getUIXML();
        }

        // ==============================
        // DYNAMIC WAIT ENGINE
        // ==============================
        async function tungguElemenMuncul(keyword, maxWaitMs = 5000) {
            let elapsed = 0;
            const interval = 500; // Polling tiap 0.5 detik

            while (elapsed < maxWaitMs) {
                // Bersihin dump lama biar fresh
                await runAdb('shell rm /data/local/tmp/uidump.xml');
                let xml = await getUIXML();

                if (xml && xml.toLowerCase().includes(keyword.toLowerCase())) {
                    return true; // Elemen ketemu, langsung gas!
                }
                await delay(interval);
                elapsed += interval;
            }
            return false; // Timeout kalau kelamaan
        }

        // ==============================
        // SEARCH BOX
        // ==============================
        let posSearchBox =
            await cariKoordinatTeks(
                "Search Customer",
                xml
            );

        if (!posSearchBox) {

            posSearchBox = {
                x: 440,
                y: 236
            };
        }

        await runAdb(
            `shell input tap ${posSearchBox.x} ${posSearchBox.y}`
        );

        await delay(1200);

        // ==============================
        // KOORDINAT INPUT ORANYE
        // ==============================
        let koordinatKotakOranje = {
            x: posSearchBox.x,
            y: posSearchBox.y + 115
        };

        console.log(
            `[Pairing] Fokus ke textbox oranye internal...`
        );

        await runAdb(
            `shell input tap ${koordinatKotakOranje.x} ${koordinatKotakOranje.y}`
        );

        await delay(500);

        // ==============================
        // INPUT NAMA CUSTOMER
        // ==============================
        const namaTargetMurni =
            cust.nama.toString().trim();

        const namaTargetLower =
            namaTargetMurni.toLowerCase();

        console.log(
            `[Pairing] Mengetik customer: "${namaTargetMurni}"`
        );

        const namaKetikAdb =
            namaTargetMurni.replace(/\s+/g, '%s');

        await runAdb(
            `shell input text ${namaKetikAdb}`
        );

        // Tunggu Flutter render dropdown
        await delay(1000);

        // Refresh fokus dropdown
        await runAdb(
            `shell input tap ${koordinatKotakOranje.x} ${koordinatKotakOranje.y}`
        );

        await delay(500);

        // ==============================
        // SCAN DROPDOWN XML
        // ==============================
        let matches = [];

        for (let retry = 1; retry <= 3; retry++) {

            console.log(
                `[Pairing] Scan dropdown retry ke-${retry}...`
            );

            // Tunggu render XML Flutter
            await tungguElemenMuncul(namaTargetLower, 3000);

            let xmlScan = await getUIXML();

            // DEBUG XML
            fs.writeFileSync(
                path.join(
                    __dirname,
                    `debug_dropdown_retry${retry}.xml`
                ),
                xmlScan || ''
            );

            // RESET MATCH SETIAP RETRY
            matches = [];

            const regexNode = /<(?:node)[^>]*?(?:text|content-desc)="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/ig;

            let match;

            while ((match = regexNode.exec(xmlScan)) !== null) {

                const teks = (match[1] || "").trim();

                const x1 = parseInt(match[2]);
                const y1 = parseInt(match[3]);
                const x2 = parseInt(match[4]);
                const y2 = parseInt(match[5]);

                const xCenter = Math.floor((x1 + x2) / 2);
                const yCenter = Math.floor((y1 + y2) / 2);

                //console.log(`[DEBUG] ${teks} @ ${xCenter},${yCenter}`);

                // NORMALISASI
                const teksClean =
                    teks
                        .replace(/\s+/g, ' ')
                        .trim()
                        .toLowerCase();

                const targetClean =
                    namaTargetMurni
                        .replace(/\s+/g, ' ')
                        .trim()
                        .toLowerCase();

                const blacklist = [
                    'search customer',
                    'scan item',
                    'customer tujuan',
                    'semua customer',
                    'customer ditugaskan',
                    'konfirmasi',
                    'deliver'
                ];

                if (
                    blacklist.some(b => teksClean.includes(b))
                ) {
                    continue;
                }

                // FILTER CUSTOMER VALID
                if (
                    teksClean === targetClean &&
                    xCenter > 50 &&
                    yCenter > 150 &&
                    yCenter < 2200
                ) {

                    matches.push({
                        x: xCenter,
                        y: yCenter,
                        text: teks
                    });

                    console.log(`✅ MATCH CUSTOMER VALID: ${teks}`);
                }
            }

            // KALAU SUDAH KETEMU LANGSUNG STOP RETRY
            if (matches.length > 0) {

                console.log(
                    `✅ Dropdown ditemukan (${matches.length} hasil)`
                );

                break;
            }

            console.log(
                `⚠️ Retry ${retry} gagal, dropdown belum muncul...`
            );
        }


        // ==============================
        // VALIDASI
        // ==============================
        if (matches.length === 0) {

            console.log(
                `\n❌ CRITICAL ERROR DI DATA: "${namaTargetMurni}"`
            );

            console.log(
                `🚨 Dropdown customer tidak ditemukan!`
            );

            process.exit(1);
        }

        // ==============================
        // SORT DROPDOWN
        // ==============================
        matches.sort((a, b) => a.y - b.y);

        console.log(`\n📋 HASIL DROPDOWN:`);

        matches.forEach((m, idx) => {

            console.log(
                `   [${idx}] ${m.text} @ Y:${m.y}`
            );
        });

        if (!matches.length) {

            console.log(
                `❌ Tidak ada customer yang cocok!`
            );

            return false;
        }

        // ==============================
        // DUPLICATE CUSTOMER ENGINE
        // ==============================

        // TAMBAHKAN BARIS INI: Ambil urutan dari memory JSON
        let urutanPilihan = historyCustomerTerpilih[namaTargetLower] || 0;

        let koordinatPilihan = matches[0];

        console.log(`🎯 Ini adalah data duplikat ke-${urutanPilihan} (0 = pertama, 1 = kedua, dst)`);

        if (!koordinatPilihan || koordinatPilihan.x < 50 || koordinatPilihan.y < 150) {
            console.log(`❌ Koordinat customer invalid!`);
            return false;
        }

        const tapX = koordinatPilihan.x;

        // Base turun dari kotak search ke item 1 (kayak kode lo sebelumnya)
        const baseOffset = 90;

        // Jarak dari item 1 ke item 2 (asumsi sekitar 80-90 pixel, sesuaikan kalau meleset)
        const jarakAntarItem = 85;

        // Rumus sakti: Y search box + offset item pertama + (urutan duplikat * jarak antar item)
        const tapY = koordinatPilihan.y + baseOffset + (urutanPilihan * jarakAntarItem);

        console.log(`🖱️ Klik dropdown item di X:${tapX}, Y:${tapY}`);

        await runAdb(`shell input tap ${tapX} ${tapY}`);

        // refresh flutter state
        await delay(1200);

        // ==============================
        // VALIDASI CUSTOMER SUDAH TERPILIH
        // ==============================

        let validSelected = false;

        for (let retry = 1; retry <= 3; retry++) {

            console.log(
                `🔍 Validasi customer terpilih... (${retry}/3)`
            );

            xml = await getUIXML();

            const adaKonfirmasi =
                await cariKoordinatTeks(
                    "Konfirmasi Pengiriman",
                    xml
                );

            const namaSelected = xml
                ? xml.toLowerCase().includes(namaTargetLower)
                : false;

            // VALID kalau:
            // - tombol konfirmasi muncul
            // - nama customer muncul
            if (
                adaKonfirmasi &&
                namaSelected
            ) {

                validSelected = true;

                console.log(
                    `✅ Customer berhasil dipilih`
                );

                break;
            }

            await delay(1000);
        }

        if (!validSelected) {

            console.log(
                `❌ Customer gagal terpilih!`
            );

            continue;
        }

        // Simpan history duplicate
        historyCustomerTerpilih[namaTargetLower] =
            (historyCustomerTerpilih[namaTargetLower] || 0) + 1;

        // TAMBAHKAN BARIS INI: Biar memory tersimpan permanen ke file!
        saveHistory(historyCustomerTerpilih);

        await delay(1000);

        // ==============================
        // KONFIRMASI
        // ==============================
        xml = await getUIXML();

        let posKonfirmasi =
            await cariKoordinatTeks(
                "Konfirmasi Pengiriman",
                xml
            )
            || await cariKoordinatTeks(
                "Konfirmasi",
                xml
            );

        if (!posKonfirmasi) {

            console.log(
                `❌ Tombol Konfirmasi tidak ditemukan!`
            );

            process.exit(1);
        }

        console.log(
            `[Pairing] Klik tombol Konfirmasi...`
        );

        await runAdb(
            `shell input tap ${posKonfirmasi.x} ${posKonfirmasi.y}`
        );

        // Tunggu pinter: Langsung scan UI nyari popup Deliver
        await tungguElemenMuncul("deliver", 3000);

        // ==============================
        // DELIVER (IMPROVED ENGINE)
        // ==============================
        console.log(`[Pairing] Menunggu popup Deliver...`);

        let posDeliver = null;
        let isDeliverSuccess = false;

        for (let wait = 1; wait <= 4; wait++) {
            xml = await getUIXML();

            // Bypass cariKoordinatTeks bawaan untuk menghindari judul "Confirm Delivery?"
            // Kita parsing manual khusus untuk EXACT MATCH "Deliver"
            const regexNode = /<(?:node)[^>]*?(?:text|content-desc)="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/ig;
            let match;
            let foundNodes = [];

            while ((match = regexNode.exec(xml)) !== null) {
                const teks = (match[1] || "").trim().toLowerCase();

                // EXACT MATCH: Hanya ambil jika teksnya persis "deliver"
                if (teks === "deliver") {
                    const x1 = parseInt(match[2]);
                    const y1 = parseInt(match[3]);
                    const x2 = parseInt(match[4]);
                    const y2 = parseInt(match[5]);

                    foundNodes.push({
                        text: teks,
                        x: Math.floor((x1 + x2) / 2),
                        y: Math.floor((y1 + y2) / 2)
                    });
                }
            }

            // Jika ditemukan lebih dari satu "Deliver", pastikan ambil tombol (Y paling bawah)
            if (foundNodes.length > 0) {
                foundNodes.sort((a, b) => b.y - a.y);
                posDeliver = foundNodes[0];
                break;
            }

            await delay(1000);
        }

        if (posDeliver) {
            console.log(`[Pairing] Klik tombol biru Deliver di X:${posDeliver.x}, Y:${posDeliver.y}`);

            // Klik sedikit digeser ke tengah tombol jika perlu (meskipun center text di Flutter biasanya valid)
            await runAdb(`shell input tap ${posDeliver.x} ${posDeliver.y}`);

            // ==============================
            // VALIDASI KLIK SUKSES
            // ==============================
            console.log(`[Pairing] Memvalidasi apakah popup Confirm tertutup...`);
            for (let v = 0; v < 3; v++) {
                await delay(1500);
                let checkXml = await getUIXML();

                // Jika judul popup sudah tidak ada, berarti klik berhasil memicu aksi
                if (!checkXml.toLowerCase().includes("confirm delivery?")) {
                    isDeliverSuccess = true;
                    console.log(`✅ Deliver sukses dieksekusi!`);
                    break;
                } else {
                    console.log(`⚠️ Popup belum hilang, mengulang tap (Retry ${v + 1})...`);
                    await runAdb(`shell input tap ${posDeliver.x} ${posDeliver.y}`);
                }
            }
        } else {
            console.log(`⚠️ Tombol Deliver tidak terbaca XML. Menjalankan fallback koordinat...`);
            // Pastikan rasio Y logis untuk resolusi tinggi (contoh fallback: X=75%, Y=65%)
            await runAdb("shell input tap 475 610");
        }

        if (!isDeliverSuccess && posDeliver) {
            console.log(`❌ Gagal Deliver meskipun tombol ditemukan. Lanjut ke proses OK...`);
        }

        // ==============================
        // OK SUCCESS
        // ==============================
        console.log(
            `[Pairing] Menunggu popup OK...`
        );

        let posOk = null;

        for (let wait = 1; wait <= 3; wait++) {

            xml = await getUIXML();

            posOk =
                await cariKoordinatTeks("OK", xml)
                || await cariKoordinatTeks("Ok", xml);

            if (posOk) break;

            await delay(1000);
        }

        if (posOk) {

            console.log(
                `[Pairing] Klik OK via XML...`
            );

            await runAdb(
                `shell input tap ${posOk.x} ${posOk.y}`
            );
        }

        else {

            console.log(
                `⚠️ Popup OK fallback koordinat.`
            );

            await runAdb(
                "shell input tap 475 610"
            );

            await delay(500);

            await runAdb(
                "shell input tap 360 610"
            );
        }

        console.log(
            `✅ DATA KE-${i + 1} SELESAI!`
        );

        await delay(2000);
    }

    console.log(
        "\n🏁 SELURUH PROSES PAIRING SELESAI TOTAL!"
    );
}

module.exports = {
    prosesSatuSN,
    setBotStatus,
    getBotStatus,
    runAdb,
    prosesPairingAplikasi
};
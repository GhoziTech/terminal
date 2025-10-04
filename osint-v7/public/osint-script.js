// Firebase Imports
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Inisialisasi Firebase Global Variables (Required for Canvas Environment)
        // Mengambil Environment Variable dari Netlify (via globalThis / window)
        const firebaseConfig = (() => {
            try {
                const env = window.FIREBASE_CONFIG_JSON || globalThis.FIREBASE_CONFIG_JSON;
                return JSON.parse(env);
            } catch (e) {
                console.error("Gagal parsing FIREBASE_CONFIG_JSON:", e);
                return {};
            }
        })();


        const appId = window.APP_ID || globalThis.APP_ID || 'osint-v7';
        const initialAuthToken = window.INITIAL_AUTH_TOKEN || globalThis.INITIAL_AUTH_TOKEN || null;

        // --- Global State ---
        let db;
        let auth;
        let userId = 'USER_ID_BELUM_SIAP';
        let isPremium = false;
        let unsubscribePremiumStatus = () => { };

        // JANGAN LUPA GANTI INI DENGAN USER ID ANDA SENDIRI! (Ditemukan di header saat aplikasi dimuat)
        const ADMIN_USER_ID = "ADMIN_1234567890_TELEGRAM";

        // Helper untuk Path Firestore
        const getPremiumStatusPath = (uid) => doc(db, 'artifacts', appId, 'public', 'data', 'premium_status', uid);

        // --- Firebase & Auth Initialization (Dibuat Robust) ---
        async function initFirebase() {
            const authStatusLine = document.getElementById('authStatusLine');

            try {
                // Langsung inisiasi menggunakan konfigurasi dari lingkungan Canvas
                const app = initializeApp(firebaseConfig);
                auth = getAuth(app);
                db = getFirestore(app);

                authStatusLine.innerHTML = '[$ SYSTEM] <span class="text-yellow-500">Mengautentikasi...</span>';

                await setPersistence(auth, browserSessionPersistence);

                const initialAuthToken = typeof INITIAL_AUTH_TOKEN !== 'undefined' ? INITIAL_AUTH_TOKEN : null;

                let authSuccess = false;

                if (initialAuthToken) {
                    try {
                        await signInWithCustomToken(auth, initialAuthToken);
                        authSuccess = true;
                    } catch (e) {
                        console.warn("[$ AUTH WARN] Custom Token gagal. Mencoba Anonymous:", e.code);
                    }
                }

                if (!authSuccess) {
                    await signInAnonymously(auth);
                }

                // Get unique user ID
                userId = auth.currentUser?.uid || crypto.randomUUID();
                document.getElementById('displayUserId').textContent = userId;

                authStatusLine.innerHTML = '[$ SYSTEM] <span class="text-cyan-500">Otentikasi OK. ID dimuat.</span>';
                console.log("Firebase Auth OK. User ID Anda:", userId);

                // Initialize Firestore Listener
                setupPremiumStatusListener();

                // Check if current user is admin and show the panel
                if (userId === ADMIN_USER_ID) {
                    document.getElementById('adminPanel').classList.remove('hidden');
                    console.log("Mode Admin Aktif.");
                } else {
                    document.getElementById('adminPanel').classList.add('hidden');
                    console.log("Mode User Biasa Aktif.");
                }

            } catch (error) {
                // Penanganan Error Umum Inisiasi Firebase
                console.error("Firebase Auth/Init Error: Gagal menginisiasi Firebase:", error);
                authStatusLine.innerHTML = '[$ SYSTEM] <span class="text-red-500">AUTH FAILED: Sistem tidak dapat dimuat.</span>';

                let displayError = `Gagal memuat sistem autentikasi/database. (Kode: ${error.code || 'UNKNOWN'}).`;

                showMessageBox("[$ ERROR] Auth System Failed", displayError, false);
            }
        }

        // --- Firestore Premium Status Listener ---
        function setupPremiumStatusListener() {
            if (!db || userId === 'USER_ID_BELUM_SIAP') return;

            unsubscribePremiumStatus();

            unsubscribePremiumStatus = onSnapshot(getPremiumStatusPath(userId), (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    isPremium = data.isPremium === true;
                } else {
                    isPremium = false;
                }
                updatePremiumStatusUI();
            }, (error) => {
                console.error("Error listening to premium status:", error);
                isPremium = false;
                updatePremiumStatusUI();
            });
        }

        // --- Tone.js Setup for Sound Effects ---
        const soundToggle = document.getElementById('soundToggle');
        const soundIndicator = document.querySelector('.toggle-circle');
        let isSoundOn = soundToggle.checked;

        let synth = null;
        try {
            if (Tone) {
                // Mengurangi latency
                Tone.context.lookAhead = 0.05;
                synth = new Tone.MembraneSynth().toDestination();
                synth.volume.value = -10;
            }
        } catch (e) {
            console.warn("Tone.js failed to initialize:", e);
        }

        function playKeySound() {
            if (isSoundOn && synth) {
                synth.triggerAttackRelease("C3", "64n");
            }
        }

        function playSystemSound() {
            if (isSoundOn && synth) {
                synth.triggerAttackRelease("A4", "8n");
                synth.triggerAttackRelease("C5", "8n", "+0.1");
            }
        }

        // Toggle Sound Logic
        soundToggle.addEventListener('change', () => {
            isSoundOn = soundToggle.checked;
            soundIndicator.classList.toggle('translate-x-3');
            soundIndicator.classList.toggle('translate-x-0');
            document.getElementById('soundIndicator').classList.toggle('bg-green-500');
            document.getElementById('soundIndicator').classList.toggle('bg-gray-500');
            if (isSoundOn) {
                if (Tone && Tone.context.state !== 'running') {
                    Tone.start().then(() => playSystemSound());
                } else {
                    playSystemSound();
                }
            }
        });

        // --- Message Box Handlers (Custom implementation) ---
        const messageBox = document.getElementById('messageBox');
        const messageTitle = document.getElementById('messageTitle');
        const messageText = document.getElementById('messageText');
        const messageActions = document.getElementById('messageActions');
        const closeMessageBox = document.getElementById('closeMessageBox');

        closeMessageBox.addEventListener('click', () => {
            messageBox.classList.add('hidden');
        });

        function showMessageBox(title, htmlContent, isSuccess = false, actions = []) {
            messageTitle.textContent = title;
            messageText.innerHTML = htmlContent;

            messageActions.innerHTML = '';
            messageActions.appendChild(closeMessageBox);
            actions.forEach(action => messageActions.appendChild(action));

            messageBox.classList.remove('hidden');

            const boxDiv = messageBox.querySelector('div');
            if (isSuccess) {
                boxDiv.classList.remove('border-red-500');
                boxDiv.classList.add('border-green-500');
                messageTitle.classList.remove('text-red-500');
                messageTitle.classList.add('text-neon');
                playSystemSound();
            } else {
                boxDiv.classList.remove('border-green-500');
                boxDiv.classList.add('border-red-500');
                messageTitle.classList.remove('text-neon');
                messageTitle.classList.add('text-red-500');
            }
        }

        // --- UI Updates for Premium Status ---
        const premiumBadge = document.getElementById('premiumBadge');
        const premiumButton = document.getElementById('premiumButton');
        const premiumSection = document.getElementById('premiumSection');
        const currentStatusText = document.getElementById('currentStatusText');

        function updatePremiumStatusUI() {
            if (isPremium) {
                premiumBadge.classList.remove('hidden');
                premiumButton.textContent = '[$ STATUS] ALPHA-7 AKTIF';
                premiumButton.classList.remove('bg-red-700', 'hover:bg-red-500', 'shadow-red-700/50');
                premiumButton.classList.add('bg-green-600', 'hover:bg-green-400', 'shadow-green-600/50');
                premiumButton.disabled = true;
                premiumSection.classList.remove('border-green-900', 'shadow-green-900/50');
                premiumSection.classList.add('border-yellow-600', 'shadow-yellow-600/50');
                currentStatusText.textContent = 'AKTIF (Member Premium)';
                currentStatusText.classList.remove('text-red-500');
                currentStatusText.classList.add('text-green-500');
            } else {
                premiumBadge.classList.add('hidden');
                premiumButton.textContent = 'AKTIFKAN ALPHA-7 (QRIS & Admin Confirm)';
                premiumButton.classList.add('bg-red-700', 'hover:bg-red-500', 'shadow-red-700/50');
                premiumButton.classList.remove('bg-green-600', 'hover:bg-green-400', 'shadow-green-600/50');
                premiumButton.disabled = false;
                premiumSection.classList.add('border-green-900', 'shadow-green-900/50');
                premiumSection.classList.remove('border-yellow-600', 'shadow-yellow-600/50');
                currentStatusText.textContent = 'NON-AKTIF (Member Biasa)';
                currentStatusText.classList.add('text-red-500');
                currentStatusText.classList.remove('text-green-500');
            }
        }

        // --- Core Logic (Typing & Data) ---
        const outputDiv = document.getElementById('terminalOutput');
        const searchButton = document.getElementById('searchButton');
        const targetInput = document.getElementById('targetInput');
        const errorMessage = document.getElementById('error-message');

        function typeLine(text, delay = 50) {
            return new Promise(resolve => {
                const line = document.createElement('p');
                outputDiv.appendChild(line);

                let i = 0;
                const cursor = document.createElement('span');
                cursor.className = 'typing-cursor';
                line.appendChild(cursor);

                const interval = setInterval(() => {
                    if (i < text.length) {
                        const char = text.charAt(i);
                        line.insertBefore(document.createTextNode(char), cursor);
                        playKeySound();
                        i++;
                        outputDiv.scrollTop = outputDiv.scrollHeight;
                    } else {
                        clearInterval(interval);
                        line.removeChild(cursor);
                        resolve();
                    }
                }, delay);
            });
        }

        // --- Dynamic Data Generator (DIPERBARUI AGAR LEBIH REALISTIS) ---
        function generateFictionalData(inputQuery, searchType) {
            // Simple hash based on input and time for variable results
            const timeSeed = new Date().getMinutes() + new Date().getSeconds();
            const inputSeed = inputQuery.length + inputQuery.charCodeAt(0) * 10;
            const hash = (inputSeed * timeSeed) % 1000;

            // Normalisasi Kueri untuk Personalization
            const normalizedQuery = inputQuery.replace(/[^a-zA-Z0-9\s]/g, '').trim();
            const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
            const queryPart = queryWords[0] || 'Anonim';
            const queryHash = normalizedQuery.length;

            // Elemen Realistis Indonesia
            const provinces = ['DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Timur', 'Sumatera Utara'];
            const cities = {
                'DKI Jakarta': ['Jakarta Selatan', 'Jakarta Timur', 'Jakarta Barat'],
                'Jawa Barat': ['Bandung', 'Bekasi', 'Depok'],
                'Banten': ['Tangerang', 'Serang'],
                'Jawa Timur': ['Surabaya', 'Malang'],
                'Sumatera Utara': ['Medan']
            };

            const province = provinces[hash % provinces.length];
            const cityList = cities[province] || [province];
            const city = cityList[hash % cityList.length];

            const streetType = ['Jalan Raya', 'Gang', 'Komplek', 'Perumahan'][hash % 4];
            const streetSuffix = ['Indah', 'Permai', 'Mawar', 'Seroja', 'Kencana'][hash % 5];
            const streetName = `${streetType} ${queryPart} ${streetSuffix}`;

            // Derived Data
            const basePhonePrefix = (searchType === 'nomor_hp') ? inputQuery.slice(0, 6) : `+62 81${hash % 9}x`;
            const basePhone = `${basePhonePrefix}-${(1000 + hash).toString().padStart(4, '0')}-xxxx`;

            // NIK Pattern (Fiksional tapi mengikuti format region: 32 = Jabar, 31 = Jakarta, 36 = Banten)
            const nikPrefixMap = { 'Jawa Barat': '32', 'DKI Jakarta': '31', 'Banten': '36', 'Jawa Timur': '35', 'Sumatera Utara': '12' };
            const nikPrefix = nikPrefixMap[province] || '33'; // Default Jawa Tengah
            const baseNIK = `${nikPrefix}0${hash % 9}${hash % 10}**${(hash * 37) % 10000}00${(hash % 10)}`;

            const nickname = (searchType === 'nama' || searchType === 'email')
                ? `${queryPart.substring(0, 1).toUpperCase()}${queryPart.substring(1).toLowerCase()}***`
                : `Anonim ${String(hash).slice(-3)}`;

            const domain = ['gmail.com', 'yahoo.co.id', 'outlook.com', 'mail.osint'][hash % 4];
            const email = (searchType === 'email') ? inputQuery : `${queryPart.toLowerCase()}${hash % 10}${hash % 100}@${domain}`;

            return {
                fullName: (searchType === 'nama') ? `${queryPart} ${['Putra', 'Wijaya', 'Santoso', 'Hadi', 'Nugraha'][hash % 5]} ${String.fromCharCode(65 + (hash % 26))}**` : `${queryPart} ${['Purnama', 'Sutrisno'][hash % 2]}`,
                nickname: nickname,
                nik: baseNIK.replace(/(\*)/g, 'X'),
                kk: baseNIK.replace(/(\*)/g, 'Y'),
                plate: `B ${1000 + hash} ${String.fromCharCode(65 + (hash % 26))}${(hash % 10)} ${hash % 100}**`,
                phone: basePhone.replace(/(\*)/g, 'X'),
                // Alamat dibuat sangat detail dan realistis
                address: `${streetName} No. ${hash % 10}, RT 0${hash % 9 + 1}/ RW 0${hash % 5 + 1}, Kel. S***** J***, Kec. C**** P****, ${city}, ${province}`,
                realtimeLocation: `Lokasi Terakhir Dideteksi: ${streetName}, ${city} (${hash % 3 + 1} Jam Lalu)`,
                device: `ANDROID ${12 + (hash % 4)} (Samsung Galaxy S2${(hash % 5) + 0}) / IOS 1${5 + (hash % 3)}.X (iPhone 1${(hash % 5) + 0} Pro)`,
                education: [`Universitas G*** M*** (S1, 20XX)`, `SMAN ${10 + hash % 10} ${city}`],
                family: [`Istri/Pasangan: N** ** (No. HP: ${basePhone.replace('x', '*')})`, `Orang Tua: B*** S*** (NIK: ${baseNIK.slice(0, 8)}********)`],
                photoLink: `https://placehold.co/100x150/ff0000/ffffff?text=FOTO_CENSORED_${queryPart}`,
                hangout: [`Pusat Perbelanjaan ${city} (4 Hari Lalu)`, `Kedai Kopi ${queryPart} (1 Hari Lalu)`],
                officeName: `PT. ${queryPart.toUpperCase()} Digitalindo`,
                officeAddress: `Gedung ${['Astra', 'Equity', 'Cyber'][hash % 3]} Tower Lantai 1${hash % 10}, ${streetName}, ${city}, ${province}`,
                socmed: [`https://www.instagram.com/${queryPart.toLowerCase()}_***`, `https://www.facebook.com/${queryPart.toLowerCase()}***`, `https://t.me/${queryPart.toLowerCase()}_osint`],
                email: email
            };
        }

        async function generateFakeResult(inputQuery) {
            // Perbedaan Performa
            const initialDelayMins = isPremium ? 3.5 : 15.3;
            const loopCount = isPremium ? 1 : 3;
            const delayMs = isPremium ? 500 : 1000;
            const speedText = isPremium ? "DIPERCEPAT (1-5m)" : "NORMAL (10-30m)";

            const searchType = document.getElementById('searchType').value;
            const data = generateFictionalData(inputQuery, searchType);

            await typeLine(`[$ PROTOCOL] Mengautentikasi kunci akses level 7...`, 20);
            await typeLine(`[$ PROTOCOL] Kueri: ${inputQuery} | Tipe: ${searchType.toUpperCase()}`, 20);
            await typeLine(`[$ PROTOCOL] Menginisiasi modul Dox-Kernel 7.1.x`, 20);
            await typeLine(`[$ PROCESS] Estimasi Waktu Proses: ${initialDelayMins} menit | Mode: ${speedText}.`, 5);

            for (let i = 1; i <= loopCount; i++) {
                await typeLine(`[$ PROCESS] Status: Menganalisis Layer Data ${i}/7...`, 5);
                await new Promise(r => setTimeout(r, delayMs));
            }

            // --- FEATURE DIFFERENTIATION (PENGURANGAN CENSORING UNTUK PREMIUM) ---
            // Member Biasa: Sensor Penuh
            const plateCensored = data.plate.replace(/([A-Z] \d{4} [A-Z]{2}) \/ ([A-Z]{2} \d{4})/, '$1 / ** ******');
            const officeAddressCensored = 'Lokasi Office: ***** [Layer 6 Restricted]';
            const phoneCensored = data.phone.replace(/(\d{4}-)/, '****-');

            // Member Premium: Sensor dikurangi (Layer 6 Access)
            const plateDisplay = isPremium ? `${data.plate} <span class="text-cyan-400">[PRIORITY DETAIL]</span>` : plateCensored;
            const officeAddressDisplay = isPremium ? `Lokasi Office: ${data.officeAddress}` : officeAddressCensored;
            const phoneDisplay = isPremium ? data.phone : phoneCensored;
            // ----------------------------------------------------------------------


            await typeLine(`[$ RESULT] ** Data Ditemukan & Di-Dekripsi (Level 7) **`, 30);
            await typeLine(`--------------------------------------------------------------------------------`, 5);

            const lines = [
                `> Nama Lengkap: <span class="text-yellow-400">${data.fullName}</span>`,
                `> Nama Panggilan: ${data.nickname}`,
                `> NIK/KK Target: ${data.nik} / ${data.kk}`,
                `> Email Utama: ${data.email}`,
                `> Plat Kendaraan: ${plateDisplay}`,
                `> Telepon/WA: <span class="text-yellow-400">${phoneDisplay}</span>`,
                `> Alamat Domisili (Real Time): ${data.realtimeLocation}`,
                `> Domisili Terakhir: ${data.address}`,
                `> Info Perangkat: ${data.device}`,
                `> --- [INFORMASI SOSIAL MEDIA (COOKIES/LINK)] ---`,
                `> Instagram: <span class="censored">${data.socmed[0]}</span>`,
                `> Facebook: <span class="censored">${data.socmed[1]}</span>`,
                `> Telegram: <span class="censored">${data.socmed[2]}</span>`,
                `> --- [INFORMASI PRIBADI & PEKERJAAN] ---`,
                `> Data Keluarga: ${data.family.join(' | ')}`,
                `> Riwayat Pendidikan: ${data.education.join(' | ')}`,
                `> Jabatan/Pekerjaan: ${data.officeName} | ${officeAddressDisplay}`,
                `> Lokasi Kunjungan Terakhir (7 Hari): ${data.hangout.join(' | ')}`,
                `> Tautan Foto: <span class="censored">${data.photoLink}</span>`,
                `--------------------------------------------------------------------------------`,
                `[$ SUCCESS] ** Prosedur Data-Doxing Selesai. **`,
                `[$ SYSTEM] Siap menerima Kueri Baru.`
            ];

            for (const line of lines) {
                await typeLine(line, line.includes('SUCCESS') ? 100 : 15);
            }

            playSystemSound();
            searchButton.disabled = false;
        }

        // --- Event Handlers ---

        // Main Search Handler
        searchButton.addEventListener('click', async () => {
            const input = targetInput.value.trim();
            const searchType = document.getElementById('searchType').value;

            // Cek jika Firebase belum siap
            if (userId === 'USER_ID_BELUM_SIAP') {
                showMessageBox("[$ WARNING] Sistem Belum Siap", "Autentikasi Firebase belum selesai. Mohon tunggu sejenak hingga 'User ID' muncul.", false);
                return;
            }

            if (input === '') {
                errorMessage.classList.remove('hidden');
                outputDiv.scrollTop = outputDiv.scrollHeight;
                return;
            }
            errorMessage.classList.add('hidden');

            searchButton.disabled = true;
            outputDiv.innerHTML = '';
            outputDiv.appendChild(document.createElement('br'));

            await typeLine(`[$ RUN] Menginisiasi pencarian data...`, 15);
            await typeLine(`[$ TARGET] Kueri: ${input} (${searchType.toUpperCase()})`, 15);

            await generateFakeResult(input);
        });

        // Premium Button Handler (USER INSTRUCTION)
        premiumButton.addEventListener('click', () => {

            // HTML content for payment instructions
            const instructionsHtml = `
            <h4 class="text-lg font-bold text-neon mb-4">Langkah-Langkah Konfirmasi Pembayaran</h4>
            
            <p class="text-sm mb-4 text-left">
                1. Lakukan pembayaran **Rp 399.000** (+ Gratis 1 Bulan) melalui **QRIS** di bawah ini:
            </p>
            
            <div class="flex justify-center mb-4 p-2 bg-white rounded-md">
                <img src="qris.jpg" alt="QRIS Placeholder" class="w-48 h-48 border-2 border-green-500 rounded-md">
            </div>

            <p class="text-xs text-center text-gray-500 mb-4">
                (Gunakan aplikasi pembayaran Anda yang mendukung QRIS. Pastikan jumlahnya tepat.)
            </p>

            <p class="text-sm mb-2 text-left text-yellow-500">
                **LANGKAH KONFIRMASI WAJIB (Admin Verifikasi):**
            </p>
            <p class="text-sm mb-4 text-left">
                2. Setelah transfer, kirimkan **bukti pembayaran** (screenshot) dan **USER ID Anda** (tertera di bawah) ke kontak Admin kami melalui Telegram: 
                <a href="https://t.me/Youghoz" target="_blank" class="text-cyan-400 hover:text-cyan-200 font-bold">@Youghoz</a>
            </p>
            <p class="text-sm mb-2 text-left">
                3. User ID Anda (WAJIB disertakan):
            </p>
            <div class="user-id-display text-left">
                <span class="text-red-500 font-bold">${userId}</span>
            </div>
            <p class="text-xs mt-4 text-gray-500">
                Status Premium akan aktif setelah **Admin memverifikasi** pembayaran dan User ID Anda. Proses Verifikasi Admin: 1-5 Menit.
            </p>
        `;

            showMessageBox(
                "[[ ALPHA-7 PAYMENT VIA QRIS & TELEGRAM ]]",
                instructionsHtml,
                false
            );
        });

        // Admin Panel Logic (ADMIN ACTION)
        document.getElementById('activatePremiumButton').addEventListener('click', async () => {
            const targetUid = document.getElementById('targetUserIdInput').value.trim();
            const adminStatus = document.getElementById('adminStatus');
            adminStatus.classList.remove('hidden');
            adminStatus.textContent = 'Status: Memproses aktivasi Premium...';

            if (!targetUid) {
                adminStatus.textContent = '[$ ERROR] Target User ID tidak boleh kosong. Masukkan ID dari Telegram.';
                adminStatus.classList.remove('text-yellow-400');
                adminStatus.classList.add('text-red-500');
                return;
            }

            // Safety check agar tidak mengaktifkan admin ID itu sendiri
            if (targetUid === ADMIN_USER_ID) {
                adminStatus.textContent = '[$ ERROR] User ID Admin tidak perlu diaktifkan.';
                adminStatus.classList.remove('text-yellow-400');
                adminStatus.classList.add('text-red-500');
                return;
            }

            try {
                // Write premium status to Firestore
                await setDoc(getPremiumStatusPath(targetUid), {
                    isPremium: true,
                    activatedBy: userId, // Log which admin activated it
                    activationDate: new Date().toISOString()
                }, { merge: true });

                adminStatus.textContent = `[$ SUCCESS] User ID ${targetUid.substring(0, 10)}... telah diaktifkan! Status Premium diperbarui. Konfirmasi Selesai.`;
                adminStatus.classList.add('text-green-500');
                adminStatus.classList.remove('text-red-500', 'text-yellow-400');

            } catch (error) {
                console.error("ADMIN ERROR activating premium:", error);
                adminStatus.textContent = `[$ FATAL ERROR] Gagal menyimpan ke database. Cek konsol.`;
                adminStatus.classList.remove('text-yellow-400', 'text-green-500');
                adminStatus.classList.add('text-red-500');
            }
        });

        // --- Initialization on Load ---
        window.onload = () => {
            initFirebase();

            // Mengganti listener ini untuk mengatasi masalah Tone.js di sebagian besar browser
            document.body.addEventListener('click', () => {
                if (Tone && Tone.context.state !== 'running') {
                    Tone.start();
                }
            }, { once: true });

            // Initial setup for the sound toggle indicator
            if (isSoundOn) {
                soundIndicator.classList.add('translate-x-3');
                document.getElementById('soundIndicator').classList.add('bg-green-500');
            } else {
                soundIndicator.classList.add('translate-x-0');
                document.getElementById('soundIndicator').classList.add('bg-gray-500');
            }
        }
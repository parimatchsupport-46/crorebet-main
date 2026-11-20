/* ==========================================================
   CROREBET — Data Layer
   ----------------------------------------------------------
   Uses Firestore when Firebase is configured, otherwise falls
   back to localStorage. Exposes global helpers: crbAddComplaint,
   crbGetComplaints, crbGetStats, crbClearComplaints, etc.
   ========================================================== */
(function () {

    var LS_KEY = 'crorebet_complaints_v1';
    var COLLECTION = 'complaints';

    function fb() {
        return (window.crbFirebase && window.crbFirebase.enabled) ? window.crbFirebase : null;
    }

    window.crbMode = function () {
        return fb() ? 'firestore' : 'local';
    };

    window.crbModeReason = function () {
        return (window.crbFirebase && window.crbFirebase.reason) || 'none';
    };

    /* ======================================================
       LOCAL STORAGE (fallback)
       ====================================================== */
    function lsGet() {
        try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
        catch (e) { return []; }
    }

    function lsSave(list) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true; }
        catch (e) {
            alert('Storage is full. Please clear old complaints.');
            return false;
        }
    }

    /* ======================================================
       ADD COMPLAINT
       ====================================================== */
    window.crbAddComplaint = function (complaint, cb) {
        complaint.createdAt = complaint.createdAt || new Date().toISOString();
        complaint.status = complaint.status || 'new';

        /* ---------- FIRESTORE ---------- */
        if (fb()) {
            var payload = Object.assign({}, complaint);
            delete payload.id;

            /* Firestore timestamp (keeps ordering correct) */
            payload.createdAtServer = firebase.firestore.FieldValue.serverTimestamp();

            fb().db.collection(COLLECTION).add(payload)
                .then(function (ref) {
                    if (cb) cb({ ok: true, mode: 'firestore', id: ref.id });
                })
                .catch(function (err) {
                    console.error('Firestore add failed:', err);
                    /* fall back to local so the user doesn't lose the complaint */
                    var list = lsGet();
                    list.unshift(complaint);
                    lsSave(list);
                    if (cb) cb({ ok: true, mode: 'local-fallback', error: err.message });
                });
            return;
        }

        /* ---------- LOCAL ---------- */
        var list = lsGet();
        list.unshift(complaint);
        var ok = lsSave(list);
        if (cb) cb({ ok: ok, mode: 'local' });
    };

    /* ======================================================
       GET COMPLAINTS
       ====================================================== */
    window.crbGetComplaints = function (cb) {
        /* ---------- FIRESTORE ---------- */
        if (fb()) {
            fb().db.collection(COLLECTION).get()
                .then(function (snap) {
                    var items = [];
                    snap.forEach(function (doc) {
                        var d = doc.data() || {};
                        d.id = doc.id;

                        /* serverTimestamp -> ISO string */
                        if (d.createdAtServer && d.createdAtServer.toDate) {
                            d.createdAt = d.createdAtServer.toDate().toISOString();
                        }
                        if (!d.createdAt) d.createdAt = new Date().toISOString();

                        /* keep payload small in memory */
                        delete d.createdAtServer;

                        items.push(d);
                    });

                    /* newest first */
                    items.sort(function (a, b) {
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    });

                    if (cb) cb(items, 'firestore');
                })
                .catch(function (err) {
                    console.error('Firestore read failed:', err);
                    if (cb) cb(lsGet(), 'local-fallback', err.message);
                });
            return;
        }

        /* ---------- LOCAL ---------- */
        if (cb) cb(lsGet(), 'local');
    };

    /* ======================================================
       STATS
       ====================================================== */
    window.crbGetStats = function (cb) {
        window.crbGetComplaints(function (list, mode) {
            var todayCount = list.filter(function (c) {
                return window.crbIsToday(c.createdAt);
            }).length;

            if (cb) cb({ total: list.length, today: todayCount }, mode);
        });
    };

    /* ======================================================
       CLEAR / DELETE
       ====================================================== */
    window.crbClearComplaints = function (cb) {
        if (fb()) {
            fb().db.collection(COLLECTION).get().then(function (snap) {
                var batch = fb().db.batch();
                snap.forEach(function (doc) { batch.delete(doc.ref); });
                return batch.commit();
            }).then(function () {
                if (cb) cb({ ok: true, mode: 'firestore' });
            }).catch(function (err) {
                if (cb) cb({ ok: false, error: err.message });
            });
            return;
        }

        localStorage.removeItem(LS_KEY);
        if (cb) cb({ ok: true, mode: 'local' });
    };

    /* ======================================================
       DEMO DATA
       ====================================================== */
    window.crbAddDemoComplaints = function (cb) {
        var now = Date.now();
        var demo = [
            {
                ref: 'DP-261116-1042', type: 'Deposit',
                userName: 'Rahul Sharma', mobile: '9876543210',
                email: 'rahul.sharma@example.com', code: 'ABC12345',
                amount: '5000', problem: 'Pending', problemValue: 'pending',
                imageName: 'payment.jpg', imageThumb: null,
                createdAt: new Date(now - 1000 * 60 * 25).toISOString(), status: 'new'
            },
            {
                ref: 'WD-261116-2318', type: 'Withdrawal',
                userName: 'Priya Verma', mobile: '9812345678',
                email: 'priya.verma@example.com', code: 'WD9821',
                amount: '12000', problem: 'Processing', problemValue: 'processing',
                imageName: 'screenshot.png', imageThumb: null,
                createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(), status: 'new'
            },
            {
                ref: 'EV-261116-7734', type: 'Email Verification',
                userName: 'Amit Kumar', mobile: '9765432109',
                email: 'amit.k@example.com', code: 'EV4455',
                amount: '', problem: 'Email Verification', problemValue: 'email-verification',
                verifyEmail: 'amit.verify@example.com',
                imageName: 'mail.png', imageThumb: null,
                createdAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(), status: 'new'
            }
        ];

        if (fb()) {
            var done = 0;
            var total = demo.length;

            demo.forEach(function (d) {
                var payload = Object.assign({}, d);
                payload.createdAtServer = firebase.firestore.FieldValue.serverTimestamp();
                payload.createdAt = d.createdAt;

                fb().db.collection(COLLECTION).add(payload)
                    .catch(function (err) { console.error(err); })
                    .then(function () {
                        done++;
                        if (done === total && cb) cb({ ok: true, mode: 'firestore', count: total });
                    });
            });
            return;
        }

        var list = lsGet();
        demo.forEach(function (d) { list.push(d); });
        lsSave(list);
        if (cb) cb({ ok: true, mode: 'local', count: demo.length });
    };

    /* ======================================================
       HELPERS (unchanged API)
       ====================================================== */
    window.crbImageThumb = function (file, cb) {
        if (!file) return cb(null);
        try {
            var img = new Image();
            var url = URL.createObjectURL(file);

            img.onload = function () {
                var max = 480;
                var w = img.width, h = img.height;

                if (w > max || h > max) {
                    var ratio = Math.min(max / w, max / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }

                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);

                var data = null;
                try { data = canvas.toDataURL('image/jpeg', 0.72); }
                catch (e) { data = null; }

                URL.revokeObjectURL(url);
                cb(data);
            };

            img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
            img.src = url;
        } catch (e) { cb(null); }
    };

    window.crbFormatDate = function (iso) {
        var d = new Date(iso);
        if (isNaN(d)) return '—';
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var h = d.getHours();
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        var m = String(d.getMinutes()).padStart(2, '0');
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ', ' + h + ':' + m + ' ' + ampm;
    };

    window.crbIsToday = function (iso) {
        var d = new Date(iso);
        var n = new Date();
        return d.getFullYear() === n.getFullYear() &&
               d.getMonth() === n.getMonth() &&
               d.getDate() === n.getDate();
    };

    window.crbEscape = function (s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
})();

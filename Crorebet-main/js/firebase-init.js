/* ==========================================================
   FIREBASE INIT — SDK load + config check + init
   ----------------------------------------------------------
   Sets: window.crbFirebase = { enabled, db, auth, reason }
   If Firebase is missing or not configured, the app falls back
   to localStorage so the site keeps working.
   ========================================================== */
(function () {
    var cfg = window.FIREBASE_CONFIG || {};

    var filled =
        cfg.apiKey && cfg.apiKey.length > 15 &&
        cfg.projectId && cfg.projectId.length > 0 &&
        cfg.appId && cfg.appId.length > 5 &&
        cfg.apiKey.indexOf('PASTE') === -1;

    /* SDK script didn't load (offline / blocked) */
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
        window.crbFirebase = { enabled: false, reason: 'sdk' };
        return;
    }

    /* Config not pasted yet */
    if (!filled) {
        window.crbFirebase = { enabled: false, reason: 'config' };
        return;
    }

    try {
        if (!firebase.apps || !firebase.apps.length) {
            firebase.initializeApp(cfg);
        }

        var db = firebase.firestore();
        var auth = firebase.auth();

        try {
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (e) { /* ignore */ }

        window.crbFirebase = {
            enabled: true,
            db: db,
            auth: auth,
            reason: 'ok'
        };
    } catch (e) {
        window.crbFirebase = { enabled: false, reason: 'init', error: e.message };
    }
})();

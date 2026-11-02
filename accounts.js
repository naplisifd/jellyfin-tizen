(function () {
    'use strict';

    console.log('Accounts adapter');

    // jellyfin-web only remembers one token per server, so every signed in account is kept here
    // and copied into its credentials before the web app starts. Signing out would revoke the
    // token on the server, so switching never does that: it swaps the token and reloads.
    var VAULT_KEY = 'tizen_accounts';
    var CREDENTIALS_KEY = 'jellyfin_credentials';
    var AUTO_LOGIN_KEY = 'enableAutoLogin';

    // Survive reloads, but not an app restart, which has to pick an account again
    var UNLOCKED_KEY = 'tizen_accounts_unlocked';
    var PENDING_KEY = 'tizen_accounts_pending';

    var PIN_LENGTH = 4;
    var MAX_PIN_FAILURES = 5;
    var PIN_LOCKOUT_MS = 60 * 1000;
    var RELOCK_AFTER_HIDDEN_MS = 5 * 60 * 1000;

    var KEY_ENTER = 13;
    var KEY_BACK = 10009;
    var KEY_ESCAPE = 27;
    var KEY_BACKSPACE = 8;

    var ICON_LOCK = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6z"/></svg>';
    var ICON_PLUS = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
    var ICON_ACCOUNTS = '<svg viewBox="0 0 24 24" class="ja-header-icon"><path fill="currentColor" d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 2c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zM8 16v-1.5c0-1.99 4-3 6-3s6 1.01 6 3V16H8z"/></svg>';
    var ICON_BACKSPACE = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/></svg>';

    var STYLE = [
        '.ja-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999999;overflow-y:auto;background:#101010;color:#fff;text-align:center;font-family:"SamsungOne","Noto Sans",sans-serif;font-size:1.5vw}',
        '.ja-view{padding:6vh 5vw}',
        '.ja-title{margin:4vh 0 1vh;font-size:3vw;font-weight:400}',
        '.ja-message{min-height:3vh;margin:1vh 0 3vh;color:#bbb}',
        '.ja-error{color:#ff6b6b}',
        '.ja-card,.ja-button,.ja-key{border:0;margin:0;padding:0;color:inherit;font:inherit;background:none;outline:none;cursor:pointer}',
        '.ja-card{display:inline-block;width:13vw;margin:1.5vh 1vw;vertical-align:top;opacity:.75}',
        '.ja-card:focus{opacity:1}',
        '.ja-avatar{position:relative;display:block;width:10vw;height:10vw;margin:1vw auto;overflow:hidden;border-radius:50%;background:#333;font-size:4vw;line-height:10vw}',
        '.ja-card:focus .ja-avatar{-webkit-transform:scale(1.08);transform:scale(1.08);box-shadow:0 0 0 .35vw #00a4dc}',
        '.ja-avatar img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}',
        '.ja-avatar svg{width:50%;height:50%;margin-top:25%;display:block;margin-left:25%}',
        '.ja-badge{position:absolute;right:0;bottom:0;width:2.8vw;height:2.8vw;border-radius:50%;background:#00a4dc}',
        '.ja-corner{position:relative;display:block;width:10vw;margin:1vw auto}',
        '.ja-corner .ja-avatar{margin:0}',
        '.ja-badge svg{display:block;width:60%;height:60%;margin:20%}',
        '.ja-name{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
        '.ja-detail{display:block;min-height:1.4em;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:.8em;color:#999}',
        '.ja-button{display:inline-block;margin:1vh .5vw;padding:1vh 2vw;border-radius:.4vw;background:#2a2a2a}',
        '.ja-button:focus,.ja-key:focus{background:#00a4dc;color:#000}',
        '.ja-dots{margin:2vh 0}',
        '.ja-dot{display:inline-block;width:1.4vw;height:1.4vw;margin:0 .7vw;border:.15vw solid #888;border-radius:50%}',
        '.ja-dot-on{background:#fff;border-color:#fff}',
        '.ja-key{display:inline-block;width:7vw;height:5.5vw;margin:.5vw;border-radius:.4vw;background:#2a2a2a;font-size:2.2vw;line-height:5.5vw;vertical-align:top}',
        '.ja-key svg{display:block;width:2.4vw;height:2.4vw;margin:1.55vw auto}',
        '.ja-key-text{font-size:1.2vw}',
        '.ja-rows{display:inline-block;width:70vw;text-align:left}',
        '.ja-row{padding:1.5vh 1vw;border-bottom:.1vw solid #2a2a2a;overflow:hidden}',
        '.ja-row-label{float:left;width:30vw;padding-top:1.9vh}',
        '.ja-row-actions{float:right;text-align:right}',
        // The web app shows the user button once it knows who's signed in
        '.headerUserButton.hide+.headerAccountsButton{display:none}',
        '.ja-header-icon{display:block;width:1em;height:1em}'
    ].join('');

    var overlay = null;
    var previousFocus = null;
    var overlayFocus = null;
    var backHandler = null;
    var digitHandler = null;
    var webStarted = false;
    var mustChoose = false;
    var hiddenAt = null;

    function parse(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) || fallback;
        } catch (err) {
            console.error('Unable to read ' + key, err);
            return fallback;
        }
    }

    function loadVault() {
        var vault = parse(VAULT_KEY, {});
        vault.accounts = vault.accounts || [];
        return vault;
    }

    function saveVault(vault) {
        localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
    }

    function loadCredentials() {
        var credentials = parse(CREDENTIALS_KEY, {});
        credentials.Servers = credentials.Servers || [];
        return credentials;
    }

    function saveCredentials(credentials) {
        localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
    }

    function findAccount(vault, key) {
        return vault.accounts.filter(function (account) {
            return account.key === key;
        })[0];
    }

    function findServer(credentials, id) {
        return credentials.Servers.filter(function (server) {
            return server.Id === id;
        })[0];
    }

    function serverSnapshot(server) {
        var snapshot = JSON.parse(JSON.stringify(server));
        delete snapshot.AccessToken;
        delete snapshot.UserId;
        delete snapshot.ExchangeToken;
        return snapshot;
    }

    function serverAddress(server) {
        return server.ManualAddress || server.LocalAddress || server.RemoteAddress;
    }

    // Fetches the name and avatar, which aren't part of the credentials
    function refreshProfile(key) {
        var account = findAccount(loadVault(), key);

        if (!account || !account.token) return;

        var request = new XMLHttpRequest();
        request.open('GET', serverAddress(account.server) + '/Users/Me');
        request.setRequestHeader('Authorization', 'MediaBrowser Token="' + account.token + '"');
        request.timeout = 10000;
        request.onload = function () {
            if (request.status !== 200) return;

            var user = JSON.parse(request.responseText);
            var vault = loadVault();
            var current = findAccount(vault, key);

            if (current) {
                current.name = user.Name;
                current.imageTag = user.PrimaryImageTag || null;
                saveVault(vault);
            }
        };
        request.send();
    }

    // Brings the vault up to date with whatever the web app did to the credentials
    function reconcile() {
        var vault = loadVault();
        var credentials = loadCredentials();
        var remember = localStorage.getItem(AUTO_LOGIN_KEY) !== 'false';
        var previous = findAccount(vault, vault.activeKey);
        var newest = null;
        var fetchProfiles = [];

        credentials.Servers.forEach(function (server) {
            if (!server.Id || !server.AccessToken || !server.UserId) return;

            if (!newest || (server.DateLastAccessed || 0) > (newest.DateLastAccessed || 0)) {
                newest = server;
            }

            if (!remember) return;

            var key = server.Id + ':' + server.UserId;
            var account = findAccount(vault, key);

            if (!account) {
                account = { key: key, serverId: server.Id, userId: server.UserId };
                vault.accounts.push(account);
            }

            if (account.token !== server.AccessToken) {
                account.token = server.AccessToken;
                fetchProfiles.push(key);

                if (vault.resetPinKey === key) {
                    delete account.pin;
                    delete account.pinFailures;
                    delete account.pinLockedUntil;
                    delete vault.resetPinKey;
                }
            }

            account.server = serverSnapshot(server);
        });

        // The active token is only ever dropped by a sign out or a rejected token
        if (previous) {
            var previousServer = findServer(credentials, previous.serverId);

            if (previousServer && (previousServer.UserId !== previous.userId || !previousServer.AccessToken)) {
                delete previous.token;
            }
        }

        vault.activeKey = newest ? newest.Id + ':' + newest.UserId : null;
        saveVault(vault);
        fetchProfiles.forEach(refreshProfile);
    }

    // Makes the given account the only one the web app can reach. Other tokens stay out of the
    // credentials, otherwise selecting another server would get past that account's PIN.
    function applySelection(selection) {
        var vault = loadVault();
        var credentials = loadCredentials();
        var account = findAccount(vault, selection.key);

        credentials.Servers.forEach(function (server) {
            server.UserId = null;
            server.AccessToken = null;
        });

        vault.activeKey = null;

        if (account) {
            var server = findServer(credentials, account.serverId);

            if (!server) {
                server = JSON.parse(JSON.stringify(account.server));
                credentials.Servers.push(server);
            }

            server.DateLastAccessed = new Date().getTime();

            if (account.token && !selection.signIn) {
                server.UserId = account.userId;
                server.AccessToken = account.token;
                vault.activeKey = account.key;
                localStorage.setItem(AUTO_LOGIN_KEY, 'true');
            }
        }

        saveVault(vault);
        saveCredentials(credentials);
    }

    function needsChoice(vault) {
        var active = findAccount(vault, vault.activeKey);

        if (vault.accounts.length > 1) return true;
        if (active) return !!active.pin;

        return vault.accounts.some(function (account) {
            return !!account.token;
        });
    }

    // The bundles are held back by the build, see modifyIndex in gulpfile.babel.js
    function startWeb() {
        sessionStorage.setItem(UNLOCKED_KEY, '1');

        if (webStarted) return;
        webStarted = true;

        Array.prototype.forEach.call(document.querySelectorAll('script[data-src]'), function (held) {
            var script = document.createElement('script');
            script.src = held.getAttribute('data-src');
            script.async = false;
            document.body.appendChild(script);
        });

        var vault = loadVault();
        if (vault.activeKey) refreshProfile(vault.activeKey);
    }

    function restartWith(selection) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(selection));
        // Drop the hash, it can point to an item the next account has no access to
        location.replace(location.pathname + location.search);
    }

    function enter(selection) {
        if (webStarted) {
            if (selection.key && selection.key === loadVault().activeKey && !selection.signIn) {
                closeOverlay();
            } else {
                restartWith(selection);
            }
            return;
        }

        applySelection(selection);
        closeOverlay();
        startWeb();
    }

    function exitApp() {
        tizen.application.getCurrentApplication().exit();
    }

    function setRemoteDigits(enabled) {
        for (var i = 0; i <= 9; i++) {
            try {
                if (enabled) {
                    tizen.tvinputdevice.registerKey(String(i));
                } else {
                    tizen.tvinputdevice.unregisterKey(String(i));
                }
            } catch (err) {
                console.error('Unable to change remote key ' + i, err);
            }
        }
    }

    // SHA-256, crypto.subtle doesn't exist in the web engine of older TVs
    function sha256(ascii) {
        var K = [];
        var H = [];
        var candidate = 2;

        while (K.length < 64) {
            var isPrime = true;
            for (var factor = 2; factor * factor <= candidate; factor++) {
                if (candidate % factor === 0) isPrime = false;
            }
            if (isPrime) {
                if (H.length < 8) H.push(Math.pow(candidate, 1 / 2) * 4294967296 | 0);
                K.push(Math.pow(candidate, 1 / 3) * 4294967296 | 0);
            }
            candidate++;
        }

        function rotr(x, n) {
            return (x >>> n) | (x << (32 - n));
        }

        var bytes = [];
        for (var i = 0; i < ascii.length; i++) bytes.push(ascii.charCodeAt(i));
        var bitLength = bytes.length * 8;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);
        bytes.push(0, 0, 0, 0, bitLength >>> 24, (bitLength >>> 16) & 255, (bitLength >>> 8) & 255, bitLength & 255);

        for (var offset = 0; offset < bytes.length; offset += 64) {
            var w = [];
            var t;
            for (t = 0; t < 16; t++) {
                var at = offset + t * 4;
                w[t] = (bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3];
            }
            for (t = 16; t < 64; t++) {
                var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
                var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
                w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
            }

            var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
            for (t = 0; t < 64; t++) {
                var t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
                var t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
                h = g;
                g = f;
                f = e;
                e = (d + t1) | 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) | 0;
            }

            H[0] = (H[0] + a) | 0;
            H[1] = (H[1] + b) | 0;
            H[2] = (H[2] + c) | 0;
            H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0;
            H[5] = (H[5] + f) | 0;
            H[6] = (H[6] + g) | 0;
            H[7] = (H[7] + h) | 0;
        }

        return H.map(function (word) {
            return ('00000000' + (word >>> 0).toString(16)).slice(-8);
        }).join('');
    }

    function randomSalt() {
        var values = new Uint8Array(16);
        window.crypto.getRandomValues(values);
        return Array.prototype.map.call(values, function (value) {
            return ('0' + value.toString(16)).slice(-2);
        }).join('');
    }

    function setPin(key, pin) {
        var vault = loadVault();
        var account = findAccount(vault, key);
        var salt = randomSalt();

        account.pin = { salt: salt, hash: sha256(salt + pin) };
        delete account.pinFailures;
        delete account.pinLockedUntil;
        saveVault(vault);
    }

    function clearPin(key) {
        var vault = loadVault();
        var account = findAccount(vault, key);

        delete account.pin;
        delete account.pinFailures;
        delete account.pinLockedUntil;
        saveVault(vault);
    }

    function lockoutMessage(account) {
        var remaining = (account.pinLockedUntil || 0) - new Date().getTime();

        if (remaining <= 0) return null;

        return 'Too many attempts. Try again in ' + Math.ceil(remaining / 1000) + ' seconds.';
    }

    // Returns an error message, or null when the PIN is correct
    function checkPin(key, pin) {
        var vault = loadVault();
        var account = findAccount(vault, key);
        var locked = lockoutMessage(account);

        if (locked) return locked;

        if (sha256(account.pin.salt + pin) === account.pin.hash) {
            delete account.pinFailures;
            delete account.pinLockedUntil;
            saveVault(vault);
            return null;
        }

        account.pinFailures = (account.pinFailures || 0) + 1;

        if (account.pinFailures >= MAX_PIN_FAILURES) {
            account.pinFailures = 0;
            account.pinLockedUntil = new Date().getTime() + PIN_LOCKOUT_MS;
            saveVault(vault);
            return lockoutMessage(account);
        }

        saveVault(vault);
        return 'Wrong PIN';
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function button(className, text, onClick) {
        var node = element('button', className, text);
        node.type = 'button';
        node.addEventListener('click', onClick);
        return node;
    }

    function displayName(account) {
        return account.name || 'Account';
    }

    function setView(view, focusTarget, onBack, onDigit) {
        backHandler = onBack;
        digitHandler = onDigit || null;
        setRemoteDigits(!!onDigit);
        overlay.textContent = '';
        overlay.appendChild(view);
        overlay.scrollTop = 0;

        var target = focusTarget || view.querySelector('button');
        if (target) target.focus();
    }

    function openOverlay() {
        if (overlay) return;

        previousFocus = document.activeElement;
        overlay = element('div', 'ja-overlay');
        overlay.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        document.body.appendChild(overlay);
    }

    function closeOverlay() {
        if (!overlay) return;

        setRemoteDigits(false);
        document.body.removeChild(overlay);
        overlay = null;
        overlayFocus = null;
        backHandler = null;
        digitHandler = null;
        mustChoose = false;

        if (previousFocus && previousFocus.focus && document.body.contains(previousFocus)) {
            previousFocus.focus();
        }
        previousFocus = null;
    }

    // The web app focuses things after it's done loading, which can be behind the overlay
    function onFocusIn(e) {
        if (!overlay) return;

        if (overlay.contains(e.target)) {
            overlayFocus = e.target;
        } else if (overlayFocus) {
            overlayFocus.focus();
        }
    }

    function restoreFocus() {
        if (overlay.contains(document.activeElement)) return;

        var target = overlay.contains(overlayFocus) ? overlayFocus : overlay.querySelector('button');
        if (target) target.focus();
    }

    function moveFocus(keyCode) {
        var current = document.activeElement;
        var candidates = overlay.querySelectorAll('button');
        var from = current.getBoundingClientRect();
        var fromX = from.left + from.width / 2;
        var fromY = from.top + from.height / 2;
        var best = null;
        var bestScore = Infinity;

        Array.prototype.forEach.call(candidates, function (candidate) {
            if (candidate === current) return;

            var to = candidate.getBoundingClientRect();
            var dx = to.left + to.width / 2 - fromX;
            var dy = to.top + to.height / 2 - fromY;
            var along = { 37: -dx, 38: -dy, 39: dx, 40: dy }[keyCode];
            var across = keyCode === 37 || keyCode === 39 ? Math.abs(dy) : Math.abs(dx);

            if (along <= 1) return;

            // Stay in the same row or column wherever possible
            var score = along + across * 3;

            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
        });

        if (best) best.focus();
    }

    function onKeyDown(e) {
        if (!overlay) return;

        var keyCode = e.keyCode;

        e.stopImmediatePropagation();
        e.preventDefault();
        restoreFocus();

        if (keyCode >= 37 && keyCode <= 40) {
            moveFocus(keyCode);
        } else if (keyCode === KEY_ENTER) {
            // A held down OK button must not fall through to the next view
            if (!e.repeat) document.activeElement.click();
        } else if (keyCode === KEY_BACK || keyCode === KEY_ESCAPE || keyCode === KEY_BACKSPACE) {
            if (!e.repeat && backHandler) backHandler();
        } else if (digitHandler && keyCode >= 48 && keyCode <= 57) {
            if (!e.repeat) digitHandler(String(keyCode - 48));
        } else if (digitHandler && keyCode >= 96 && keyCode <= 105) {
            if (!e.repeat) digitHandler(String(keyCode - 96));
        }
    }

    function swallowKey(e) {
        if (overlay) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }

    function createAvatar(account) {
        var corner = element('span', 'ja-corner');
        var avatar = element('span', 'ja-avatar', displayName(account).charAt(0).toUpperCase());

        if (account.imageTag && account.server) {
            var image = element('img');
            image.onerror = function () {
                avatar.removeChild(image);
            };
            image.src = serverAddress(account.server) + '/Users/' + account.userId + '/Images/Primary?maxHeight=300&quality=90&tag=' + account.imageTag;
            avatar.appendChild(image);
        }

        corner.appendChild(avatar);

        if (account.pin) {
            var badge = element('span', 'ja-badge');
            badge.innerHTML = ICON_LOCK;
            corner.appendChild(badge);
        }

        return corner;
    }

    function showPicker() {
        var vault = loadVault();
        var multipleServers = vault.accounts.some(function (account) {
            return account.serverId !== vault.accounts[0].serverId;
        });
        var view = element('div', 'ja-view');
        var cards = element('div');
        var focusTarget = null;

        view.appendChild(element('h1', 'ja-title', 'Who\'s watching?'));

        vault.accounts.forEach(function (account) {
            var card = button('ja-card', undefined, function () {
                chooseAccount(account.key);
            });
            var detail = '';

            if (!account.token) {
                detail = 'Signed out';
            } else if (account.key === vault.activeKey && webStarted) {
                detail = 'Current';
            } else if (multipleServers && account.server) {
                detail = account.server.Name || '';
            }

            card.appendChild(createAvatar(account));
            card.appendChild(element('span', 'ja-name', displayName(account)));
            card.appendChild(element('span', 'ja-detail', detail));
            cards.appendChild(card);

            if (account.key === vault.activeKey) focusTarget = card;
        });

        var addCard = button('ja-card', undefined, function () {
            enter({ key: null });
        });
        var addCorner = element('span', 'ja-corner');
        var addAvatar = element('span', 'ja-avatar');
        addAvatar.innerHTML = ICON_PLUS;
        addCorner.appendChild(addAvatar);
        addCard.appendChild(addCorner);
        addCard.appendChild(element('span', 'ja-name', 'Add account'));
        addCard.appendChild(element('span', 'ja-detail', ''));
        cards.appendChild(addCard);
        view.appendChild(cards);

        if (vault.accounts.length) {
            view.appendChild(button('ja-button', 'Manage accounts', showManage));
        }

        setView(view, focusTarget, mustChoose ? exitApp : closeOverlay);
    }

    function chooseAccount(key) {
        var vault = loadVault();
        var account = findAccount(vault, key);
        var alreadyUnlocked = webStarted && !mustChoose && key === vault.activeKey;

        if (alreadyUnlocked) {
            enter({ key: key });
            return;
        }

        requirePin(account, showPicker, true, function () {
            enter({ key: key });
        });
    }

    function requirePin(account, onCancel, allowForgot, onSuccess) {
        if (!account.pin) {
            onSuccess();
            return;
        }

        showPinPad({
            title: 'Enter the PIN for ' + displayName(account),
            message: lockoutMessage(account),
            onCancel: onCancel,
            onForgot: allowForgot ? function () {
                showForgotPin(account);
            } : null,
            onComplete: function (pin, fail) {
                var error = checkPin(account.key, pin);
                if (error) {
                    fail(error);
                } else {
                    onSuccess();
                }
            }
        });
    }

    function showPinPad(options) {
        var entered = '';
        var view = element('div', 'ja-view');
        var dots = element('div', 'ja-dots');
        var message = element('div', 'ja-message');
        var first = null;

        function paint() {
            Array.prototype.forEach.call(dots.children, function (dot, index) {
                dot.className = index < entered.length ? 'ja-dot ja-dot-on' : 'ja-dot';
            });
        }

        function showMessage(text) {
            message.textContent = text || '';
            message.className = text ? 'ja-message ja-error' : 'ja-message';
        }

        function press(digit) {
            if (entered.length >= PIN_LENGTH) return;

            entered += digit;
            showMessage(null);
            paint();

            if (entered.length === PIN_LENGTH) {
                options.onComplete(entered, function (error) {
                    entered = '';
                    paint();
                    showMessage(error);
                });
            }
        }

        function erase() {
            entered = entered.slice(0, -1);
            paint();
        }

        function createKey(label) {
            return button('ja-key', label, function () {
                press(label);
            });
        }

        view.appendChild(element('h1', 'ja-title', options.title));

        for (var i = 0; i < PIN_LENGTH; i++) dots.appendChild(element('span', 'ja-dot'));
        view.appendChild(dots);
        view.appendChild(message);
        showMessage(options.message);

        [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].forEach(function (labels) {
            var row = element('div');
            labels.forEach(function (label) {
                var key = createKey(label);
                first = first || key;
                row.appendChild(key);
            });
            view.appendChild(row);
        });

        var lastRow = element('div');
        var eraseKey = button('ja-key', undefined, erase);
        eraseKey.innerHTML = ICON_BACKSPACE;
        lastRow.appendChild(eraseKey);
        lastRow.appendChild(createKey('0'));
        lastRow.appendChild(button('ja-key ja-key-text', 'Cancel', options.onCancel));
        view.appendChild(lastRow);

        if (options.onForgot) {
            view.appendChild(button('ja-button', 'Forgot PIN', options.onForgot));
        }

        setView(view, first, options.onCancel, press);
    }

    function showForgotPin(account) {
        showConfirm(
            'Forgot the PIN for ' + displayName(account) + '?',
            'Sign in with this account\'s password to remove its PIN.',
            'Sign in',
            function () {
                var vault = loadVault();
                vault.resetPinKey = account.key;
                saveVault(vault);
                enter({ key: account.key, signIn: true });
            },
            function () {
                chooseAccount(account.key);
            }
        );
    }

    function showConfirm(title, text, confirmLabel, onConfirm, onCancel) {
        var view = element('div', 'ja-view');
        var cancel = button('ja-button', 'Cancel', onCancel);

        view.appendChild(element('h1', 'ja-title', title));
        view.appendChild(element('div', 'ja-message', text));
        view.appendChild(button('ja-button', confirmLabel, onConfirm));
        view.appendChild(cancel);

        setView(view, cancel, onCancel);
    }

    function showSetPin(key) {
        var account = findAccount(loadVault(), key);

        showPinPad({
            title: 'Choose a ' + PIN_LENGTH + '-digit PIN for ' + displayName(account),
            onCancel: showManage,
            onComplete: function (pin) {
                showPinPad({
                    title: 'Enter the same PIN again',
                    onCancel: showManage,
                    onComplete: function (repeated, fail) {
                        if (repeated === pin) {
                            setPin(key, pin);
                            showManage();
                        } else {
                            fail('The PINs don\'t match');
                        }
                    }
                });
            }
        });
    }

    function removeAccount(account) {
        var vault = loadVault();
        var wasActive = vault.activeKey === account.key;

        vault.accounts = vault.accounts.filter(function (other) {
            return other.key !== account.key;
        });
        if (wasActive) vault.activeKey = null;
        saveVault(vault);

        if (account.token && account.server) {
            var request = new XMLHttpRequest();
            request.open('POST', serverAddress(account.server) + '/Sessions/Logout');
            request.setRequestHeader('Authorization', 'MediaBrowser Token="' + account.token + '"');
            request.send();
        }

        if (wasActive && webStarted) {
            restartWith({ key: null });
            return;
        }

        // Keep it from being picked up again from the credentials
        applyRemoval(account);
        showManage();
    }

    function applyRemoval(account) {
        var credentials = loadCredentials();
        var server = findServer(credentials, account.serverId);

        if (server && server.UserId === account.userId) {
            server.UserId = null;
            server.AccessToken = null;
            saveCredentials(credentials);
        }
    }

    function showManage() {
        var vault = loadVault();
        var view = element('div', 'ja-view');
        var rows = element('div', 'ja-rows');

        view.appendChild(element('h1', 'ja-title', 'Manage accounts'));
        view.appendChild(element('div', 'ja-message', 'A PIN is asked for every time the app starts on that account, and whenever someone switches to it.'));

        vault.accounts.forEach(function (account) {
            var row = element('div', 'ja-row');
            var label = element('div', 'ja-row-label', displayName(account));
            var actions = element('div', 'ja-row-actions');

            actions.appendChild(button('ja-button', account.pin ? 'Change PIN' : 'Set PIN', function () {
                requirePin(account, showManage, false, function () {
                    showSetPin(account.key);
                });
            }));

            if (account.pin) {
                actions.appendChild(button('ja-button', 'Remove PIN', function () {
                    requirePin(account, showManage, false, function () {
                        clearPin(account.key);
                        showManage();
                    });
                }));
            }

            actions.appendChild(button('ja-button', 'Remove', function () {
                requirePin(account, showManage, false, function () {
                    showConfirm(
                        'Remove ' + displayName(account) + ' from this TV?',
                        'It can be added again by signing in with its password.',
                        'Remove',
                        function () {
                            removeAccount(account);
                        },
                        showManage
                    );
                });
            }));

            row.appendChild(label);
            row.appendChild(actions);
            rows.appendChild(row);
        });

        view.appendChild(rows);
        view.appendChild(element('div'));
        view.appendChild(button('ja-button', 'Done', showPicker));

        setView(view, null, showPicker);
    }

    function openPicker(required) {
        reconcile();
        openOverlay();
        mustChoose = required;
        showPicker();
    }

    function addEntryPoints() {
        var hasAccounts = loadVault().accounts.length > 0;
        var headerRight = document.querySelector('.skinHeader .headerRight');
        var userButton = headerRight && headerRight.querySelector('.headerUserButton');

        if (userButton && !headerRight.querySelector('.headerAccountsButton')) {
            var headerButton = button('headerButton headerButtonRight headerAccountsButton paper-icon-button-light show-focus', undefined, function () {
                openPicker(false);
            });
            headerButton.title = 'Switch account';
            headerButton.innerHTML = ICON_ACCOUNTS;
            headerRight.insertBefore(headerButton, userButton.nextSibling);
        }

        // Signing out ends up on one of these, depending on the number of servers
        var sibling = document.querySelector('#loginPage .btnSelectServer') || document.querySelector('#selectServerPage .btnAddServer');

        if (hasAccounts && sibling && !sibling.parentNode.querySelector('.btnSavedAccounts')) {
            var savedAccounts = button(sibling.className.replace(/\b(btn\w+|hide)\b/g, '') + ' btnSavedAccounts', 'Saved accounts', function () {
                openPicker(false);
            });
            savedAccounts.style.cssText = sibling.style.cssText;
            // After the existing buttons, so it doesn't take the initial focus of the page
            sibling.parentNode.insertBefore(savedAccounts, sibling.nextSibling);
        }
    }

    function onViewShow() {
        reconcile();
        addEntryPoints();
    }

    function onVisibilityChange() {
        if (document.hidden) {
            hiddenAt = new Date().getTime();
            return;
        }

        var hiddenFor = hiddenAt === null ? 0 : new Date().getTime() - hiddenAt;
        hiddenAt = null;

        if (!webStarted || hiddenFor < RELOCK_AFTER_HIDDEN_MS) return;

        reconcile();

        var vault = loadVault();
        var active = findAccount(vault, vault.activeKey);

        if (active && active.pin) {
            closeOverlay();
            openPicker(true);
        }
    }

    function boot() {
        var style = element('style');
        style.textContent = STYLE;
        document.head.appendChild(style);

        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keypress', swallowKey, true);
        window.addEventListener('keyup', swallowKey, true);
        window.addEventListener('viewshow', onViewShow);
        document.addEventListener('focusin', onFocusIn, true);
        document.addEventListener('visibilitychange', onVisibilityChange);

        var pending = sessionStorage.getItem(PENDING_KEY);

        if (pending) {
            sessionStorage.removeItem(PENDING_KEY);
            applySelection(JSON.parse(pending));
            startWeb();
            return;
        }

        reconcile();

        if (sessionStorage.getItem(UNLOCKED_KEY)) {
            startWeb();
            return;
        }

        var vault = loadVault();

        // A password reset that was walked away from doesn't carry over to the next person
        if (vault.resetPinKey) {
            delete vault.resetPinKey;
            saveVault(vault);
        }

        if (needsChoice(vault)) {
            openPicker(true);
        } else {
            startWeb();
        }
    }

    try {
        boot();
    } catch (err) {
        // Never leave the TV on a blank screen because of the account switcher
        console.error('Accounts adapter failed', err);
        closeOverlay();
        startWeb();
    }
})();

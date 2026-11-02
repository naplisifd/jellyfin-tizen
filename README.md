<h1 align="center">Jellyfin for Tizen</h1>
<h3 align="center">Part of the <a href="https://jellyfin.org">Jellyfin Project</a></h3>

---

<p align="center">
<img alt="Logo Banner" src="https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/SVG/banner-logo-solid.svg?sanitize=true"/>
</p>

## Accounts

This fork adds a Netflix-style account switcher on top of the regular app. No changes to Jellyfin Web or the server are needed.

* **Switching:** every account you sign in to is remembered. Use the switch icon next to the user icon in the header, or the picker shown at startup when more than one account is saved. Nobody has to retype a password, and the other accounts stay signed in.
* **Adding:** choose `Add account` in the picker and sign in as usual. Accounts on different servers can be mixed.
* **PIN:** choose `Manage accounts` in the picker to set, change or remove a 4-digit PIN. Use the on-screen pad or the number keys on the remote. The PIN is asked for at startup, when switching to the account, and when returning to the app after 5 minutes in the background. After 5 wrong tries, PIN entry is blocked for a minute.
* **Forgotten PIN:** choose `Forgot PIN` on the PIN screen and sign in with the account's password.
* **Signing out** in the app revokes the token. The account stays in the picker as `Signed out`, with its PIN, until it's signed in again or removed.

> The PIN keeps people in your household out of an account on this TV. It isn't protection against someone with developer access to the TV, because tokens are stored unencrypted in the app's storage, just like in regular Jellyfin. It also can't protect an account that has no password, since that account can sign in again from the login screen. Give PIN-protected accounts a password, and hide them from the login screen in the server's user settings.

This build has its own app ID (`JfAccounts.Jellyfin`), so it installs alongside the official app. The two don't share saved logins.

The feature lives in [`accounts.js`](accounts.js), and the `modifyIndex` task in [`gulpfile.babel.js`](gulpfile.babel.js) injects it.

## Build Process
_Also look [Wiki](https://github.com/jellyfin/jellyfin-tizen/wiki)._

### Prerequisites
* Tizen Studio 4.6+ with IDE or Tizen Studio 4.6+ with CLI. See [Installing TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html).
* Git
* Node.js 20+

### Getting Started

1. Install prerequisites.
2. Install Certificate Manager using Tizen Studio Package Manager. See [Installing Required Extensions](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html#Installing-Required-Extensions).
3. Setup Tizen certificate in Certificate Manager. See [Creating Certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html).
   > If you have installation problems with the Tizen certificate, try creating a Samsung certificate. In this case, you will also need a Samsung account.
4. Clone or download [Jellyfin Web repository](https://github.com/jellyfin/jellyfin-web).

   > It is recommended that the web version match the server version.

   ```sh
   git clone -b release-10.10.z https://github.com/jellyfin/jellyfin-web.git
   ```
   > Replace `release-10.10.z` with the name of the branch you want to build.

   > You can also use `git checkout` to switch branches.
5. Clone or download Jellyfin Tizen (this) repository.
   ```sh
   git clone https://github.com/jellyfin/jellyfin-tizen.git
   ```

### Build Jellyfin Web

```sh
cd jellyfin-web
npm ci --no-audit
USE_SYSTEM_FONTS=1 npm run build:production
```

> You should get `jellyfin-web/dist/` directory.

> `USE_SYSTEM_FONTS=1` is required to discard unused fonts and to reduce the size of the app. (Since Jellyfin Web 10.9)

> Use `npm run build:development` if you want to debug the app.

If any changes are made to `jellyfin-web/`, the `jellyfin-web/dist/` directory will need to be rebuilt using the command above.

### Prepare Interface

```sh
cd jellyfin-tizen
JELLYFIN_WEB_DIR=../jellyfin-web/dist npm ci --no-audit
```

> You should get `jellyfin-tizen/www/` directory.

> The `JELLYFIN_WEB_DIR` environment variable can be used to override the location of `jellyfin-web`.

> Add `DISCARD_UNUSED_FONTS=1` environment variable to discard unused fonts and to reduce the size of the app. (Until Jellyfin Web 10.9)  
> Don't use it with Jellyfin Web 10.9+. Instead, use `USE_SYSTEM_FONTS=1` environment variable when building Jellyfin Web.

If any changes are made to `jellyfin-web/dist/`, the `jellyfin-tizen/www/` directory will need to be rebuilt using the command above.

### Build WGT

> Make sure you select the appropriate Certificate Profile in Tizen Certificate Manager. This determines which devices you can install the widget on.

```sh
tizen build-web -e ".*" -e gulpfile.babel.js -e README.md -e "node_modules/*" -e "package*.json" -e "yarn.lock"
tizen package -t wgt -o . -- .buildResult
```

> You should get `JellyfinAccounts.wgt`.

## Deployment

### Deploy to Emulator

1. Run emulator.
2. Install package.
   ```sh
   tizen install -n JellyfinAccounts.wgt -t T-samsung-5.5-x86
   ```
   > Specify target with `-t` option. Use `sdb devices` to list them.

### Deploy to TV

1. Run TV.
2. Activate Developer Mode on TV. See [Enable Developer Mode on the TV](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html#Connecting-the-TV-and-SDK).
3. Connect to TV with one of the following options:
   * Device Manager from `Tools -> Device Manager` in Tizen Studio.

   * sdb:
      ```sh
      sdb connect YOUR_TV_IP
      ```
4. If you are using a Samsung certificate, allow installs onto your TV using your certificate with one of the following options:
   > If you need to change or create a new Samsung certificate (see [Getting-Started](#getting-started) step 3), you will need to [re-build WGT](#build-wgt) once you have the Samsung certificate you'll use for the install.

   * Device Manager from `Tools -> Device Manager` in Tizen Studio:
      * Right-click on the connected device, and select `Permit to install applications`.

   * Tizen CLI:
      ```sh
      tizen install-permit -t UE65NU7400
      ```
      > Specify target with `-t` option. Use `sdb devices` to list them.

   * sdb:
      ```sh
      sdb push ~/SamsungCertificate/<PROFILE_NAME>/*.xml /home/developer
      ```
5. Install package.
   ```sh
   tizen install -n JellyfinAccounts.wgt -t UE65NU7400
   ```
   > Specify target with `-t` option. Use `sdb devices` to list them.

# نقشه‌راه پروژه — Ubuntu Web Desktop

این فایل حافظه‌ی بلندمدت پروژه‌ست. هر وقت خواستیم کار رو ادامه بدیم، اول بخش **«وضعیت فعلی»** رو می‌خونم و از همون‌جا ادامه می‌دیم. بعد از هر جلسه‌ی کاری، این فایل رو به‌روز می‌کنم (چک‌باکس‌ها + وضعیت فعلی + لاگ پیشرفت).

---

## وضعیت فعلی

> آخرین به‌روزرسانی: 2026-08-01

- **مرحله‌ی فعلی:** هنوز کدی برای این نقشه‌راه نوشته نشده — این نسخه‌ی صفرِ پلنه.
- **قدم بعدی:** شروع **فاز ۰ — هسته‌ی معماری (Core Kernel)**، از VFS شروع می‌کنیم.
- **بیس‌لاین امروز:** پروژه یه SPA رو React 19 + Vite + shadcn/ui هست که یه دسکتاپ اوبونتو رو *ظاهری* شبیه‌سازی می‌کنه (نه data-driven). جزئیات کامل در «بیس‌لاین فعلی کد» پایین‌تر.

---

## فلسفه‌ی کار (چرا این ترتیب)

خودت درست گفتی: مهم‌ترین تصمیم معماریه. اگه از اول برای هر دستور ترمینال `if/else` بنویسیم و فایل‌سیستم رو آبجکت هاردکد نگه داریم، فاز ۳ و ۴ (که قلب پروژه‌ن) غیرقابل‌نگه‌داری می‌شن.

پس به‌جای اینکه فازها رو دقیقاً به ترتیب ۱→۶ که نوشتی بریم، یه **فاز ۰** قبلش اضافه کردم: هسته‌ی موتور (kernel) که همه‌چیز — VFS، ترمینال، اپ‌ها، حتی صفحه‌ی لاگین — روش سوار می‌شه. ترتیب اجرای پیشنهادی من:

```
فاز ۰ (هسته)  →  فاز ۳ (VFS واقعی)  →  فاز ۴ (Bash/Terminal)  →  فاز ۱ (Boot/Login/Desktop Shell)  →  فاز ۲ (تکمیل WM)  →  فاز ۵ (اپ‌ها به کرنل وصل بشن)  →  فاز ۶ (پرداخت و ریل‌ایسم نهایی)
```

چرا این ترتیب؟ فاز ۴ (ترمینال) بدون VFS واقعی (فاز ۳) بی‌معنیه. فاز ۱ (لاگین چندکاربره، رمز عبور) بدون سیستم کاربر/پرمیشن هسته (فاز ۰) قابل‌اجرا نیست. فاز ۵ (اپ‌های واقعی) باید به همون VFS و Process Manager وصل بشن که ترمینال استفاده می‌کنه — وگرنه دو تا فایل‌سیستم جدا از هم خواهیم داشت که با هم sync نیستن.

شماره‌ی فازها همون شماره‌ای هست که خودت دادی (برای رجوع راحت)، فقط ترتیب اجراشون فرق داره.

---

## بیس‌لاین فعلی کد (چی از قبل هست، چی نیست)

**Window Manager (`src/ubuntu/components/Window.tsx`, `context/DesktopContext.tsx`):**
- ✅ Move (drag)، Resize (۸ handle)، Minimize، Maximize (از طریق snap=full)، Close، Focus/Z-index (کلیک میاد جلو)
- ✅ Snap left/right/full (edge snapping هنگام درگ)
- ⬜ Snap top (quarter-tiling)، Fullscreen واقعی (بدون chrome)، Workspaces متعدد، Alt+Tab، Super key برای باز کردن Activities

**Desktop Shell:**
- ✅ TopBar (ساعت، تقریبا)، Dock (با آیکون‌ها)، ActivitiesOverview (کامپوننت هست ولی محدود)، LockScreen، BootScreen/PowerOffScreen (ساده)
- ⬜ Multiple users، Avatar، Guest session، Wrong-password animation، Recovery mode، Plymouth animation واقعی
- ⬜ Right-click menu دسکتاپ، Desktop icons، Notifications واقعی، Calendar، Quick settings (volume/brightness/wifi/bluetooth/battery)، Trash

**فایل‌سیستم:**
- ⬜ هیچ VFS مشترکی نیست. `TerminalApp.tsx` یه آبجکت JS هاردکد و ایزوله به اسم `FS` داره (فقط چند پوشه‌ی زیر `/home/user`)، و `FilesApp.tsx` احتمالاً دیتای جدای خودش رو داره. این دو با هم sync نیستن.

**ترمینال (`TerminalApp.tsx`):**
- ✅ حدود ۱۵ دستور ساده: `ls, cd, pwd, cat, echo, whoami, date, uname, hostname, neofetch, apt update/install (fake), sudo (stub), clear, exit`
- ✅ تاریخچه‌ی ساده با ↑/↓
- ⬜ Parser واقعی (pipe، redirect، wildcard، quoting)، Tab completion، Ctrl+C، متغیرهای محیطی، exit code، بقیه‌ی ~۷۰ دستوری که لیست کردی

**اپ‌ها (`src/ubuntu/apps/*`):** Files، Editor، Calculator، Settings، SysMonitor، AppCenter — همه UI shell دارن ولی به هیچ state مرکزی وصل نیستن.

**Persistence:** فقط `EditorApp.tsx` یه `localStorage.setItem` تکی داره. هیچ لایه‌ی persistence مرکزی نیست (نه برای تنظیمات، نه برای VFS، نه برای کاربرها).

---

## فاز ۰ — هسته‌ی معماری (Core Kernel) 🔴 اولویت اول

اینجا پایه‌ی همه‌چیزه. هدف: یه ماژول مستقل (`src/os/`) که هیچ وابستگی به React نداره و می‌تونیم واحد-تست‌اش کنیم.

- [ ] **VFS (Virtual File System):** ساختار درختی `inode`-محور (نوع: file/dir/symlink، content، permissions، owner، group، mtime). API: `read/write/mkdir/rm/mv/cp/stat/ls/resolve(path)`. Persist در IndexedDB (نه localStorage — حجم بیشتر لازمه).
- [ ] **Command Registry:** هر دستور یه ماژول جدا با امضای واحد `(args, stdin, ctx) => { stdout, stderr, exitCode }`. اضافه‌کردن دستور جدید = یه فایل جدید، نه دست‌زدن به یه `switch` غول‌پیکر.
- [ ] **Bash Parser:** توکنایزر برای quoting، `|` pipe، `>` `>>` redirect، `*` wildcard (glob)، `$VAR` expansion، `&&`/`||`، چندین دستور با `;`.
- [ ] **Process Manager:** فهرست فیک PID/PPID/CPU%/MEM% برای `ps/top/kill/jobs`. تایمر شبیه‌سازی‌شده برای «زمان اجرا».
- [ ] **User & Permission System:** جدول کاربران (شبیه `/etc/passwd`)، گروه‌ها، رمز عبور (هش‌شده حتی اگه fake باشه)، `chmod/chown` واقعاً روی VFS اثر بذاره، چک permission موقع خوندن/نوشتن فایل.
- [ ] **Package Database:** لیست فیک پکیج‌های نصب‌شده (برای `apt/dpkg`)، وضعیت نصب/حذف که در VFS هم منعکس بشه (مثلاً فایل باینری فیک تو `/usr/bin`).
- [ ] **Service Manager:** لیست سرویس‌های فیک (NetworkManager, ssh, docker, nginx...) با وضعیت running/stopped، لاگ هر سرویس در `/var/log` بنویسه.
- [ ] **Settings Store:** state مرکزی (theme, wallpaper, locale, network status...) با persistence یکپارچه — جایگزین اون `localStorage.setItem` پراکنده.
- [ ] یه Context/Provider واحد (`KernelProvider`) که همه‌ی اینا رو در اختیار کل اپ (ترمینال + اپ‌های GUI) می‌ذاره.

**خروجی این فاز:** یه «سیستم‌عامل کوچولو» که هنوز UI نداره ولی از طریق یه تست/کنسول می‌شه باهاش `mkdir /home/bitx/test && ls /home/bitx` زد و جواب درست گرفت.

---

## فاز ۳ — فایل‌سیستم واقعی (روی هسته‌ی فاز ۰)

- [ ] Seed کردن VFS با درخت کامل ریشه: `/bin /boot /dev /etc /home /lib /lib64 /media /mnt /opt /proc /root /run /sbin /srv /sys /tmp /usr /var`
- [ ] `/home/bitx/`: Desktop, Documents, Downloads, Music, Pictures, Videos, Projects, Notes, Public, Templates, `.ssh`, `.config`, `.local`, `.cache`, `.bashrc`, `.profile` (با محتوای seed معقول، نه خالی)
- [ ] `/etc/`: `passwd, shadow, group, hostname, hosts, resolv.conf, fstab, os-release, issue, sudoers` + پوشه‌های `ssh/, systemd/, nginx/` (این‌ها باید از همون User System فاز ۰ خونده بشن، نه متن ثابت)
- [ ] `/var/log/`: `auth.log, syslog, kern.log` (که Service Manager فاز ۰ واقعاً بهشون بنویسه، نه fake متن استاتیک)، `nginx/, apache2/, journal/`
- [ ] `/proc/`: `cpuinfo, meminfo, uptime, version, mounts` — این‌ها باید **مقادیر پویا** برگردونن (مثلاً uptime واقعاً بگذره)
- [ ] `/usr/`: `bin, share, local` — `bin` باید با Package Database فاز ۰ sync باشه (نصب پکیج = فایل جدید اینجا)

---

## فاز ۴ — ترمینال / Bash (روی Parser + Registry فاز ۰) 🔴 قلب پروژه

به خاطر حجم بالا، به زیرمرحله تقسیم می‌کنم — هر زیرمرحله چند دستور که با هم منطقی مرتبطن:

- [ ] **۴‌.۱ Navigation:** `pwd, ls, ls -la, tree, cd, pushd, popd`
- [ ] **۴.۲ File ops:** `touch, mkdir, rmdir, rm, cp, mv, ln, cat, less, head, tail, file, stat`
- [ ] **۴.۳ Search:** `find, locate, grep, which, whereis, type`
- [ ] **۴.۴ Permission:** `chmod, chown, chgrp, umask` (واقعاً روی VFS اثر بذاره)
- [ ] **۴.۵ User:** `whoami, id, groups, passwd, sudo, su` (وصل به User System)
- [ ] **۴.۶ Process:** `ps, top, htop, kill, killall, jobs, bg, fg, nohup` (وصل به Process Manager)
- [ ] **۴.۷ Network (فیک ولی قانع‌کننده):** `ping, curl, wget, ip, ss, netstat, dig, nslookup, host, whois`
- [ ] **۴.۸ Package:** `apt update/install/remove/search, dpkg` (وصل به Package Database)
- [ ] **۴.۹ Disk:** `df, du, mount, umount, lsblk` (از روی حجم واقعی VFS محاسبه بشه)
- [ ] **۴.۱۰ System:** `uname, hostname, uptime, date, cal, history, clear, alias, env, printenv, export`
- [ ] **۴.۱۱ Archive:** `zip, unzip, tar, gzip, gunzip` (واقعاً فایل تو VFS بسازن/باز کنن)
- [ ] **۴.۱۲ Text processing:** `echo, printf, sort, uniq, cut, awk, sed, wc` (باید با pipe از فاز۰ کار کنن: `cat file | grep x | wc -l`)
- [ ] **۴.۱۳ Realism لایه‌ی ترمینال:** رنگ prompt واقعی (`user@host:~$`)، Tab completion واقعی (از VFS)، تاریخچه‌ی پایدار (persist)، `Ctrl+C` (لغو دستور در حال «اجرا»)، `Ctrl+L`، wildcard (`*.txt`)، redirect (`>` `>>`)، متغیرهای محیطی (`$HOME $PATH $USER $LANG`)، exit code (`$?`)

---

## فاز ۱ — سیستم‌عامل: Boot / Login / Desktop Shell

- [ ] **Boot:** لوگوی اوبونتو، انیمیشن Plymouth (CSS/SVG)، Boot log (اختیاری، توگل‌شونده)، زمان بوت واقعی ۲-۴ ثانیه، Recovery mode (منوی جایگزین)
- [ ] **Login:** چند کاربر (از User System فاز ۰)، آواتار، چک رمز واقعی، Guest session، انیمیشن رمز اشتباه (shake)
- [ ] Lock Screen (از قبل پایه‌اش هست، تکمیل)، Suspend، Restart، Shutdown (از قبل پایه‌اش هست)
- [ ] **Desktop:** Dynamic wallpaper، Dark/Light theme (وصل به Settings Store)، Right-click menu، Desktop icons، Notifications واقعی (queue)، Calendar، Clock، Volume/Brightness/Wifi/Bluetooth/Battery (فیک ولی state‌دار)، Power menu
- [ ] **GNOME Activities:** Search (across apps + files VFS)، Running apps، Virtual desktops، Workspace switcher، Window overview (تکمیل `ActivitiesOverview.tsx` موجود)
- [ ] **Dock:** Drag & drop، Pin/Unpin، Running indicator، Favorite apps، Trash (تکمیل `Dock.tsx` موجود)

---

## فاز ۲ — تکمیل Window Manager

بخش زیادش از قبل هست (بالا در «بیس‌لاین» علامت‌گذاری شده). باقی‌مونده:

- [ ] Snap top (quarter tiling: بالا-چپ/بالا-راست/پایین-چپ/پایین-راست)
- [ ] Fullscreen واقعی (جدا از Maximize، بدون هیچ chrome)
- [ ] Workspace متعدد (۱،۲،۳...) + انتقال پنجره بین ورک‌اسپیس‌ها
- [ ] Alt+Tab (سوییچر بصری بین پنجره‌های باز)
- [ ] Super key → باز کردن Activities Overview

---

## فاز ۵ — اپ‌های GNOME (وصل به هسته‌ی واقعی)

نکته‌ی مهم: این فاز یعنی اپ‌های *موجود* رو از UI تزئینی به UI واقعاً وصل‌به‌VFS/کرنل تبدیل کنیم، نه از صفر ساختن.

- [ ] **Files:** Copy/Move/Rename/Delete/Create folder/Search — همه از طریق VFS واقعی فاز۰/۳ (الان با ترمینال sync نیست)
- [ ] **Terminal:** از قبل تو فاز ۴ کامل می‌شه
- [ ] **Text Editor:** ذخیره/بارگذاری از VFS واقعی (الان یه `localStorage` تکی و ایزوله داره)
- [ ] **Calculator:** بررسی/تکمیل منطق محاسبه‌ی واقعی (اگه‌جایی ساده‌سازی شده)
- [ ] **Settings:** Theme, Wallpaper, User, Keyboard, Network, About — همه از Settings Store فاز۰ بخونن/بنویسن
- [ ] **System Monitor:** CPU/RAM/Disk/Network گراف‌های زنده از Process Manager فاز۰، لیست Process واقعی با امکان kill از GUI
- [ ] **Logs (جدید):** یه ویوی GUI برای `journalctl` که از Service Manager فاز۰ می‌خونه

---

## فاز ۶ — ریل‌ایسم و پرداخت نهایی

بیشتر این‌ها ضمن فاز‌های بالا پیاده می‌شن (مشخص شده با ✱). باقی‌مونده‌ی مستقل:

- [ ] ✱ Bash prompt رنگی، Tab completion، تاریخچه (توی فاز ۴.۱۳)
- [ ] ✱ Pipe/Redirect/Append/Wildcard/Env vars/Exit code (توی فاز ۴.۱۳)
- [ ] Fake boot logs واقعی‌تر در صفحه‌ی بوت (`Starting NetworkManager... OK` و...) — وصل به Service Manager فاز۰ تا لیست سرویس‌ها واقعاً match باشه
- [ ] پاس نهایی روی تم/رنگ/فونت برای نزدیک‌تر شدن به ظاهر دقیق Ubuntu 24.04 (Yaru theme)
- [ ] Performance pass (لیست بلند فایل در VFS، virtualized list در Files/Terminal اگه لازم شد)

---

## پروتکل کار برای جلسات بعدی

هر بار که این پروژه رو باز کردیم:
1. اول بخش «وضعیت فعلی» بالای همین فایل رو می‌خونم.
2. می‌پرسم یا فرض می‌کنم ادامه‌ی همون قدم بعدیه، مگر خودت جهت عوض کنی.
3. بعد از اتمام هر بخش قابل‌توجه، چک‌باکس‌های مربوطه رو ✅ می‌کنم، «وضعیت فعلی» رو آپدیت می‌کنم، و یه خط به «لاگ پیشرفت» زیر اضافه می‌کنم.

---

## لاگ پیشرفت

- **2026-08-01:** پروژه Dockerize شد (multi-stage build + nginx، مشکل رجیستری خصوصی در `package-lock.json` حل شد). این فایل پلن ساخته شد؛ هنوز هیچ کدی از فازهای بالا نوشته نشده.

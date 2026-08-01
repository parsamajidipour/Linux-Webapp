# نقشه‌راه پروژه — Ubuntu Web Desktop

این فایل حافظه‌ی بلندمدت پروژه‌ست. هر وقت خواستیم کار رو ادامه بدیم، اول بخش **«وضعیت فعلی»** رو می‌خونم و از همون‌جا ادامه می‌دیم. بعد از هر جلسه‌ی کاری، این فایل رو به‌روز می‌کنم (چک‌باکس‌ها + وضعیت فعلی + لاگ پیشرفت).

---

## وضعیت فعلی

> آخرین به‌روزرسانی: 2026-08-01

- **مرحله‌ی فعلی:** فاز ۰ و فاز ۳ تکمیل. از فاز ۴: **۴.۱ تا ۴.۹** (Navigation, File ops, Search, Permission, User, Process, Network, Package, Disk) تکمیل. `TerminalApp.tsx` واقعاً به کرنل وصله و هر زیرمرحله بلافاصله توش در دسترسه.
- **قدم بعدی:** فاز ۴.۱۰ — **System**: `uname, hostname, uptime, date, cal, history, clear, alias, env, printenv, export`. نکته: `clear` از قبل UI-level هست (تو `TerminalApp.tsx`)، بقیه باید تو کرنل واقعی بشن — مخصوصاً `history` باید persist بشه (الان فقط تو state کامپوننته، با رفرش می‌پره) و `export`/`env` باید واقعاً رو `ctx.env` اثر بذارن.
- **نکته‌ی مهم (تغییر روند از این به بعد):** طبق درخواست کاربر، از این جلسه به بعد UI (فعلاً فقط ترمینال) بعد از هر زیرمرحله وصل می‌مونه، نه اینکه همه‌چیز تا آخر فاز ۴ نامرئی بمونه. یعنی: `date/uname/hostname/neofetch/apt/sudo` که تو نسخه‌ی قدیمی ترمینال بودن، **موقتاً از دست رفتن** چون هنوز تو کرنل پیاده نشدن (مال زیرمرحله‌های ۴.۵/۴.۸/۴.۱۰ هستن) — عمداً به‌جای ساختن نسخه‌ی موازی UI-only، صبر می‌کنیم تا زیرمرحله‌ی درستش برسه (طبق همون اصل «data-driven، نه hack» که خود کاربر اول گفت).
- **نکته‌ی مهم:** هنوز **هیچ‌کدوم از این‌ها به UI موجود وصل نشدن** — `TerminalApp.tsx` فعلی هنوز همون فایل‌سیستم فیک تک‌فایلی قدیمی خودش رو داره، نه کرنل جدید. `KernelProvider` روی `Ubuntu.tsx` mount شده و silently boot می‌شه ولی هیچ کامپوننتی مصرفش نمی‌کنه. وصل‌کردن UI به کرنل (Terminal/Files/Login) کار فازهای ۱، ۴ و ۵ هست — به‌عمد به تعویق افتاده تا کرنل کامل و تست‌شده باشه (تصمیمی که با کاربر هماهنگ شد: 2026-08-01).

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

## فاز ۰ — هسته‌ی معماری (Core Kernel) ✅ تکمیل‌شده (2026-08-01)

اینجا پایه‌ی همه‌چیزه. یه ماژول مستقل (`src/os/`) که هیچ وابستگی به React نداره و واحد-تست شده (vitest، ۴۳ تست پاس).

- [x] **VFS (Virtual File System):** `src/os/vfs/Vfs.ts` — درخت inode (file/dir/symlink، content، owner/group/mode، mtime/ctime). API: `stat/list/exists/mkdir/touch/readFile/writeFile/remove/move/copy/chmod/chown/sizeOf` + `resolve()` برای مسیرهای نسبی/`~`/`..`. Persistence از طریق `PersistenceAdapter` تزریق‌شدنی (`IndexedDbAdapter` تو مرورگر، `MemoryAdapter` تو تست‌ها).
- [x] **Command Registry:** `src/os/shell/registry.ts` — `Map<name, handler>` ساده؛ هر دستور یه فایل جدا (`shell/commands/basic.ts`)، نه `switch`.
- [x] **Bash Parser:** `src/os/shell/parser.ts` + `expand.ts` + `glob.ts` — توکنایزر با quoting (تک/دابل)، `|`، `>`/`>>`، `&&`/`||`/`;`، `$VAR`/`${VAR}` expansion، `*`/`?` glob روی VFS.
- [x] **Process Manager:** `src/os/process/ProcessManager.ts` — پروسه‌های پایه‌ی فیک (init, systemd, gnome-shell, bash...) + `spawn/kill/list/uptimeSeconds`.
- [x] **User & Permission System:** `src/os/users/Users.ts` + `src/os/permissions.ts` — کاربرهای seed‌شده (root/bitx/guest)، گروه‌ها، auth با هش (غیررمزنگاری، فقط شبیه‌سازی)، `canAccess()` مبتنی بر rwx که VFS واقعاً موقع read/write/chmod/chown چکش می‌کنه.
- [x] **Package Database:** `src/os/packages/PackageManager.ts` — کاتالوگ + لیست نصب‌شده، `install/remove/search`.
- [x] **Service Manager:** `src/os/services/ServiceManager.ts` — سرویس‌های فیک (NetworkManager, ssh, cron, docker...) با `start/stop`، و `log()` که موقع بوت رو `/var/log/syslog` می‌نویسه.
- [x] **Settings Store:** `src/os/settings/SettingsStore.ts` — state مرکزی با `get/set/subscribe` + persistence؛ هنوز به UI موجود (تم/والپیپر تو `DesktopContext`) وصل نشده — اون migration کار فاز ۱/۲ هست.
- [x] **Kernel + KernelProvider:** `src/os/Kernel.ts` همه‌ی زیرسیستم‌ها رو می‌سازه و `boot()` می‌کنه؛ `src/os/context/KernelContext.tsx` یه `<KernelProvider>` و `useKernel()` می‌ده. روی `Ubuntu.tsx` mount شده (دور `DesktopProvider`).

**خروجی این فاز (تأیید‌شده با تست):** `src/os/Kernel.test.ts` دقیقاً همون اسمول‌تستی که تو نسخه‌ی قبلی این پلن نوشته بودم رو اجرا می‌کنه — `mkdir /home/bitx/test && ls /home/bitx` — و pass می‌شه. علاوه بر اون: pipe (`cat f | grep x | wc -l`)، redirect/append، wildcard، `$HOME`، `$?`/`&&`/`||`، permission denied بین دو کاربر، و رفتار Package/Process/Settings همه تست دارن.

**محدودیت آگاهانه‌ی این فاز:** فقط ~۱۲ دستور seed شد (`pwd cd ls mkdir touch cat echo rm whoami id grep wc true false`) تا wiring اثبات بشه — نه کل ۷۰ دستوری که تو فاز ۴ لیست شده. `seedMinimalTree()` هم فقط `/home /root /tmp /etc /var/log` رو می‌سازه؛ درخت کامل ریشه مال فاز ۳ هست.

---

## فاز ۳ — فایل‌سیستم واقعی (روی هسته‌ی فاز ۰) ✅ تکمیل‌شده (2026-08-01)

پیاده‌سازی در `src/os/fs/` (`seedRoot.ts`, `etcFiles.ts`, `procFiles.ts`).

- [x] Seed کردن VFS با درخت کامل ریشه: `/bin /boot /dev /etc /home /lib /lib64 /media /mnt /opt /proc /root /run /sbin /srv /sys /tmp /usr /var`
- [x] `/home/bitx/`: Desktop, Documents, Downloads, Music, Pictures, Videos, Projects, Notes, Public, Templates, `.ssh`(0700)، `.config`, `.local`, `.cache`, `.bashrc`, `.profile`. (`root` عمداً این ساب‌دایرکتوری‌های دسکتاپی رو نداره — واقعی‌تره)
- [x] `/etc/`: `passwd, shadow(0600), group, hostname, hosts, resolv.conf, fstab, os-release, issue, sudoers(0440)` + `ssh/sshd_config, systemd/, nginx/`. **`passwd`/`shadow`/`group` واقعاً از `UserStore.list()`/`listGroups()` رندر می‌شن** (`etcFiles.ts`) — نه متن ثابت؛ تست دارم که وقتی یه یوزر جدید اضافه می‌کنی، تو `/etc/passwd` بعدی ظاهر می‌شه.
- [x] `/var/log/`: `auth.log, syslog, kern.log` + `nginx/, apache2/, journal/`. `ServiceManager` موقع بوت واقعاً رو `syslog` می‌نویسه.
- [x] `/proc/`: `cpuinfo, version, mounts` (استاتیک، مثل لینوکس واقعی) + `uptime, meminfo` که **واقعاً پویا هستن** — از طریق `Vfs.registerDynamic()` (قابلیت جدیدی که به VFS اضافه شد: بعضی مسیرها موقع هر `readFile` محتوا رو زنده محاسبه می‌کنن، نه از inode استاتیک). تست دارم که `uptime` بین دو خوندن با فاصله‌ی زمانی واقعاً بیشتر می‌شه.
- [x] `/usr/`: `bin, share, local` — `bin` از روی `PackageManager.list()` در لحظه‌ی boot پر می‌شه (مثلاً `bash`, `apt`, `sshd`).

~~**محدودیت آگاهانه:** sync بین `/usr/bin` و پکیج‌ها فقط موقع seed اولیه انجام می‌شه.~~ **رفع شد در فاز ۴.۸** — `apt install`/`apt remove` حالا واقعاً `/usr/bin` رو sync نگه می‌دارن.

---

## فاز ۴ — ترمینال / Bash (روی Parser + Registry فاز ۰) 🔴 قلب پروژه

به خاطر حجم بالا، به زیرمرحله تقسیم می‌کنم — هر زیرمرحله چند دستور که با هم منطقی مرتبطن:

- [x] **۴‌.۱ Navigation:** `pwd, ls, ls -la, tree, cd, pushd, popd` — `shell/commands/navigation.ts`
- [x] **۴.۲ File ops:** `touch, mkdir, rmdir, rm, cp, mv, ln, cat, less, head, tail, file, stat` — `shell/commands/fileOps.ts`. `ln -s` کار می‌کنه (symlink واقعی به VFS اضافه شد)؛ `ln` بدون `-s` (hard link) عمداً رد می‌شه چون VFS ما مفهوم inode مشترک نداره — به‌جای رفتار غلط، پیغام صریح می‌ده.
- [x] **۴.۳ Search:** `find, locate, grep, which, whereis, type` — `shell/commands/search.ts`. `which`/`type` واقعاً `$PATH` رو تو VFS می‌گردن (نه فیک)؛ `type` بین باینری واقعی (`ls is /usr/bin/ls`) و شل‌بیلتین (`cd is a shell builtin`) درست فرق می‌ذاره چون این‌ها به `/usr/bin` seed‌شده‌ی فاز۳ وصلن.
- [x] **۴.۴ Permission:** `chmod, chown, chgrp, umask` — `shell/commands/permissions.ts`. `chmod` هم عددی (`755`) هم نمادین (`u+x`, `go-w`) رو ساپورت می‌کنه. `chown`/`chgrp` واقعاً چک root بودن می‌کنن (کاربر عادی نمی‌تونه owner فایل خودشو عوض کنه — دقیقاً رفتار واقعی یونیکس). `umask` واقعاً کار می‌کنه: به VFS یه پارامتر `mode` اختیاری برای `mkdir`/`touch` اضافه شد که با `DEFAULT_MODE & ~umask` محاسبه می‌شه، نه فقط یه عدد نمایشی.
- [x] **۴.۵ User:** `whoami, id, groups, passwd, sudo, su` — `shell/commands/user.ts`. `sudo` عمداً یه دستور registry نیست؛ تو `Shell.ts` به‌عنوان یه prefix شل-سطحی پیاده شده (دقیقاً مثل sudo واقعی که خودش builtin نیست، پروسه رو با uid دیگه دوباره اجرا می‌کنه) — فقط برای همون یه دستور uid رو موقت می‌بره root و برمی‌گردونه. `su` تغییر دائمی‌تره (تا وقتی دستی برنگردی). محدودیت آگاهانه: چون هنوز prompt رمز مخفی/چندمرحله‌ای نداریم، `passwd`/`su` بدون رمز واقعی کار می‌کنن — اعتماد از جای دیگه میاد (root/sudoer بودن)، نه از یه رمز که کاربر تایپ کنه.
- [x] **۴.۶ Process:** `ps, top, htop, kill, killall, jobs, bg, fg, nohup` — `shell/commands/process.ts`. `ps`/`kill`/`killall` واقعاً permission چک می‌کنن (فقط owner یا root می‌تونه kill کنه). برای `jobs/bg/fg` یه پارسر واقعی برای `cmd &` اضافه شد (توکن `amp` جدید تو `parser.ts` + فیلد `jobs` رو `ShellContext`) — چون اجرای دستورات ما سینکرونه (نه async واقعی)، پس‌زمینه‌ای‌شدن یعنی دستور فوراً کامل می‌شه ولی به‌عنوان یه job ثبت می‌شه؛ `fg` نتیجه‌ی ذخیره‌شده رو «به فورگراند میاره» و از لیست حذفش می‌کنه. `top`/`htop` چون این ترمینال raw-mode نداره، یه snapshot تک‌باره‌ن نه live-update (مثل `less`/`cat` قبلاً).
- [x] **۴.۷ Network (فیک ولی قانع‌کننده):** `ping, curl, wget, ip, ss, netstat, dig, nslookup, host, whois` — `shell/commands/network.ts`. نکته‌های معماری: (۱) IP فیک از هش دامنه ساخته می‌شه، پس همیشه برای یه دامنه‌ی مشخص همون IP برمی‌گرده (نه رندوم واقعی)؛ (۲) قبل از فیک‌سازی، اول `/etc/hosts` واقعی چک می‌شه — یعنی `host ubuntu` درست از رو فایلی که فاز۳ seed کرده جواب می‌ده، نه یه مسیر جدا؛ (۳) `ss`/`netstat` از رو سرویس‌های *واقعاً فعال* `ServiceManager` می‌سازن (نه یه لیست ثابت) — وقتی `nginx` رو استارت کنی، پورت ۸۰ خودش تو `ss` ظاهر می‌شه. برای رفع تکرار، تابع هش (`djb2Hash`) از `users/hash.ts` به یه فایل مشترک `src/os/hash.ts` منتقل شد.
- [x] **۴.۸ Package:** `apt update/install/remove/search, dpkg` — `shell/commands/packages.ts`. سه نکته: (۱) `apt install/remove/update` واقعاً چک root می‌کنن (بدون `sudo` رد می‌شن — دقیقاً همون sudoer trust که فاز۴.۵ ساخت)؛ (۲) اون گپی که تو یادداشت فاز۳ گذاشته بودم رفع شد: `apt install X` حالا واقعاً فایل باینری تو `/usr/bin` می‌سازه (و `apt remove` پاکش می‌کنه) — تست دارم که `which htop` قبل/بعد نصب واقعاً فرق می‌کنه؛ (۳) نقشه‌ی نام باینری‌ها (`PACKAGE_BINARIES`) از seedRoot.ts به یه فایل مشترک (`packages/binaries.ts`) منتقل شد تا seed اولیه و نصب زنده هیچ‌وقت از هم جدا نیفتن.
- [x] **۴.۹ Disk:** `df, du, mount, umount, lsblk` — `shell/commands/disk.ts`. حجم‌ها از `Vfs.sizeOf()` واقعیه (فقط ظرفیت کل دیسک فیکه چون بلاک‌دیوایس واقعی نداریم). `mount`(بدون آرگومان) از `/proc/mounts` واقعی می‌خونه. یه باگ واقعی موقع تست دستی پیدا شد: `du -sh` (فلگ‌های ترکیبی) اصلاً کار نمی‌کرد چون `df`/`du` به‌جای الگوی صحیحی که بقیه‌ی دستورات داشتن، از تطبیق دقیق (`args.includes('-h')`) استفاده کرده بودن. یه هلپر مشترک `flagChars()` ساختم و تو ۶ فایل دیگه هم (`basic, fileOps, network, permissions, search`) همین الگو رو یکدست کردم تا این باگ جای دیگه‌ای هم پنهان نمونده باشه.
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
- [x] **Terminal:** از فاز ۴ به بعد به‌صورت تدریجی وصل می‌شه، نه یک‌جا آخر. `TerminalApp.tsx` از ۲۰۲۶-۰۸-۰۱ دیگه هیچ FS فیک جدایی نداره — مستقیماً `kernel.shell.run()` صدا می‌زنه. با اضافه‌شدن هر زیرمرحله‌ی فاز۴، دستورات جدید خودکار همینجا هم در دسترس می‌شن.
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
- **2026-08-01:** فاز ۰ (هسته‌ی معماری) کامل پیاده‌سازی شد در `src/os/` — VFS، User/Permission، Process، Package، Service، Settings، Bash Parser، Command Registry، Shell، Kernel، KernelProvider. `vitest` اضافه شد (۴۳ تست، همه پاس). `tsc -b`، `vite build`، و بیلد/اجرای داکر هم تأیید شدن که چیزی نشکسته. قدم بعدی فاز ۳ (فایل‌سیستم واقعی) هست.
- **2026-08-01:** کاربر بعد از دیدن لوکال‌هاست متوجه شد فاز ۰ چیزی از نظر ظاهری تغییر نمی‌ده (چون کاملاً نامرئیه — فقط موتور پشت‌صحنه‌ست). بین سه گزینه («وصل کردن سریع ترمینال»، «چک با DevTools»، «صبر و ادامه‌ی ترتیب پلن») گزینه‌ی سوم رو انتخاب کرد؛ یعنی وصل‌شدن UI به کرنل عمداً به فازهای ۱/۴/۵ موکول می‌مونه.
- **2026-08-01:** فاز ۳ (فایل‌سیستم واقعی) کامل شد در `src/os/fs/` — درخت کامل ریشه، `/etc/passwd|shadow|group` از UserStore رندر می‌شن، `/var/log` واقعی، `/proc/uptime` و `/proc/meminfo` از طریق قابلیت جدید `Vfs.registerDynamic()` واقعاً زنده‌ن، `/usr/bin` از PackageManager پر می‌شه. ۱۳ تست جدید (جمعاً ۵۶ تست) پاس؛ `tsc -b`، build، و داکر هم تأیید شدن. قدم بعدی فاز ۴ (ترمینال کامل، ~۷۰ دستور) هست.
- **2026-08-01:** فاز ۴.۱ (Navigation) و ۴.۲ (File ops) پیاده شدن — `shell/commands/navigation.ts` (`pwd cd ls tree pushd popd`) و `shell/commands/fileOps.ts` (`touch mkdir rmdir rm cp mv ln cat less head tail file stat`). به این مناسبت به VFS متد `symlink()` و به ShellContext فیلد `dirStack` اضافه شد. `basic.ts` تریم شد (فقط echo/whoami/id/grep/wc/true/false موندن، چون مال زیرمرحله‌های بعدی‌ان). ۱۳ تست جدید (جمعاً ۶۹ تست) پاس؛ `tsc -b`، build، داکر هم تأیید شدن. قدم بعدی ۴.۳+۴.۴ (Search + Permission) هست.
- **2026-08-01:** کاربر تو مرورگر خودش `tree` رو تست کرد و طبیعتاً "command not found" گرفت چون `TerminalApp.tsx` هنوز به FS فیک قدیمی وصل بود، نه کرنل جدید. تصمیم گرفتیم به‌جای صبر تا آخر فاز ۴، از همین الان UI رو مرحله‌به‌مرحله وصل نگه داریم. `TerminalApp.tsx` بازنویسی شد: دیگه هیچ منطق FS/دستور خودش رو نداره، مستقیماً `useKernel()` + `kernel.shell.run()` صدا می‌زنه؛ پرامپت واقعی از `ctx.cwd`/`/etc/hostname` خونده می‌شه؛ `clear/exit/help` سه‌تا فرمان UI-level باقی موندن (بستن پنجره و لیست‌کردن `registry.list()` کار کرنل نیست). با Playwright (نصب موقت `playwright-core`، بعد پاک شد) واقعاً تو کروم هدلس لاگین کردم، ترمینال رو باز کردم، و `pwd/mkdir -p/tree/ls -la/cd&&pwd/echo>+cat/ln -s+ls -l` رو زدم — همه‌چیز درست کار کرد (اسکرین‌شات گرفته شد، صفر خطای کنسول). دستورات قدیمی `date/uname/hostname/neofetch/apt/sudo` که تو کرنل هنوز پیاده نشدن عمداً برنگشتن — منتظر زیرمرحله‌ی واقعی‌شون می‌مونیم. ۶۹ تست vitest، `tsc -b`، build، داکر همه سبز.
- **2026-08-01:** فاز ۴.۳ (Search) و ۴.۴ (Permission) پیاده شدن. `ShellContext` یه فیلد `registry` گرفت (برای `type`/`which` که باید بدونن یه اسم دستور واقعاً ثبت‌شده یا نه). یه باگ واقعی تو تست خودم پیدا شد نه تو کد: فرض کرده بودم کاربر عادی می‌تونه `chown` بزنه؛ ولی رفتار واقعی یونیکس (که کد درست پیاده‌ش کرده بود) اینه که فقط root اجازه داره owner عوض کنه — تست رو اصلاح کردم، نه کد رو. برای رفع تکرار، یه `commands/util.ts` مشترک (`homeOf`/`errMsg`/`modeWithUmask`) ساختم و navigation/fileOps رو بهش وصل کردم. دوباره با Playwright تو مرورگر واقعی `find/which/type/chmod(عددی+نمادین)/umask` رو زدم — همه درست کار کرد، از جمله اینکه `sudo` هنوز عمداً "command not found" می‌ده (چون فاز۴.۵ هنوز نرسیده). ۸۳ تست vitest، `tsc -b`، build، داکر همه سبز.
- **2026-08-01:** فاز ۴.۵ (User) پیاده شد — `groups/passwd/su` تو `shell/commands/user.ts`، و `sudo` به‌عنوان prefix تو خود `Shell.ts` (نه یه دستور جدا) که فقط برای یه دستور uid رو موقت می‌بره root. اول یه باگ منطقی تو خود `su` پیدا و رفع کردم (شرط برعکس نوشته بودم که باعث می‌شد حتی خودِ اجازه‌دار هم نتونه به root سوییچ کنه). موقع تست دستی تو مرورگر واقعی (طبق درخواست صریح کاربر «قبل از تموم کردن تست بگیر») یه باگ واقعی دیگه هم تو UI پیدا شد: `TerminalApp.tsx` برای پرامپت زنده‌ی پایین (خط هنوز تایپ‌نشده) از یه ثابت هاردکد `CURRENT_USER='bitx'` استفاده می‌کرد نه از `shellCtx.currentUser` واقعی، پس بعد `su root` هنوز اسم «bitx» نشون می‌داد. رفعش کردم و دوباره تو مرورگر تأیید شد (`root@ubuntu:~$` درست نشون می‌ده). ۹۲ تست vitest، `tsc -b`، build، داکر همه سبز.
- **2026-08-01:** فاز ۴.۶ (Process) پیاده شد — `shell/commands/process.ts` + یه پارسر واقعی برای `cmd &` (توکن `amp` جدید، فیلد `background` رو `Statement`، فیلد `jobs` رو `ShellContext`). چون shell ما سینکرونه، پس‌زمینه‌ای‌شدن یعنی «فوراً اجرا کن ولی به‌عنوان job ثبتش کن» — رفتار صادقانه‌ست، وانمود نمی‌کنه واقعاً async باشه. `ps`/`kill`/`killall` permission چک می‌کنن (owner-only یا root). با Playwright دوباره تو مرورگر واقعی تست شد: `ps`, `ps aux`, `top`, `echo x &` → `jobs` → `fg %1`، `kill`/`sudo killall`، `nohup` — همه درست. ۱۰۱ تست vitest، `tsc -b`، build، داکر همه سبز.
- **2026-08-01:** فاز ۴.۷ (Network) پیاده شد — `shell/commands/network.ts`. مهم‌ترین تصمیم معماری: هیچی رندوم محض نیست — IP فیک از هش دامنه میاد (پس ثابته)، و قبل از فیک‌سازی اول `/etc/hosts` واقعی (که فاز۳ seed کرده) چک می‌شه. `ss`/`netstat` هم از `ServiceManager` واقعی می‌خونن، نه یه لیست هاردکد — تست دارم که نشون می‌ده وقتی `nginx` رو استارت می‌کنی، پورتش خودش تو `ss` ظاهر می‌شه. تابع هش مشترک (`djb2Hash`) رو از `users/hash.ts` به `src/os/hash.ts` منتقل کردم تا هم رمزها هم IPهای فیک از یه پیاده‌سازی استفاده کنن. با Playwright تو مرورگر واقعی `ping/host/dig/nslookup/curl/wget/ip/ss/whois` همه تست و تأیید شدن. ۱۰۹ تست vitest، `tsc -b`، build، داکر همه سبز.
- **2026-08-01:** فاز ۴.۸ (Package) پیاده شد — `shell/commands/packages.ts`. همون گپی که تو یادداشت فاز۳ مونده بود رو جبران کردم: `apt install`/`apt remove` حالا واقعاً `/usr/bin` رو sync نگه می‌دارن (تست دارم که `which htop` قبل و بعد نصب واقعاً فرق می‌کنه). `apt install/remove/update` هم مثل واقعیت فقط با root/sudo کار می‌کنن. برای جلوگیری از دوباره‌کاری، نقشه‌ی نام باینری‌ها (که قبلاً فقط تو `seedRoot.ts` بود) به یه فایل مشترک `packages/binaries.ts` منتقل شد. با Playwright تو مرورگر واقعی کل چرخه رو زدم: نصب بدون root رد شد، با `sudo` نصب شد، `which`/`htop`(که خودش از فاز۴.۶ میاد) واقعاً کار کرد، حذف هم واقعاً باینری رو پاک کرد، و حذف `bash` (پکیج ضروری) درست رد شد. ۱۱۶ تست vitest، `tsc -b`، build، داکر همه سبز.
- **2026-08-01:** فاز ۴.۹ (Disk) پیاده شد — `shell/commands/disk.ts` (df/du/mount/umount/lsblk، حجم‌ها واقعاً از `Vfs.sizeOf()`). موقع تست دستی تو مرورگر واقعی یه باگ واقعی پیدا شد: `du -sh` (فلگ ترکیبی) کار نمی‌کرد چون کد از تطبیق دقیق رشته به‌جای بررسی تک‌تک کاراکترهای فلگ استفاده می‌کرد. یه هلپر مشترک `flagChars()` تو `commands/util.ts` ساختم و همین الگوی درست رو تو ۶ فایل دیگه (`basic, fileOps, network, permissions, search`) هم یکدست کردم — چون همون باگ می‌تونست همه‌جا پنهان باشه، نه فقط تو disk.ts. یه تست regression مخصوص این باگ هم اضافه شد. ۱۲۴ تست vitest، `tsc -b`، build، داکر همه سبز.

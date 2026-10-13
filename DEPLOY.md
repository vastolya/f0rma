# Деплой сайта «Форма» на VPS

Пошаговая инструкция: как развернуть сайт на чистом сервере, подключить домен
и HTTPS, а потом обновлять его одной командой.

| Что | Значение |
|---|---|
| Репозиторий | https://github.com/vastolya/f0rma.git, ветка `master` |
| Домен | `f0rma.art` (и `www.f0rma.art` с редиректом на основной) |
| Сервер | Timeweb Cloud, IP `129.101.113.49`, Ubuntu |
| Стек | Next.js 16 → Node.js 22 → PM2 → Nginx → Let's Encrypt |
| Папка на сервере | `/var/www/forma` |
| Порт приложения | `3000` (наружу не открыт, только через Nginx) |

Как это работает: Node.js собирает и запускает сайт, **PM2** держит его
включённым и поднимает после перезагрузки сервера, **Nginx** принимает запросы
из интернета и передаёт их сайту, **Certbot** выдаёт бесплатный
HTTPS-сертификат и сам его продлевает.

Все команды на сервере выполняются от `root`. Блоки, помеченные
«на своём компьютере», запускаются в PowerShell на Windows.

> **Вставляй команды по одной строке** или маленькими блоками без комментариев
> `#`. Если вставить большой кусок сразу, следующие строки попадают в вопросы
> программ (`ufw enable` ловит строку вместо ответа `y` и отменяется) или
> теряют первые буквы (`apt` превращается в `pt`).

---

## Содержание

1. [Сервер в панели Timeweb](#1-сервер-в-панели-timeweb)
2. [DNS: направить домен на сервер](#2-dns-направить-домен-на-сервер)
3. [Подключение по SSH](#3-подключение-по-ssh)
4. [Подготовка сервера](#4-подготовка-сервера)
5. [Код и переменные окружения](#5-код-и-переменные-окружения)
6. [Сборка и запуск через PM2](#6-сборка-и-запуск-через-pm2)
7. [Nginx](#7-nginx)
8. [HTTPS](#8-https)
9. [Яндекс Вебмастер и Google Search Console](#9-яндекс-вебмастер-и-google-search-console)
10. [Обновление сайта](#10-обновление-сайта)
11. [Как добавить новую работу](#11-как-добавить-новую-работу)
12. [Вход по SSH-ключу вместо пароля](#12-вход-по-ssh-ключу-вместо-пароля)
13. [Если что-то сломалось](#13-если-что-то-сломалось)
14. [Шпаргалка](#14-шпаргалка)

---

## 1. Сервер в панели Timeweb

- **Образ:** Ubuntu 24.04 или 26.04 LTS. На 26.04 проверено: NodeSource
  ставит Node 22 без проблем.
- **Ресурсы:** 2 ГБ памяти и 30 ГБ диска хватает с запасом.
- **Файрвол Timeweb.** Раздел «Сеть» → «Firewall» (или «Сетевая
  безопасность»). Если к серверу привязан файрвол, в нём должны быть разрешены
  **входящие TCP 22, 80 и 443**. Иначе не пустит ни SSH, ни сайт: сервер будет
  отвечать на пинг, а все порты будут закрыты.
- **Пароль root** — во вкладке сервера в панели или в письме от Timeweb.

> После создания или переустановки ОС SSH поднимается через 5–10 минут.
> Если `ssh` сразу отвечает `Connection timed out`, подожди.

---

## 2. DNS: направить домен на сервер

В панели регистратора, где куплен `f0rma.art` (или в DNS Timeweb, если домен
делегирован туда), должны быть такие записи:

| Тип | Имя | Значение |
|---|---|---|
| A | `@` | `129.101.113.49` |
| A | `www` | `129.101.113.49` |

Остальные A-записи для `@` и `www` (например, на IP заглушки регистратора)
удали. Почту (MX-записи), если она есть, не трогай.

Проверка (на своём компьютере):

```powershell
nslookup f0rma.art 8.8.8.8
nslookup www.f0rma.art 8.8.8.8
```

В ответе должен быть `129.101.113.49`. Обновление занимает от нескольких минут
до нескольких часов. Шаги 3–7 можно делать, пока DNS обновляется, а шаг 8
(HTTPS) — только после.

---

## 3. Подключение по SSH

На своём компьютере:

```powershell
ssh root@129.101.113.49
```

- При первом входе появится вопрос про fingerprint — ответь `yes`.
- Введи пароль. Символы при вводе не отображаются, это нормально.

**Если `Connection timed out` или `Connection refused`:**

1. Подожди 5–10 минут, если сервер только что создан.
2. Проверь файрвол Timeweb (раздел 1).
3. Зайди через **веб-консоль** в панели Timeweb («Консоль», иконка монитора) и
   проверь, запущен ли SSH:
   ```bash
   systemctl status ssh
   # если не активен или не установлен:
   apt update && apt install -y openssh-server
   systemctl enable --now ssh
   ```
4. Попробуй другую сеть, например раздачу с телефона: некоторые провайдеры и
   рабочие Wi-Fi блокируют порт 22.

Проверить порт со своего компьютера:

```powershell
Test-NetConnection 129.101.113.49 -Port 22
```

`TcpTestSucceeded : True` — порт открыт.

---

## 4. Подготовка сервера

### 4.1. Обновления и нужные пакеты

```bash
apt update && apt upgrade -y
apt install -y git nginx curl ufw
```

Если `apt upgrade` спросит про конфиги — жми Enter (оставить текущие).
Если попросит перезагрузку — `reboot`, через минуту зайди снова.

### 4.2. Swap

Сборка Next.js на 2 ГБ памяти может упасть с нехваткой памяти. Swap — это
страховка:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h   # в строке Swap должно быть 2.0Gi
```

### 4.3. Node.js 22 и PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v   # v22.x.x
npm -v
```

### 4.3.1. Сеть до npm (обязательно на Timeweb)

С серверов Timeweb официальный реестр `registry.npmjs.org` может быть
недоступен: `npm ci` и `npm install -g pm2` висят или падают с `ETIMEDOUT`,
а `curl https://registry.npmjs.org/` не отвечает. Поэтому пакеты ставим через
зеркало реестра. Это безопасно: в `package-lock.json` записаны контрольные
суммы, и npm проверит каждый скачанный пакет.

Настраивается один раз, **до** установки PM2 и `npm ci`. Команды по одной:

```bash
npm config set registry https://registry.npmmirror.com
npm config set fetch-retries 5
npm config set fetch-retry-maxtimeout 120000
npm config set fetch-timeout 600000
echo 'export NODE_OPTIONS=--dns-result-order=ipv4first' >> ~/.bashrc
export NODE_OPTIONS=--dns-result-order=ipv4first
```

Проверка доступности (у каждого запроса таймаут 15 секунд):

```bash
curl -m 15 -sS -o /dev/null -w "npmjs: %{http_code}\n" https://registry.npmjs.org/
curl -m 15 -sS -o /dev/null -w "mirror: %{http_code}\n" https://registry.npmmirror.com/
curl -m 15 -sS -o /dev/null -w "google fonts: %{http_code}\n" "https://fonts.googleapis.com/css2?family=Oswald"
```

Зеркало (`mirror`) должно отвечать `200`. Google Fonts нужен для
`npm run build`: Next скачивает шрифты во время сборки.

Если официальный реестр снова станет доступен, вернуть его можно командой
`npm config delete registry`.

### 4.3.2. PM2

Только после настройки зеркала, иначе установка может зависнуть:

```bash
npm install -g pm2
pm2 -v
```

> Если скрипт NodeSource ругается на версию Ubuntu (бывает на 26.04),
> поставь Node из стандартных репозиториев: `apt install -y nodejs npm` и
> проверь `node -v`. Next.js 16 нужен Node **20.9 или новее**.

### 4.4. Файрвол на самом сервере

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

> **Важно:** сначала `ufw allow OpenSSH`, потом `ufw --force enable`. В обратном
> порядке файрвол отрежет текущее SSH-подключение.

---

## 5. Код и переменные окружения

### 5.1. Клонирование

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/vastolya/f0rma.git forma
cd forma
```

**Если репозиторий приватный**, git спросит логин и пароль. Вместо пароля
нужен токен:

1. GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token.
2. Repository access → Only select repositories → `f0rma`.
3. Permissions → Contents → **Read-only**.
4. При `git clone` логин — твой ник на GitHub, пароль — этот токен.

Чтобы не вводить токен при каждом `git pull`:

```bash
git config --global credential.helper store
```

После следующего успешного ввода git его запомнит.

### 5.2. Переменные окружения

> **Важно:** переменные `NEXT_PUBLIC_*` зашиваются в сайт **во время
> сборки**. После любой правки `.env.production` сайт нужно пересобрать
> (раздел 10).

```bash
nano /var/www/forma/.env.production
```

Содержимое:

```
NEXT_PUBLIC_SITE_URL=https://f0rma.art
NEXT_PUBLIC_YANDEX_VERIFICATION=
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
```

| Переменная | Зачем |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Основной адрес. Из него строятся canonical-ссылки, `sitemap.xml`, `robots.txt` и превью для соцсетей. Без слеша в конце. |
| `NEXT_PUBLIC_YANDEX_VERIFICATION` | Код подтверждения из Яндекс Вебмастера (раздел 9). Можно оставить пустым. |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Код из Google Search Console (раздел 9). Можно оставить пустым. |

Сохранить в nano: `Ctrl+O`, `Enter`; выйти: `Ctrl+X`.

Файл `.env.production` в git не попадает (так настроен `.gitignore`) и живёт
только на сервере.

---

## 6. Сборка и запуск через PM2

```bash
cd /var/www/forma
npm ci
npm run build
```

`npm ci` ставит зависимости ровно по `package-lock.json`. Сборка занимает
1–3 минуты. В конце будет таблица маршрутов (`/`, `/works`, `/sitemap.xml`
и т. д.) без ошибок.

Запуск:

```bash
pm2 start npm --name forma -- start
pm2 status            # статус forma должен быть online
curl -I http://localhost:3000   # HTTP/1.1 200 OK
```

Автозапуск после перезагрузки сервера:

```bash
pm2 save
pm2 startup
```

`pm2 startup` выведет команду, которая начинается с `sudo env PATH=...` —
скопируй её и выполни.

Ограничить размер логов, чтобы они не забили диск:

```bash
pm2 install pm2-logrotate
```

---

## 7. Nginx

### 7.1. Конфиг сайта

```bash
nano /etc/nginx/sites-available/forma
```

Вставь:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name f0rma.art www.f0rma.art;

    # Сжатие текста — быстрее загрузка, лучше оценка скорости в поисковиках.
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json
               image/svg+xml application/xml application/manifest+json
               model/gltf-binary;

    # Статика сборки: в именах файлов хеш, поэтому кешируем навсегда.
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 7.2. Включение

```bash
ln -s /etc/nginx/sites-available/forma /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t                  # должно быть: syntax is ok / test is successful
systemctl reload nginx
```

Проверка: открой в браузере `http://129.101.113.49` — должен открыться сайт.

---

## 8. HTTPS

> Только после того, как `nslookup f0rma.art 8.8.8.8` показывает
> `129.101.113.49` (раздел 2). Иначе Let's Encrypt не сможет проверить домен.

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d f0rma.art -d www.f0rma.art
```

- Certbot попросит почту — на неё придут предупреждения, если что-то пойдёт
  не так с продлением.
- Нужно согласиться с условиями (`Y`).
- Если спросит про редирект на HTTPS — выбери **редирект**. Новые версии
  включают его сами.

Проверить автопродление:

```bash
certbot renew --dry-run
```

### 8.1. Редирект www → основной домен

Иначе для поисковиков это будут два разных сайта-зеркала.

```bash
nano /etc/nginx/sites-available/forma
```

Найди блок `server`, в котором есть `listen 443 ssl` (его добавил certbot), и
**перед** `location /_next/static/` вставь строку:

```nginx
    if ($host = www.f0rma.art) { return 301 https://f0rma.art$request_uri; }
```

```bash
nginx -t && systemctl reload nginx
```

Проверка на своём компьютере:

```powershell
curl.exe -I https://www.f0rma.art
```

Должно быть `301` и `Location: https://f0rma.art/`.

### 8.2. Финальная проверка

Открой в браузере — все адреса должны работать по HTTPS:

- https://f0rma.art
- https://f0rma.art/works
- https://f0rma.art/sitemap.xml — ссылки внутри должны начинаться с `https://f0rma.art`
- https://f0rma.art/robots.txt
- https://f0rma.art/opengraph-image — картинка-превью

Превью ссылки удобно проверить, отправив `https://f0rma.art` себе в Telegram.

---

## 9. Яндекс Вебмастер и Google Search Console

### Яндекс

1. https://webmaster.yandex.ru → «Добавить сайт» → `https://f0rma.art`.
2. Способ подтверждения — **«Мета-тег»**. Из тега
   `<meta name="yandex-verification" content="abc123..." />` скопируй только
   значение `content`.

### Google

1. https://search.google.com/search-console → «Добавить ресурс» →
   **«Префикс URL»** → `https://f0rma.art`.
2. Способ — **«Тег HTML»**, тоже скопируй значение `content`.

### На сервере

```bash
nano /var/www/forma/.env.production
```

```
NEXT_PUBLIC_YANDEX_VERIFICATION=abc123...
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=xyz789...
```

Пересобери сайт (раздел 10), потом нажми «Проверить» в обоих сервисах.

### После подтверждения

- В обоих сервисах отправь карту сайта: `https://f0rma.art/sitemap.xml`.
- В Яндекс Вебмастере: «Индексирование» → «Переобход страниц» — добавь главную
  и `/works`.
- Заведи карточки организации в **Яндекс Бизнесе**, **Google Business
  Profile** и **2ГИС** со ссылкой на сайт. Для запросов «…в Красноярске»
  это даёт больше, чем любые правки кода.

---

## 10. Обновление сайта

На своём компьютере: закоммить и запушь изменения в `master`.

```powershell
git add .
git commit -m "Что изменилось"
git push
```

На сервере:

```bash
cd /var/www/forma && git pull && npm ci && npm run build && pm2 reload forma
```

`pm2 reload` перезапускает сайт без простоя.

### Скрипт обновления (один раз)

```bash
cat > /root/deploy.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
export NODE_OPTIONS=--dns-result-order=ipv4first
cd /var/www/forma
git pull --ff-only
npm ci
npm run build
pm2 reload forma
echo "Готово: $(git log -1 --format='%h %s')"
EOF
chmod +x /root/deploy.sh
```

После этого обновление — одна команда со своего компьютера:

```powershell
ssh root@129.101.113.49 /root/deploy.sh
```

`set -e` останавливает скрипт на первой ошибке. Если сборка упадёт, PM2
продолжит отдавать старую версию сайта.

---

## 11. Как добавить новую работу

1. Фотографии положи в `public/media/<slug>/` — например
   `public/media/ledyanoy-angel-2026/01.jpg`, `02.jpg`… Первая фотография —
   обложка. Подойдёт ширина 960–1600 px, JPG.
2. В `src/data/works.json` добавь объект по образцу существующих:
   - `slug` — адрес страницы латиницей через дефис, он же имя папки с фото;
   - `status` — `"realized"` (реализовано) или `"concept"` (концепция);
   - `city` и `coords` (`[долгота, широта]`) — чтобы работа появилась на карте;
   - `cover` и `media` — пути к фото, их `width`/`height` в пикселях и `alt`
     (короткое описание того, что на фото: его читают поисковики и
     незрячие пользователи);
   - `excerpt`, `description`, `specs`, при наличии — `award` и `client`.
3. Проверь локально: `npm run dev` → http://localhost:3000.
4. Закоммить, запушь и обнови сервер (раздел 10).

Страница работы, метка на карте, `sitemap.xml` и разметка для поисковиков
обновятся сами.

Узнать размеры фото в PowerShell:

```powershell
Add-Type -AssemblyName System.Drawing
$i = [System.Drawing.Image]::FromFile("C:\путь\к\01.jpg"); "$($i.Width)x$($i.Height)"; $i.Dispose()
```

---

## 12. Вход по SSH-ключу вместо пароля

Пароль root на открытом сервере постоянно подбирают боты. Ключ надёжнее и
избавляет от ввода пароля.

**На своём компьютере** (PowerShell):

```powershell
ssh-keygen -t ed25519 -C "f0rma-deploy"
# Enter, Enter, Enter — ключ сохранится в C:\Users\<ты>\.ssh\id_ed25519

type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@129.101.113.49 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Пароль спросят последний раз. Проверь, что `ssh root@129.101.113.49` теперь
входит без пароля.

**Только после этого** можно запретить вход по паролю:

```bash
echo 'PasswordAuthentication no' > /etc/ssh/sshd_config.d/99-no-password.conf
systemctl reload ssh
```

> Не закрывай текущую сессию, пока не проверишь вход по ключу из нового окна
> PowerShell. Если что-то пошло не так, доступ останется через веб-консоль
> Timeweb.

---

## 13. Если что-то сломалось

| Симптом | Что делать |
|---|---|
| `502 Bad Gateway` | Сайт не запущен или упал. Смотри `pm2 status` и `pm2 logs forma --lines 100`, потом `pm2 restart forma`. |
| Сборка падает с `JavaScript heap out of memory` | Проверь swap: `free -h`. Если его нет — раздел 4.2. |
| `npm ci` / `npm install` висят или `ETIMEDOUT` | Реестр npm недоступен с сервера — раздел 4.3.1 (зеркало), затем снова `npm ci`. |
| `npm run build`: `next: not found` | Зависимости не установились — предыдущий `npm ci` упал. Почини его и повтори. |
| `ufw enable` → `Aborted` | Используй `ufw --force enable` (правила для SSH уже должны быть добавлены). |
| `npm ci` ругается на версию Node | `node -v` должен быть 20.9+. Переустанови Node (раздел 4.3). |
| Сайт открывается по IP, но не по домену | DNS ещё не обновился или указывает не туда: `nslookup f0rma.art 8.8.8.8`. |
| Certbot: `Timeout during connect` / `unauthorized` | DNS не указывает на сервер, или закрыт порт 80 в файрволе Timeweb или ufw. |
| В `sitemap.xml` адреса с `localhost` или чужим доменом | Неверный `NEXT_PUBLIC_SITE_URL` в `.env.production`. Исправь и пересобери. |
| `git pull`: `Your local changes would be overwritten` | На сервере кто-то правил файлы. Сбросить к версии из GitHub: `git reset --hard origin/master` (сотрёт правки на сервере, `.env.production` не тронет). |
| Нужно откатиться на прошлую версию | `git log --oneline -5`, затем `git reset --hard <хеш>`, `npm ci && npm run build && pm2 reload forma`. Потом исправь ошибку в репозитории. |
| Кончается место на диске | `df -h`; почистить логи: `pm2 flush`, кеш: `npm cache clean --force`. |

Логи:

```bash
pm2 logs forma                 # логи сайта в реальном времени (выход Ctrl+C)
tail -f /var/log/nginx/error.log
journalctl -u nginx --since "1 hour ago"
```

---

## 14. Шпаргалка

```bash
# войти на сервер
ssh root@129.101.113.49

# обновить сайт
/root/deploy.sh

# состояние и логи
pm2 status
pm2 logs forma

# перезапуск
pm2 restart forma
systemctl reload nginx

# проверить конфиг nginx
nginx -t

# продление сертификата (обычно само)
certbot renew
```

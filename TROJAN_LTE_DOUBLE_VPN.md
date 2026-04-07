# Дабл ВПН для Trojan LTE

## Схема работы
1. **РУ нода** - принимает Trojan от клиентов, перенаправляет на евро ноду
2. **Евро нода** - принимает от РУ ноды, выпускает в интернет

---

## 1. Конфиг РУ ноды (Trojan LTE + перенаправление на евро)

```json
{
  "log": {
    "loglevel": "warning"
  },
  "dns": {
    "servers": [
      {
        "address": "https://dns.google/dns-query",
        "domains": [
          "geosite:google",
          "geosite:youtube",
          "youtube.com",
          "googlevideo.com",
          "ytimg.com"
        ],
        "skipFallback": true
      },
      "8.8.8.8",
      "1.1.1.1"
    ],
    "queryStrategy": "UseIPv4"
  },
  "inbounds": [
    {
      "tag": "TROJAN_LTE_INBOUND",
      "listen": "0.0.0.0",
      "port": 479,
      "protocol": "trojan",
      "settings": {
        "clients": [],
        "dns": {
          "servers": [
            "171.22.120.145"
          ]
        }
      },
      "streamSettings": {
        "network": "tcp",
        "tcpSettings": {
          "header": {
            "type": "http",
            "request": {
              "method": "GET",
              "path": [
                "/"
              ],
              "headers": {
                "Host": [
                  "vk.com"
                ]
              }
            },
            "response": {}
          }
        },
        "security": "none"
      },
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls",
          "quic"
        ]
      }
    }
  ],
  "outbounds": [
    {
      "tag": "DIRECT",
      "protocol": "freedom",
      "settings": {
        "domainStrategy": "UseIP"
      }
    },
    {
      "tag": "BLOCK",
      "protocol": "blackhole"
    },
    {
      "tag": "EU_PROXY",
      "protocol": "vless",
      "settings": {
        "vnext": [
          {
            "port": 9999,
            "users": [
              {
                "id": "UUID_ПОЛЬЗОВАТЕЛЯ",
                "flow": "",
                "email": "user@example.com",
                "encryption": "none"
              }
            ],
            "address": "IP_ЕВРО_НОДЫ"
          }
        ]
      },
      "streamSettings": {
        "network": "tcp",
        "security": "none",
        "tcpSettings": {
          "header": {
            "type": "none"
          }
        }
      }
    }
  ],
  "routing": {
    "rules": [
      {
        "ip": [
          "geoip:private"
        ],
        "type": "field",
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "task.moyu88.xyz",
          "moyu88.xyz"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "regexp:.*gosuslugi\\.ru$",
          "regexp:.*esia\\.gosuslugi\\.ru$",
          "regexp:.*gosuslugi\\.ru:443$",
          "regexp:.*nalog\\.ru$",
          "regexp:.*tax\\.gov\\.ru$",
          "regexp:.*pfr\\.gov\\.ru$",
          "regexp:.*sfr\\.gov\\.ru$",
          "regexp:.*rosreestr\\.ru$",
          "regexp:.*gibdd\\.ru$",
          "regexp:.*mvd\\.ru$",
          "regexp:.*minfin\\.ru$",
          "regexp:.*government\\.ru$",
          "regexp:.*kremlin\\.ru$"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "domain:2ip.ru",
          "domain:2ip.io",
          "domain:ipify.org",
          "domain:ipify.com",
          "domain:api.ipify.org",
          "domain:api64.ipify.org",
          "domain:ifconfig.me",
          "domain:ifconfig.co",
          "domain:ifconfig.io",
          "domain:ipinfo.io",
          "domain:ip-api.com",
          "domain:ip-api.io",
          "domain:ipapi.co",
          "domain:ipapi.is",
          "domain:ip.sb",
          "domain:ip.gs",
          "domain:ip.tool.lu",
          "domain:icanhazip.com",
          "domain:ipv4.icanhazip.com",
          "domain:ident.me",
          "domain:checkip.amazonaws.com",
          "domain:myexternalip.com",
          "domain:ipecho.net",
          "domain:whatismyipaddress.com",
          "domain:whatismyip.com",
          "domain:myip.com",
          "domain:iplocation.net",
          "domain:wtfismyip.com",
          "domain:whoer.net",
          "domain:hidemy.name",
          "domain:browserleaks.com",
          "domain:ipleak.net",
          "domain:dnsleaktest.com",
          "domain:ip.mail.ru",
          "domain:ipv4-internet.yandex.net",
          "domain:ipv6-internet.yandex.net",
          "domain:app-measurement.com",
          "domain:crashlytics.com",
          "domain:firebase-settings.crashlytics.com",
          "domain:firebaselogging.googleapis.com",
          "domain:firebaselogging-pa.googleapis.com",
          "domain:firebaseinstallations.googleapis.com",
          "domain:appmetrica.yandex.net",
          "domain:mc.yandex.ru",
          "domain:mobile.yandex.net",
          "domain:proxy.mob.maps.yandex.net",
          "domain:api.mindbox.ru",
          "domain:web-static.mindbox.ru",
          "domain:app-analytics-services.com"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "ip": [
          "46.165.199.7"
        ],
        "type": "field",
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "lp.xl-ads.com",
          "xl-ads.com",
          "geosite:category-ads-all"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "geosite:private"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "protocol": [
          "bittorrent"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "ip": [
          "geoip:ru"
        ],
        "type": "field",
        "outboundTag": "DIRECT"
      },
      {
        "type": "field",
        "domain": [
          "geosite:category-ru"
        ],
        "outboundTag": "DIRECT"
      },
      {
        "type": "field",
        "domain": [
          "domain:yookassa.ru",
          "domain:habr.com",
          "domain:4pda.to",
          "domain:4pda.ru",
          "domain:t-bank-app.ru",
          "domain:t-static.ru",
          "domain:tinkoff.ru",
          "domain:tbank.ru",
          "domain:sberbank.ru",
          "domain:sber.ru",
          "domain:vtb.ru",
          "domain:vtb24.ru",
          "domain:alfabank.ru",
          "domain:alfabank.com",
          "domain:raiffeisen.ru",
          "domain:pochtabank.ru",
          "domain:psbank.ru",
          "domain:rncb.ru",
          "domain:homecredit.ru",
          "domain:otpbank.ru",
          "domain:uralsib.ru",
          "domain:rosbank.ru",
          "domain:open.ru",
          "domain:gazprombank.ru",
          "domain:rosselkhozbank.ru",
          "domain:rshb.ru",
          "domain:taximaster.ru",
          "domain:bitmaster.ru",
          "domain:i2872.tm.taxi"
        ],
        "outboundTag": "DIRECT"
      },
      {
        "type": "field",
        "inboundTag": [
          "TROJAN_LTE_INBOUND"
        ],
        "outboundTag": "EU_PROXY"
      }
    ],
    "domainStrategy": "IPIfNonMatch"
  },
  "policy": {
    "levels": {
      "0": {
        "connIdle": 300,
        "handshake": 15,
        "uplinkOnly": 2,
        "downlinkOnly": 4,
        "statsUserUplink": true,
        "statsUserDownlink": true
      }
    },
    "system": {
      "statsInboundUplink": true,
      "statsInboundDownlink": true
    }
  },
  "stats": {}
}
```

---

## 2. Конфиг евро ноды (принимает от РУ ноды)

```json
{
  "log": {
    "error": "/var/log/xray/error.log",
    "access": "/var/log/xray/access.log",
    "loglevel": "none"
  },
  "dns": {
    "servers": [
      {
        "address": "https://dns.google/dns-query",
        "domains": [
          "geosite:google",
          "geosite:youtube",
          "youtube.com",
          "googlevideo.com",
          "ytimg.com"
        ],
        "skipFallback": true
      },
      "8.8.8.8",
      "1.1.1.1"
    ],
    "queryStrategy": "UseIPv4"
  },
  "inbounds": [
    {
      "tag": "EU_INBOUND",
      "port": 9999,
      "listen": "0.0.0.0",
      "protocol": "vless",
      "settings": {
        "clients": [],
        "decryption": "none"
      },
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls"
        ]
      },
      "streamSettings": {
        "network": "tcp",
        "security": "none",
        "tcpSettings": {
          "header": {
            "type": "none"
          }
        }
      }
    }
  ],
  "outbounds": [
    {
      "tag": "DIRECT",
      "protocol": "freedom"
    },
    {
      "tag": "PROXY",
      "protocol": "freedom"
    },
    {
      "tag": "BLOCK",
      "protocol": "blackhole"
    }
  ],
  "routing": {
    "rules": [
      {
        "ip": [
          "geoip:private"
        ],
        "type": "field",
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "task.moyu88.xyz",
          "moyu88.xyz"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "regexp:.*gosuslugi\\.ru$",
          "regexp:.*esia\\.gosuslugi\\.ru$",
          "regexp:.*gosuslugi\\.ru:443$",
          "regexp:.*nalog\\.ru$",
          "regexp:.*tax\\.gov\\.ru$",
          "regexp:.*pfr\\.gov\\.ru$",
          "regexp:.*sfr\\.gov\\.ru$",
          "regexp:.*rosreestr\\.ru$",
          "regexp:.*gibdd\\.ru$",
          "regexp:.*mvd\\.ru$",
          "regexp:.*minfin\\.ru$",
          "regexp:.*government\\.ru$",
          "regexp:.*kremlin\\.ru$"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "domain:2ip.ru",
          "domain:2ip.io",
          "domain:ipify.org",
          "domain:ipify.com",
          "domain:api.ipify.org",
          "domain:api64.ipify.org",
          "domain:ifconfig.me",
          "domain:ifconfig.co",
          "domain:ifconfig.io",
          "domain:ipinfo.io",
          "domain:ip-api.com",
          "domain:ip-api.io",
          "domain:ipapi.co",
          "domain:ipapi.is",
          "domain:ip.sb",
          "domain:ip.gs",
          "domain:ip.tool.lu",
          "domain:icanhazip.com",
          "domain:ipv4.icanhazip.com",
          "domain:ident.me",
          "domain:checkip.amazonaws.com",
          "domain:myexternalip.com",
          "domain:ipecho.net",
          "domain:whatismyipaddress.com",
          "domain:whatismyip.com",
          "domain:myip.com",
          "domain:iplocation.net",
          "domain:wtfismyip.com",
          "domain:whoer.net",
          "domain:hidemy.name",
          "domain:browserleaks.com",
          "domain:ipleak.net",
          "domain:dnsleaktest.com",
          "domain:ip.mail.ru",
          "domain:ipv4-internet.yandex.net",
          "domain:ipv6-internet.yandex.net",
          "domain:app-measurement.com",
          "domain:crashlytics.com",
          "domain:firebase-settings.crashlytics.com",
          "domain:firebaselogging.googleapis.com",
          "domain:firebaselogging-pa.googleapis.com",
          "domain:firebaseinstallations.googleapis.com",
          "domain:appmetrica.yandex.net",
          "domain:mc.yandex.ru",
          "domain:mobile.yandex.net",
          "domain:proxy.mob.maps.yandex.net",
          "domain:api.mindbox.ru",
          "domain:web-static.mindbox.ru",
          "domain:app-analytics-services.com",
          "lp.xl-ads.com",
          "xl-ads.com",
          "geosite:category-ads-all"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "ip": [
          "46.165.199.7"
        ],
        "type": "field",
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "geosite:private"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "protocol": [
          "bittorrent"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "domain:yookassa.ru",
          "domain:habr.com",
          "domain:4pda.to",
          "domain:4pda.ru",
          "domain:t-bank-app.ru",
          "domain:t-static.ru",
          "domain:tinkoff.ru",
          "domain:tbank.ru",
          "domain:sberbank.ru",
          "domain:sber.ru",
          "domain:vtb.ru",
          "domain:vtb24.ru",
          "domain:alfabank.ru",
          "domain:alfabank.com",
          "domain:raiffeisen.ru",
          "domain:pochtabank.ru",
          "domain:psbank.ru",
          "domain:rncb.ru",
          "domain:homecredit.ru",
          "domain:otpbank.ru",
          "domain:uralsib.ru",
          "domain:rosbank.ru",
          "domain:open.ru",
          "domain:gazprombank.ru",
          "domain:rosselkhozbank.ru",
          "domain:rshb.ru",
          "domain:taximaster.ru",
          "domain:bitmaster.ru",
          "domain:i2872.tm.taxi"
        ],
        "outboundTag": "PROXY"
      },
      {
        "type": "field",
        "inboundTag": [
          "EU_INBOUND"
        ],
        "outboundTag": "PROXY"
      }
    ],
    "domainStrategy": "IPIfNonMatch"
  },
  "policy": {
    "levels": {
      "0": {
        "connIdle": 120,
        "handshake": 4,
        "uplinkOnly": 2,
        "downlinkOnly": 4,
        "statsUserUplink": true,
        "statsUserDownlink": true
      }
    },
    "system": {
      "statsInboundUplink": true,
      "statsInboundDownlink": true
    }
  },
  "stats": {}
}
```

---

## 3. Клиентский конфиг (для подключения к Trojan LTE)

```json
{
  "dns": {
    "tag": "dns_out",
    "servers": [
      {
        "address": "1.1.1.1",
        "skipFallback": false
      },
      {
        "address": "8.8.8.8"
      }
    ],
    "queryStrategy": "IPIfNonMatch"
  },
  "log": {
    "loglevel": "warning"
  },
  "stats": {},
  "policy": {
    "system": {
      "statsOutboundUplink": true,
      "statsOutboundDownlink": true
    }
  },
  "routing": {
    "rules": [
      {
        "domain": [
          "habr.com",
          "4pda.to",
          "4pda.ru",
          "твой_домен"
        ],
        "outboundTag": "proxy"
      },
      {
        "domain": [
          "domain:2ip.io",
          "domain:2ip.ru",
          "domain:ipv4-internet.yandex.net",
          "domain:ipv6-internet.yandex.net",
          "domain:ifconfig.me",
          "domain:api.ipify.org",
          "domain:checkip.amazonaws.com",
          "domain:ip.mail.ru",
          "geosite:category-ru",
          "domain:vk.com",
          "domain:vk.me",
          "domain:userapi.com",
          "domain:vkuser.net",
          "domain:vk-portal.net",
          "domain:ok.ru",
          "domain:okcdn.ru",
          "domain:mycdn.me",
          "domain:yandex.ru",
          "domain:yandex.net",
          "domain:yandex.com",
          "domain:yastatic.net",
          "domain:ya.ru",
          "domain:mail.ru",
          "domain:mradx.net",
          "domain:imgsmail.ru",
          "domain:ivi.ru",
          "domain:rutube.ru",
          "domain:wildberries.ru",
          "domain:ozon.ru",
          "domain:ozon.net",
          "domain:wb.ru",
          "domain:avito.ru",
          "domain:tinkoff.ru",
          "domain:tbank.ru",
          "domain:sberbank.ru",
          "domain:gosuslugi.ru",
          "domain:mos.ru",
          "domain:2gis.ru",
          "domain:dzen.ru",
          "domain:2ip.ru",
          "domain:appmetrica.yandex.net",
          "domain:mobile.yandex.net",
          "domain:doubleclick.net",
          "domain:gu-st.ru",
          "domain:google.g.doubleclick.net"
        ],
        "outboundTag": "direct"
      },
      {
        "ip": [
          "geoip:ru",
          "geoip:private"
        ],
        "outboundTag": "direct"
      },
      {
        "type": "field",
        "domain": [
          "task.moyu88.xyz",
          "moyu88.xyz"
        ],
        "outboundTag": "BLOCK"
      },
      {
        "ip": [
          "46.165.199.7"
        ],
        "type": "field",
        "outboundTag": "BLOCK"
      },
      {
        "type": "field",
        "domain": [
          "lp.xl-ads.com",
          "xl-ads.com",
          "app-analytics-services.com",
          "firebaselogging-pa.googleapis.com",
          "firebase-settings.crashlytics.com"
        ],
        "outboundTag": "block"
      },
      {
        "network": "tcp,udp",
        "outboundTag": "proxy"
      }
    ],
    "domainStrategy": "IPIfNonMatch"
  },
  "inbounds": [
    {
      "tag": "socks",
      "port": 10808,
      "protocol": "socks",
      "settings": {
        "udp": true,
        "auth": "noauth",
        "userLevel": 8
      },
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls",
          "quic",
          "fakedns"
        ]
      }
    },
    {
      "tag": "http",
      "port": 10809,
      "protocol": "http",
      "settings": {
        "userLevel": 8
      }
    }
  ],
  "outbounds": [
    {
      "tag": "direct",
      "protocol": "freedom"
    },
    {
      "tag": "block",
      "protocol": "blackhole"
    },
    {
      "tag": "proxy",
      "protocol": "trojan",
      "settings": {
        "servers": [
          {
            "address": "IP_РУ_НОДЫ",
            "port": 479,
            "password": "PASSWORD_ПОЛЬЗОВАТЕЛЯ",
            "email": "user@example.com"
          }
        ]
      },
      "streamSettings": {
        "network": "tcp",
        "tcpSettings": {
          "header": {
            "type": "http",
            "request": {
              "method": "GET",
              "path": [
                "/"
              ],
              "headers": {
                "Host": [
                  "vk.com"
                ]
              }
            },
            "response": {}
          }
        },
        "security": "none"
      }
    }
  ]
}
```

---

## Настройка

### На РУ ноде:
1. Замени `UUID_ПОЛЬЗОВАТЕЛЯ` на UUID пользователя
2. Замени `IP_ЕВРО_НОДЫ` на IP адрес евро ноды
3. Добавь Trojan пользователя в `clients` инбаунда

### На евро ноде:
1. Добавь VLESS пользователя в `clients` инбаунда (тот же UUID, что на РУ ноде)

### В клиентском конфиге:
1. Замени `IP_РУ_НОДЫ` на IP адрес РУ ноды
2. Замени `PASSWORD_ПОЛЬЗОВАТЕЛЯ` на пароль Trojan пользователя
3. Замени `твой_домен` на свой домен

---

## Как работает

1. Клиент подключается к РУ ноде по Trojan (порт 479)
2. РУ нода проверяет маршрутизацию:
   - Российские сервисы → DIRECT (прямо)
   - Зарубежные сервисы → EU_PROXY (на евро ноду)
3. Трафик идёт на евро ноду по VLESS (порт 9999)
4. Евро нода выпускает трафик в интернет

---

## Генерация UUID

```bash
# Linux/Mac
uuidgen

# Windows PowerShell
[guid]::NewGuid()
```

---

## Генерация пароля для Trojan

```bash
# Linux/Mac
openssl rand -base64 16

# Windows PowerShell
[Convert]::ToBase64String((1..16 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```
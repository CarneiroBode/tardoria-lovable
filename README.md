# ⚔ Tardoria RPG

RPG Multiplayer top-down — Node.js · Socket.io · Phaser.js · PostgreSQL · Dokploy

## Deploy em 4 comandos

```bash
# 1. Extraia o ZIP na pasta do projeto
unzip tardoria.zip -d tardoria
cd tardoria

# 2. Versione e envie
git init
git remote add origin <sua-url-git>
git add .
git commit -m "feat: init Tardoria v1"
git push -u origin main
```

O Dokploy detecta o push e faz deploy automático via webhook. ✅

---

## Configuração no Dokploy

### 1. Criar serviço PostgreSQL
- Tipo: **Database → PostgreSQL 16**
- Database name: `tardoria`
- Copie a **connection string** gerada

### 2. Criar serviço da aplicação
- Tipo: **Application**
- Source: seu repositório Git
- Branch: `main`
- Build: **Dockerfile** (detectado automaticamente)
- Port: `4000`

### 3. Variáveis de ambiente
```
PORT=4000
NODE_ENV=production
DATABASE_URL=<connection string do passo 1>
JWT_SECRET=<string aleatória longa>
```

Gere o JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Domain
- Domain: `tardoria.protalksystem.com`
- Port: `4000`

---

## Desenvolvimento local

```bash
cp .env.example .env
# edite .env com suas configs

# Com Docker (recomendado — sobe app + postgres)
docker compose up

# Sem Docker
npm install
npm run db:migrate
npm run dev
```

Acesse: http://localhost:4000

---

## Assets (Pixel Art Top Down Basic v1.2.3)

Adicione os tilesets em:
```
public/assets/tilesets/
  TX_Tileset_Ground.png
  TX_Tileset_Wall.png
  TX_Tileset_Floor.png
  TX_Props.png
  TX_Tileset_Nature.png
  TX_Tileset_Mountain.png
  TX_Tileset_Ruins.png
  TX_Tileset_Building.png

public/assets/sprites/
  char_01.png   ← spritesheet 16×16, 4 direções × 3 frames

public/assets/maps/
  taverna.tmj
  floresta.tmj
  montanha.tmj
  ruinas.tmj
  cidade.tmj
```

---

## Estrutura

```
tardoria/
├── Dockerfile
├── docker-compose.yml       ← dev local
├── server.js                ← entry point (Express + Socket.io)
├── src/
│   ├── db/
│   │   ├── schema.sql       ← banco criado automaticamente no boot
│   │   ├── db.js            ← pool PostgreSQL
│   │   └── migrate.js       ← runner manual
│   ├── game/
│   │   ├── PlayerManager.js ← estado em memória + sync banco
│   │   └── WorldMap.js      ← 25 salas 5×5
│   └── routes/
│       └── auth.js          ← register / login / me
└── public/
    ├── index.html           ← SPA: auth + HUD + chat
    ├── js/game.js           ← Phaser 3 client
    └── assets/
        ├── maps/            ← .tmj (Tiled JSON)
        ├── tilesets/        ← .png (adicione manualmente)
        └── sprites/         ← char_01.png (adicione manualmente)
```

---

## Features v1

- ✅ Auth (register / login / JWT)
- ✅ Personagens com classe e sprite
- ✅ Mundo 5×5 salas (25 rooms)
- ✅ Movimento em tempo real (20 tick/s)
- ✅ Chat local e global
- ✅ Troca entre jogadores
- ✅ Roubo (40% chance acordado, 100% dormindo)
- ✅ Dormir / acordar
- ✅ Persistência PostgreSQL
- ✅ Deploy Dokploy via git push

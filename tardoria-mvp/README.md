# ⚔ Tardoria MVP

RPG Multiplayer + TardoriaSales (painel parceiro) + TV Screen

**Stack:** Node.js · Socket.io · Phaser 3 · PostgreSQL · Dokploy

---

## Deploy em 4 comandos

```bash
unzip tardoria.zip -d tardoria
cd tardoria
git add .
git commit -m "feat: Tardoria MVP"
git push
```

Dokploy detecta o push → faz build → deploy automático. ✅

---

## Configuração Dokploy

### 1. Criar banco PostgreSQL
- Painel Dokploy → Databases → PostgreSQL 16
- Database: `tardoria`
- Copie a **connection string**

### 2. Criar aplicação
- Source: seu repositório Git
- Build: Dockerfile (automático)
- Port: `4000`

### 3. Variáveis de ambiente
```
PORT=4000
NODE_ENV=production
DATABASE_URL=<connection string do passo 1>
JWT_SECRET=<gere abaixo>
TICK_RATE=20
```

Gerar JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Rotas
| URL | Descrição |
|-----|-----------|
| `tardoria.protalksystem.com` | Jogo (celular) |
| `tardoria.protalksystem.com/partner` | Painel parceiro (TardoriaSales) |
| `tardoria.protalksystem.com/tv/CODIGO` | Tela pública do estabelecimento |
| `tardoria.protalksystem.com/health` | Health check |

---

## Assets — adicione antes do push

O jogo roda **com fallback visual procedural** sem os assets.
Para pixel art real, adicione os arquivos do pack **Pixel Art Top Down Basic v1.2.3**:

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
  chars.png   ← spritesheet 16×16px
              ← 4 direções × 3 frames (walk + idle)
              ← Linha 0: down | Linha 1: left | Linha 2: right | Linha 3: up
```

---

## Desenvolvimento local

```bash
cp .env.example .env
# edite .env

# Com Docker (sobe app + postgres juntos)
docker compose up

# Sem Docker
npm install
node server.js
```

Acesse: http://localhost:4000

---

## Estrutura

```
tardoria/
├── Dockerfile
├── docker-compose.yml
├── server.js                    ← Express + Socket.io + Game Loop
├── src/
│   ├── db/
│   │   ├── schema.sql           ← criado automaticamente no boot
│   │   └── db.js                ← pool PostgreSQL
│   ├── game/
│   │   ├── WorldMap.js          ← 25 salas 5×5
│   │   ├── PlayerManager.js     ← estado em memória + sync banco
│   │   ├── ItemCatalog.js       ← 12 itens MVP
│   │   └── QRManager.js         ← QR diário + validação GPS
│   └── routes/
│       ├── auth.js              ← register / login / me
│       ├── partner.js           ← painel parceiro + scan + TV
│       └── shop.js              ← compra de itens com gold
└── public/
    ├── index.html               ← Jogo (celular)
    ├── js/game.js               ← Phaser 3 client completo
    ├── partner/index.html       ← TardoriaSales painel
    ├── tv/index.html            ← Tela pública
    └── assets/
        ├── maps/                ← .tmj (Tiled — incluídos)
        ├── tilesets/            ← .png (adicione manualmente)
        └── sprites/             ← chars.png (adicione manualmente)
```

---

## Fluxo do Parceiro

```
1. Acessa /partner → cadastra estabelecimento
2. Captura GPS automático no cadastro
3. Painel gera QR do dia automaticamente
4. Parceiro exibe QR no balcão / imprime / coloca na TV
5. Abre /tv/CODIGO na TV do estabelecimento
6. Ativa quais itens quer vender e por qual preço em gold
```

## Fluxo do Jogador

```
1. Acessa tardoria.protalksystem.com → cadastra personagem
2. Joga no celular — mundo 5×5 salas, tempo real
3. Chega num estabelecimento parceiro → escaneia QR
4. GPS valida presença física (raio 300m)
5. Loja do parceiro abre no celular
6. Compra itens com gold acumulado no jogo
```

## Mecânicas MVP

| Feature | Descrição |
|---------|-----------|
| Movimento | WASD / D-pad mobile, tempo real 20tick/s |
| Chat | Local (sala) e Global (!g mensagem) |
| Dormir | Personagem fica vulnerável a roubo |
| Roubar | 40% acordado, 100% dormindo |
| Trocar | Proposta gold ↔ gold entre jogadores |
| QR diário | Token HMAC(parceiro + data) expira meia-noite |
| GPS | Valida presença em raio de 300m |
| Loja | Compra itens com gold do jogo |
| Tela TV | Canvas animado + QR + itens da loja |
| 12 itens | Moedas, poções, armas, armaduras, especiais |

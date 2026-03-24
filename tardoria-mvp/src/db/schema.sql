CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username   VARCHAR(32) UNIQUE NOT NULL,
  email      VARCHAR(128) UNIQUE NOT NULL,
  password   VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- PERSONAGENS
CREATE TABLE IF NOT EXISTS characters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(32) UNIQUE NOT NULL,
  class       VARCHAR(32) DEFAULT 'aventureiro',
  sprite      VARCHAR(64) DEFAULT 'char_01',
  color       VARCHAR(16) DEFAULT '#e76f51',
  hp          INTEGER DEFAULT 100,
  hp_max      INTEGER DEFAULT 100,
  gold        INTEGER DEFAULT 50,
  level       INTEGER DEFAULT 1,
  xp          INTEGER DEFAULT 0,
  room_id     INTEGER DEFAULT 12,
  pos_x       FLOAT DEFAULT 160,
  pos_y       FLOAT DEFAULT 180,
  is_sleeping BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- INVENTÁRIO DE ITENS
CREATE TABLE IF NOT EXISTS player_inventory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_key     VARCHAR(64) NOT NULL,
  quantity     INTEGER DEFAULT 1,
  acquired_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, item_key)
);

-- PARCEIROS (tardoriasales)
CREATE TABLE IF NOT EXISTS partners (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  establishment_name VARCHAR(128) NOT NULL,
  email              VARCHAR(128) UNIQUE NOT NULL,
  password           VARCHAR(256) NOT NULL,
  address            TEXT,
  lat                FLOAT,
  lng                FLOAT,
  plan               VARCHAR(32) DEFAULT 'aventureiro',
  active             BOOLEAN DEFAULT TRUE,
  secret_key         VARCHAR(64) NOT NULL,
  tv_code            VARCHAR(16) UNIQUE NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ITENS ATIVADOS POR PARCEIRO
CREATE TABLE IF NOT EXISTS partner_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  item_key   VARCHAR(64) NOT NULL,
  price_gold INTEGER NOT NULL DEFAULT 10,
  stock      INTEGER DEFAULT -1,
  active     BOOLEAN DEFAULT TRUE,
  UNIQUE(partner_id, item_key)
);

-- QR DIÁRIO
CREATE TABLE IF NOT EXISTS daily_qr (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  token      VARCHAR(128) NOT NULL UNIQUE,
  UNIQUE(partner_id, date)
);

-- VISITAS DE JOGADORES
CREATE TABLE IF NOT EXISTS location_visits (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  partner_id   UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  visited_at   TIMESTAMPTZ DEFAULT NOW()
);

-- CHAT LOG
CREATE TABLE IF NOT EXISTS chat_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id      INTEGER,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  channel      VARCHAR(32) DEFAULT 'local',
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- LOG DE AÇÕES
CREATE TABLE IF NOT EXISTS action_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES characters(id) ON DELETE SET NULL,
  target_id   UUID REFERENCES characters(id) ON DELETE SET NULL,
  action_type VARCHAR(64) NOT NULL,
  data        JSONB DEFAULT '{}',
  room_id     INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_char_user   ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_char_room   ON characters(room_id);
CREATE INDEX IF NOT EXISTS idx_inv_char    ON player_inventory(character_id);
CREATE INDEX IF NOT EXISTS idx_chat_room   ON chat_log(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_char ON location_visits(character_id, visited_at DESC);

-- AUTO updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS characters_updated_at ON characters;
CREATE TRIGGER characters_updated_at
BEFORE UPDATE ON characters
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

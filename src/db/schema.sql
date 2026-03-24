-- Tardoria RPG — Schema PostgreSQL
-- Executado automaticamente pelo Dokploy na primeira inicialização
-- ou manualmente: psql $DATABASE_URL < src/db/schema.sql

-- =============================================
-- EXTENSÕES
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USUÁRIOS / AUTH
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username    VARCHAR(32) UNIQUE NOT NULL,
  email       VARCHAR(128) UNIQUE NOT NULL,
  password    VARCHAR(256) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);

-- =============================================
-- PERSONAGENS
-- =============================================
CREATE TABLE IF NOT EXISTS characters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(32) UNIQUE NOT NULL,
  class       VARCHAR(32) DEFAULT 'aventureiro',
  sprite      VARCHAR(64) DEFAULT 'char_01',
  hp          INTEGER DEFAULT 100,
  hp_max      INTEGER DEFAULT 100,
  gold        INTEGER DEFAULT 10,
  level       INTEGER DEFAULT 1,
  xp          INTEGER DEFAULT 0,
  -- Posição no mundo
  room_id     INTEGER DEFAULT 12,        -- Sala 12 = Taverna
  pos_x       FLOAT DEFAULT 160,
  pos_y       FLOAT DEFAULT 180,
  -- Estado
  is_sleeping BOOLEAN DEFAULT FALSE,
  sleep_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INVENTÁRIO
-- =============================================
CREATE TABLE IF NOT EXISTS inventory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_key     VARCHAR(64) NOT NULL,
  item_name    VARCHAR(128) NOT NULL,
  quantity     INTEGER DEFAULT 1,
  data         JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CHAT LOG
-- =============================================
CREATE TABLE IF NOT EXISTS chat_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id      INTEGER NOT NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  channel      VARCHAR(32) DEFAULT 'local',  -- local | global | trade | system
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- LOG DE AÇÕES (roubo, troca, dormir)
-- =============================================
CREATE TABLE IF NOT EXISTS action_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID REFERENCES characters(id) ON DELETE SET NULL,
  target_id    UUID REFERENCES characters(id) ON DELETE SET NULL,
  action_type  VARCHAR(64) NOT NULL,   -- steal | trade | sleep | rob_fail
  data         JSONB DEFAULT '{}',
  room_id      INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ESTADO DAS SALAS (persistência de objetos)
-- =============================================
CREATE TABLE IF NOT EXISTS room_state (
  room_id      INTEGER PRIMARY KEY,
  data         JSONB DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Pré-popula as 25 salas
INSERT INTO room_state (room_id, data)
SELECT generate_series(0, 24), '{}'::JSONB
ON CONFLICT (room_id) DO NOTHING;

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_characters_user     ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_room     ON characters(room_id);
CREATE INDEX IF NOT EXISTS idx_inventory_char      ON inventory(character_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_time      ON chat_log(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_actor    ON action_log(actor_id, created_at DESC);

-- =============================================
-- FUNÇÃO: atualiza updated_at automaticamente
-- =============================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER characters_updated_at
BEFORE UPDATE ON characters
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

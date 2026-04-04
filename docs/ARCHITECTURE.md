# Architecture (Demo Target)

## 1. Компоненты

- `MyMuse Server` (self-hosted):
  - REST API + auth + library index;
  - streaming endpoint (HTTP range);
  - share-link service;
  - metadata index (DB);
  - file storage adapter (local fs / network path / object storage).

- `MyMuse Client` (cross-platform):
  - единая кодовая база (целевой вариант: Flutter);
  - login / discover server / library / playlists / player;
  - offline cache и sync.

## 2. Выбранный стек для демо

- Backend: Node.js + Fastify + TypeScript.
- Database: PostgreSQL (dev можно начать с SQLite).
- Cache/queue: Redis (опционально на MVP).
- Storage: local filesystem adapter (первый этап).
- Client: Flutter (iOS, Android, macOS, Linux; позже web).

## 3. Доменная модель (упрощенно)

- `User`
- `Library`
- `Track`
- `Playlist`
- `PlaylistTrack`
- `ShareLink`
- `PlaybackSession`

## 4. API (MVP)

- `POST /auth/register-owner`
- `POST /auth/login`
- `GET /tracks`
- `POST /tracks/upload`
- `GET /tracks/:id/stream`
- `GET /playlists`
- `POST /playlists`
- `POST /shares`
- `GET /shares/:token`
- `GET /health`

## 5. Безопасность

- JWT access + refresh tokens.
- Подписанные share tokens с TTL.
- Rate limiting на публичные endpoints.
- Изоляция файловых путей (никаких path traversal).
- Опциональный HTTPS через reverse proxy.

## 6. Масштабирование

- Single-node mode (домашний сервер) по умолчанию.
- Возможность вынести storage в S3-совместимый backend.
- Горизонтальное масштабирование API stateless-слоя.

## 7. AI-функции (будущий этап)

- Локальная embeddings-индексация metadata и пользовательских лайков.
- Рекомендации без отправки приватной библиотеки во внешние сервисы (self-host режим).
- Плагинная интеграция с внешними LLM/ML-провайдерами.

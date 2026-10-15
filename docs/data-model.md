# QuickNotes data model

## Entities

**users** - the people who have an account.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | **Primary key** |
| name | TEXT | required |
| email | TEXT | required, unique |
| password_hash | TEXT | required (never the real password) |
| created_at | TEXT | filled in automatically |

**notes** - the notes people write.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | **Primary key** |
| user_id | INTEGER | **Foreign key** to users(id), required |
| title | TEXT | required, max 100 characters |
| body | TEXT | optional |
| category | TEXT | required, default 'personal' |
| created_at | TEXT | filled in automatically |

**tags** - labels like "exams" or "urgent".

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | **Primary key** |
| name | TEXT | required, unique |

**note_tags** - the join table that links notes and tags.

| Column | Type | Notes |
|--------|------|-------|
| note_id | INTEGER | **Foreign key** to notes(id) |
| tag_id | INTEGER | **Foreign key** to tags(id) |

The primary key of note_tags is the pair (note_id, tag_id), so the same tag
can't be added to the same note twice.

## Relationships

- **One-to-many: users to notes.** One user has many notes, but each note
  belongs to one user. This is why notes has a `user_id` foreign key.
- **Many-to-many: notes to tags.** One note can have many tags, and one tag
  can be on many notes. A foreign key in one column can't hold that, so we
  use the join table `note_tags`, which stores one row for each note and tag
  pair.

## SQL (CREATE TABLE)

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  title       TEXT NOT NULL CHECK (length(title) <= 100),
  body        TEXT,
  category    TEXT NOT NULL DEFAULT 'personal',
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id  INTEGER NOT NULL,
  tag_id   INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
```

## Example data

```sql
INSERT INTO users (name, email, password_hash) VALUES
  ('Amina Otieno', 'amina@example.com', 'hash1'),
  ('Brian Kamau',  'brian@example.com', 'hash2');

INSERT INTO notes (user_id, title, body, category) VALUES
  (1, 'Revise HTTP methods', 'GET reads, POST creates', 'study'),
  (1, 'Buy milk', NULL, 'personal'),
  (2, 'Finish report', 'Due Friday', 'work');

INSERT INTO tags (name) VALUES ('exams'), ('urgent');

INSERT INTO note_tags (note_id, tag_id) VALUES (1, 1), (1, 2), (2, 2);
```

## Example queries

```sql
-- 1. All notes for one user, newest first (this is GET /notes)
SELECT id, title, category, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC;

-- 2. Each note with its author's name (JOIN)
SELECT notes.title, users.name
FROM notes
JOIN users ON notes.user_id = users.id
ORDER BY users.name;

-- 3. All notes that have the tag "urgent" (joins three tables)
SELECT notes.title
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags      ON note_tags.tag_id  = tags.id
WHERE tags.name = 'urgent';

-- 4. How many notes each user has (LEFT JOIN keeps users with 0 notes)
SELECT users.name, COUNT(notes.id) AS note_count
FROM users
LEFT JOIN notes ON notes.user_id = users.id
GROUP BY users.id, users.name;
```

## Indexes

```sql
CREATE INDEX idx_notes_user_created ON notes(user_id, created_at);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```

- `notes(user_id, created_at)`: almost every request is "give me this user's
  notes, newest first". With this index the database jumps straight to the
  user's rows already in date order, instead of reading every note in the
  table. This matters a lot with millions of notes. The cost is that inserts
  are slightly slower, which is fine because we read much more than we write.
- `note_tags(tag_id)`: the primary key already helps when we search by note,
  but "find all notes with this tag" searches by tag, so it needs its own
  index.

## SQL or NoSQL?

I choose **SQL** (for example PostgreSQL). QuickNotes data is clearly
structured and full of relationships: users have notes, and notes have tags.
SQL handles this well with foreign keys and JOINs, and the database itself
enforces the rules (unique email, title length, no tag added twice, notes
always belonging to a real user). A document database like MongoDB could
store a user and their notes in one document, but tags shared between notes
would be copied around and harder to keep consistent. The amount of data
(about 180 GB a year, see architecture.md) fits easily in one SQL database
with a read replica, so we don't need NoSQL's extra scaling features yet.

# QuickNotes API design

This is the API the backend team should build for the real QuickNotes service
(not JSONPlaceholder, which is only for practice).

**Base URL:** `https://api.quicknotes.example/v1`

**Format:** everything is JSON.

**Login:** after logging in, the client sends the token in a header on every
request: `Authorization: Bearer <token>`. Only registering and logging in
don't need a token. Every notes endpoint only works on the logged-in user's
own notes.

## Endpoints

| Method | Path | What it does | Success status |
|--------|------|--------------|----------------|
| POST | `/users` | Register a new user | 201 Created |
| POST | `/auth/login` | Log in and get a token | 200 OK |
| GET | `/notes` | List my notes (supports `?page=`, `?limit=`, `?category=`, `?tag=`) | 200 OK |
| GET | `/notes/{id}` | Get one of my notes | 200 OK |
| POST | `/notes` | Create a note | 201 Created |
| PATCH | `/notes/{id}` | Change part of a note (title, body or category) | 200 OK |
| DELETE | `/notes/{id}` | Delete a note | 204 No Content |
| PUT | `/notes/{id}/tags` | Replace the tags on a note | 200 OK |

Why this is RESTful: the paths are nouns (`/notes`, not `/getNotes`), the
HTTP method says the action, one note has its own URL, and the status codes
tell the client what happened.

## Example: create a note

`POST /notes`

Request body:

```json
{
  "title": "Revise HTTP methods",
  "body": "GET reads, POST creates, PATCH changes, DELETE removes.",
  "category": "study"
}
```

Response `201 Created` (with a `Location: /v1/notes/42` header):

```json
{
  "id": 42,
  "userId": 1,
  "title": "Revise HTTP methods",
  "body": "GET reads, POST creates, PATCH changes, DELETE removes.",
  "category": "study",
  "tags": [],
  "createdAt": "2026-10-14T09:30:00Z"
}
```

## Example: list notes

`GET /notes?page=1&limit=2&category=study`

Response `200 OK`:

```json
{
  "page": 1,
  "limit": 2,
  "total": 14,
  "notes": [
    {
      "id": 42,
      "title": "Revise HTTP methods",
      "body": "GET reads, POST creates, PATCH changes, DELETE removes.",
      "category": "study",
      "tags": ["exams"],
      "createdAt": "2026-10-14T09:30:00Z"
    },
    {
      "id": 38,
      "title": "SQL joins",
      "body": "JOIN combines rows from two tables.",
      "category": "study",
      "tags": [],
      "createdAt": "2026-10-12T16:05:00Z"
    }
  ]
}
```

The list is paged so the server never sends thousands of notes in one go.

## Error status codes

| Status | When it happens |
|--------|-----------------|
| 400 Bad Request | The data is wrong, for example the title is missing or longer than 100 characters |
| 401 Unauthorized | No token, or the token is wrong or expired |
| 403 Forbidden | The token is fine, but the note belongs to someone else |
| 404 Not Found | The note (or the URL) doesn't exist |
| 409 Conflict | Registering with an email that is already used |
| 429 Too Many Requests | The user sent too many requests (rate limit) |
| 500 Internal Server Error | Something broke on the server |

Every error uses the same shape, so the client can handle them in one place.

Example: `POST /notes` with no title returns `400 Bad Request`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The title is required and must be 100 characters or less."
  }
}
```

Example: `GET /notes/99` when that note belongs to another user returns
`403 Forbidden`:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to view this note."
  }
}
```

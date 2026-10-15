# QuickNotes System Design

This project has two parts.

1. **An API client** (`index.html`, `api.js`, `style.css`). A small web page
   that talks to the JSONPlaceholder practice API. It can load notes (GET),
   create a note (POST) and delete a note (DELETE). It shows loading,
   success, error and empty messages, checks the input, and turns the buttons
   off while a request is running.
2. **Design documents** for the real QuickNotes service, if it grew to
   1 million users: the API, the database and the overall architecture.

## How to run the API client

1. Download or clone this repository.
2. Open `index.html` in your browser (double-click it). No install needed.
3. Click **Load notes** to load 10 notes from the server.
4. Fill in the form and click **Add note** to create one. A title is
   required and can be at most 100 characters.
5. Click **Delete** on a note to remove it.

Note: JSONPlaceholder is a fake API. It says "created" and "deleted" but
doesn't really save anything, so if you load the notes again you get the
original 10 back. This is explained in a comment in `api.js`.

## Documents

- [API design](docs/api-design.md): the REST endpoints, JSON examples and error codes
- [Data model](docs/data-model.md): tables, keys, relationships, SQL, indexes, and SQL vs NoSQL
- [Architecture](docs/architecture.md): requirements, load estimate, diagram, request flows, trade-offs

## What I learned

- How to use `fetch` with `async`/`await`, and to check `response.ok`,
  because fetch doesn't throw an error when the server answers with 404 or 500.
- To use `try`, `catch` and `finally` so the page always shows a clear
  message and the buttons never get stuck turned off.
- To use `textContent` instead of `innerHTML` for user text, so people can't
  slip code into the page.
- How a REST API is designed (nouns for paths, the right method and status
  code), and how an API request turns into a SQL query.
- How to estimate load and how caching, load balancers, replicas and queues
  help a system grow, and that every choice is a trade-off.

# QuickNotes architecture (1 million users)

## Requirements

**Functional (what the app does)**
- Users can register and log in.
- Users can create, read, edit and delete their own notes.
- Users can put notes in categories and add tags.
- Users can list and filter their notes.
- A user can only see and change their own notes.

**Non-functional (how well it does it)**
- **Fast:** loading notes should take well under 200 ms for most requests.
- **Available:** the app should stay up even if one server fails (about 99.9%).
- **Scalable:** it should handle 1 million users by adding servers, not by rewriting.
- **Secure:** HTTPS everywhere, passwords stored as hashes, only the server talks to the database.
- **Reliable:** no lost notes, with regular database backups.

## Load estimate

Assumptions:
- 1,000,000 registered users
- 20% are active each day, so 200,000 daily active users
- Each active user creates 5 notes a day and loads their notes 20 times a day
- An average note is about 500 bytes
- 1 day is about 100,000 seconds (rounded to make the maths easy)
- Peak traffic is 5 times the average

```
Writes:  200,000 x 5  = 1,000,000 per day  / 100,000 = about 10 writes per second
Reads:   200,000 x 20 = 4,000,000 per day  / 100,000 = about 40 reads per second

Peak:    about 50 writes per second and about 200 reads per second

Storage: 1,000,000 notes x 500 bytes = 500 MB per day
         500 MB x 365 = about 180 GB per year
```

The system is **read-heavy** (4 times more reads than writes), so caching and
read replicas will help a lot. 200 requests per second at peak and 180 GB a
year are not huge, so a few ordinary servers and one database are enough.
We shouldn't over-build.

## Architecture diagram

```
                         ┌─────────┐
          ┌─────────────>│   DNS   │  (quicknotes.com -> IP addresses)
          │              └─────────┘
 ┌────────┴──────┐  static files  ┌──────────────────────┐
 │ Client        │ ─────────────> │ CDN (HTML, CSS, JS)  │
 │ (browser or   │                └──────────────────────┘
 │  phone app)   │
 └────────┬──────┘
          │ API calls (HTTPS, JSON)
          v
   ┌───────────────┐
   │ Load balancer │
   └──────┬────────┘
     ┌────┴─────┬──────────┐
     v          v          v
 ┌───────┐  ┌───────┐  ┌───────┐        ┌───────────────┐
 │ App 1 │  │ App 2 │  │ App 3 │ ─────> │ Cache (Redis) │
 └───┬───┘  └───┬───┘  └───┬───┘        └───────────────┘
     │ writes   │ reads    │ jobs
     v          v          v
 ┌─────────┐ ┌──────────┐ ┌───────┐   ┌────────┐
 │ Primary │>│ Read     │ │ Queue │──>│ Worker │  (emails, exports)
 │   DB    │ │ replica  │ └───────┘   └────────┘
 └─────────┘ └──────────┘
   copies every change to the replica
```

## What each component does

- **Client** is what the user sees (the browser or phone app) and it sends requests to the API.
- **DNS** turns quicknotes.com into the address of our servers, so users can find us.
- **CDN** keeps copies of the HTML, CSS and JavaScript on servers near the user, so the app loads fast and our own servers get less traffic.
- **Load balancer** shares requests between the app servers and stops sending traffic to a server that is down.
- **App servers** run the API code (check the token, validate data, talk to the database); there are several of them and they are stateless, so any server can handle any request.
- **Cache (Redis)** keeps each user's recent notes in memory, so most reads are answered in about 1 ms without asking the database.
- **Primary database** holds the one true copy of the data and is the only place that accepts writes, which keeps the data correct.
- **Read replica** is a copy of the primary that answers read queries, so lots of reading doesn't slow down writing.
- **Queue** holds slow jobs (like sending a welcome email or exporting notes) so the app can reply to the user straight away.
- **Worker** takes jobs from the queue and does them in the background, so a rush of jobs only makes the queue longer instead of crashing a server.

## Request flows

### GET /notes

1. The client sends `GET /notes` with its token.
2. The load balancer picks a healthy app server.
3. The app server checks the token and finds out the user (say user 1).
4. It looks in the cache for `notes:user:1`.
5. **Cache hit:** the notes come back from the cache in about 1 ms and the server sends them as JSON with status 200.
6. **Cache miss:** the server runs `SELECT ... FROM notes WHERE user_id = 1 ORDER BY created_at DESC` on the **read replica**, saves the result in the cache with a TTL of 5 minutes, and sends the response with status 200. The next request will be a cache hit.

### POST /notes

1. The client sends `POST /notes` with its token and the note in the JSON body.
2. The load balancer picks a healthy app server.
3. The app server checks the token and validates the data (title required, at most 100 characters). If it's wrong, it replies `400`.
4. The server saves the note with an `INSERT` on the **primary database**, because only the primary accepts writes.
5. It deletes `notes:user:1` from the cache, so the user never gets an old list.
6. It replies `201 Created` with the new note.
7. In the background, the primary copies the new row to the read replica a few milliseconds later. If the app needs to do a slow job (like an email), it adds it to the queue and a worker handles it.

## Trade-offs

1. **Speed vs freshness (cache).** The cache makes reads very fast and takes load off the database, but cached data can be out of date. We reduce this by deleting the user's cache whenever they change a note, and by using a TTL as a safety net. For a notes app this is fine.
2. **Replication lag (eventual consistency).** The replica copies the primary a tiny moment later, so a read from the replica might briefly miss a note that was just saved. That's acceptable for notes, but it would not be for a bank balance. If it matters, the app can read the user's own fresh data from the primary right after they write.
3. **Simplicity vs scalability.** We keep QuickNotes as one application (a monolith) with one database instead of many small services or sharding. It's much easier to build and fix. At 200 requests per second we don't need more, and we can split it later if the team or traffic grows a lot.
4. **Cost vs reliability.** Extra app servers and a replica cost more money, but they let the system survive failures. We use two or three servers, not twenty.

## How we avoid single points of failure

A single point of failure (SPOF) is a part that takes everything down if it breaks.

- **App servers:** there are 2 or more behind the load balancer. If one crashes, the health check notices within seconds and traffic goes to the others. They are stateless, so no data is lost.
- **Load balancer:** use a cloud load balancer, which is already run on several machines, or run two.
- **Database:** the primary has a read replica. If the primary fails, the replica can be promoted to become the new primary (failover). Regular backups protect us if both fail, and we test restoring them.
- **Cache:** if Redis goes down, the app falls back to the database and is slower but still works (graceful degradation). Redis can also run with a standby copy.
- **CDN and DNS:** both are run by big providers on many servers around the world.
- **Queue and worker:** jobs wait safely in the queue, and we can run more than one worker, so if a worker crashes another picks up the job.

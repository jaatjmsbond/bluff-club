# Bluff Club ♠ — Guest Rooms

A browser card game for 2–4 friends on Android, iPhone, tablets, or computers. Everyone can create a room. No admin, accounts, passwords, or user setup are required.

## Play online

1. Open the same deployed game website as your friends.
2. Select **Create room**, enter your display name and a room name, then create it.
3. Share the room name and the generated six-character code. **Copy invite** also includes a link that fills those fields automatically.
4. Friends select **Join room**, enter their display names, the room name, and code.
5. When 2–4 players have joined, the host selects **Shuffle & deal**.
6. After a game ends, the host can choose **Play again**.

A player name must be unique within its room. Room names can be reused because each room has its own generated code. Room names are matched without case differences and with extra spaces removed.

## Hosting: GitHub → Render Free

The included `render.yaml` uses Render's free web service and no paid disk. A separate database is not required for guest rooms.

1. Extract the ZIP. Upload the project contents to a GitHub repository. The repository root should contain `server.cjs`, `game.cjs`, `package.json`, `render.yaml`, and `public/`.
2. On Render, select **New → Web Service** and connect that repository.
3. Choose **Node** runtime, build command `echo ready`, start command `npm start`, and the **Free** instance type.
4. Optionally set `DATA_DIR=/tmp/bluff-club`. No `SETUP_KEY` is needed.
5. Deploy and open the generated `https://…onrender.com` URL. Share this same website URL with all friends.

You can also deploy through **New → Blueprint** using the updated free `render.yaml`. Review Render's final plan before proceeding; account verification may still be required by Render.

**Free hosting limits:** an idle server may take a minute to wake up. Rooms and guest seats can be lost when the temporary storage is reset during a restart or redeployment. If that happens, enter your name and create a new room. There are no user accounts to recreate. Idle rooms expire after 24 hours without activity. Keep one server instance; this version is not designed for multiple replicas.

## Updating your existing GitHub/Render deployment

Upload and replace this version's files in your existing GitHub repository, then let Render redeploy. The server still uses `npm start`. Refresh the game in all browsers after the deployment finishes.

This version replaces the old admin/password flow with guests. Old accounts are no longer used. Any old account data on a persistent disk is left untouched; new room data is stored in `guest-rooms.json`.

If the old paid Blueprint is still waiting for billing details, cancel it and use **New → Web Service → Free** with the updated repository. An already-paid service is not automatically made free simply by uploading new code: review its instance and disk settings in Render.

## Refreshing and reconnecting

- Your guest token is remembered in this browser tab when session storage is available. Refreshing reconnects to your last room while its data still exists.
- **Back to lobby** keeps your seat. Select your room's **Resume** button to return.
- Use the same tab to keep your identity. A different device or a new guest session does not reclaim an existing player's private hand just by typing their name.
- If a preview blocks browser storage, the game still works during the current page session, but refreshing cannot restore the guest seat.
- Changing your name starts a new guest identity. Finish a running game before changing it.
- Before dealing, **Leave room & free seat** removes your seat. If the host leaves, the next player becomes host. Empty rooms are removed.
- Active games do not remove a player's seat mid-game. Their tab can reconnect when the server and room are still available.
- Temporary network errors retry automatically. If the server loses its data, the game explains that a new room is needed.

## Practice without hosting

Extract the ZIP and open `PLAY.html` in a browser. The game immediately starts practice with bots. No server is needed for practice.

Online rooms still require a running backend. Downloading the HTML alone does not connect your friends. Open the deployed website for the simplest experience, or use **Connect server** to enter the deployed backend URL.

## Optional: GitHub Pages frontend

Render alone already hosts the website and backend together. GitHub Pages is optional.

1. Push `.github/workflows/pages.yml` with the project to the `main` branch.
2. In GitHub, choose **Settings → Pages → Source → GitHub Actions**. Run the **Publish game website** workflow.
3. In Render, set `PUBLIC_ORIGIN=https://YOUR_USERNAME.github.io`, without the repository path or trailing slash, then redeploy.
4. On the Pages website, select **Connect server**, enter your Render HTTPS URL, and save it. Each friend does this once per browser if browser storage is available.

## Rules

1. Deal 11 cards to each of 2–4 players from one shuffled 52-card deck. Unused cards stay out. There are no jokers.
2. Select 1–4 cards and claim a single rank, such as “two kings.” Actual cards may differ from your claim.
3. Following players must claim the same rank until an objection resets the table. Cards from every play stay in the pile.
4. On your turn, choose **Play face down**, **Objection!**, or **Skip turn**. Only the immediate next player can object to a claim. A normal skip accepts that claim, plays no cards, and moves to the next player; the entire pile and required rank stay unchanged. After a skip, a later player cannot object to the already-accepted claim, but can play a new one or skip.
5. Only that latest play is checked. If any of its cards do not match the claim, the objection is correct: the player who made the claim picks up **the entire table pile**, and the objector leads.
6. If all cards in the latest play match, the objection is wrong: the objector picks up **the entire table pile**, and the previous player leads again.
7. Example: 2 + 2 + 1 cards = 5 cards in the pile. Whoever loses the objection picks up all five.
8. After an objection, the table is empty and the next lead chooses any rank.
9. **Playing your last cards does not instantly win.** The next player must choose **Objection!** or **Skip turn**; playing new cards is disabled during this decision. A correct objection makes the final player pick up the entire table pile and continue playing. A wrong objection confirms that player as winner and gives the pile to the objector. Skipping declines the final objection and confirms the winner. There is no timer or automatic final acceptance.
10. No turn timer. Take your time.

## Run locally

Install the current Node.js LTS version, open a terminal in the project folder, and run:

```bash
npm start
```

Open `http://localhost:3000`. No dependencies or admin setup are needed. For friends in other locations, deploy the server and share its HTTPS website URL.

Run the game and HTTP integration tests:

```bash
npm test
```

## Files and privacy

- `game.cjs` is the authoritative server rules engine. `public/game.js` contains matching practice logic. Update both when changing rules.
- `public/` contains the browser interface. `PLAY.html` is a standalone build of those same client files.
- The server checks membership, turns, card ownership, player limits, and stale actions. It returns only the requesting player's hand. Table cards stay hidden until an objection reveals the latest play.
- Guest tokens are random private seat keys, not passwords. The server stores their hashes. Keep your browser session and room invitation private; anyone with a room's name and code can join an available seat before play starts.
- Room/session data is saved to `DATA_DIR/guest-rooms.json`. Do not upload `data/`, saved room files, or private tokens to GitHub. The server operator can inspect saved hands.
- Guest sessions expire after seven days. Idle rooms expire after 24 hours. Browser storage is optional for startup but required to remember a seat after refresh.
- Persistent storage is optional if you later want rooms to survive deployments. It must be configured separately; the free default does not guarantee persistence.

## Troubleshooting

- **Controls do nothing in a file preview:** download `PLAY.html` and open it in Chrome, Safari, Firefox, or Edge. Some file viewers block JavaScript.
- **Could not reach game server:** open the deployed website, check the Render service is running, and give a sleeping free service time to wake up. A downloaded HTML file needs **Connect server** for online play.
- **Room name does not match:** copy the name and code from the host's invitation.
- **Room full or already started:** join before dealing. Start a new room for a different group.
- **Player name already in use:** pick a different display name. Names do not authorize access to someone else's hand.
- **Room not found / guest session ended:** it may have expired or the free server lost temporary data. Enter your name and create a new room.

## Verification

21 automated game/API tests passed. Chromium checks at desktop and mobile viewport sizes covered separate guests joining the same room, invitation links, wrong-name errors, host dealing, normal skips that preserve selected cards, a real opponent catching a final bluff and returning all 17 table cards, full-pile objections, private hands, refresh/reconnect (including invitation URLs), lobby resume, free-server data loss, blocked browser storage, practice bots, fresh deals, sorting, sound controls, skip turns, pending final claims, caught final bluffs, final skips, and replay. Physical Android/iPhone testing has not been performed.

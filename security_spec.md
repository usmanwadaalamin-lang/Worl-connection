# Al Amana Social — Firestore Security Specification

## 1. Data Invariants
1. **PII Isolation**: Email addresses and phone numbers live strictly in `/users/{userId}/private/info`, readable and writable only by `request.auth.uid == userId`. Public `/users/{userId}` documents contain zero PII.
2. **Verified Identity**: All writes require `request.auth != null` with either `request.auth.token.email_verified == true` or Firebase Phone Auth verification (`sign_in_provider == 'phone'` with a verified `phone_number`).
3. **Immutable Ownership & Timestamps**: `uid`, `authorId`, `followerId`, `actorId`, and `createdAt` cannot be spoofed at creation or altered on update; `createdAt` and `updatedAt` must equal `request.time`.
4. **Atomic Interaction Sync**: Creating or deleting `/posts/{postId}/likes/{userId}` or `/channels/{channelId}/followers/{userId}` must atomically increment or decrement the parent counter (`likesCount` / `followersCount`) by exactly 1; creating `/posts/{postId}/comments/{commentId}` must atomically increment `commentsCount` by 1.
5. **Strict Key & Size Limits**: Every document write validates required/allowed keys (`hasAll` + `hasOnly`), string `.size()` bounds, bounded list caps (`<= 50` members on groups, `<= 350KB` base64 voice notes), ID regexes (`^[a-zA-Z0-9_\-]+$`), and update `affectedKeys().hasOnly(...)`.
6. **Master Gate & Scoped Queries**: Chat messages, group messages, channel posts, and call ICE candidates verify parent membership/participation on `create` and evaluate `resource.data` directly on `list` without `get()`/`exists()` in list rules. Notifications, private info, and `/calls/{callId}` sessions are strictly scoped to the recipient/owner/participants with terminal state locking on `ended` / `declined` calls.
7. **Admin-Only Sponsored Posts**: `/sponsored_posts/{adId}` creation, updates, and deletion require `isAdmin()` (`email == 'usmanwadaalamin@gmail.com' && email_verified == true`), enforce safe `https?://` action URLs, and only allow non-admins to read/list `status == 'active'` promotions.
8. **VIP Channel Access Isolation & Billing Modes**: VIP channels store `isVip: true` and `vipBillingCycle` (`'monthly'` or `'once'`), and manage approved subscribers in `/channels/{channelId}/vipMembers/{userId}` (created/renewed/deleted solely by the channel creator) with either `accessMode == 'lifetime'` (one-time payment) or `expiresAt` (`timestamp`) enforced against `request.time` on post reads and synced with bounded `visibleTo` on `visibility == 'vip'` channel posts.
9. **VIP Payment Receipts**: Subscribers submit payment proof to `/channels/{channelId}/vipReceipts/{receiptId}` strictly with `status == 'pending'`, `userId == request.auth.uid`, and `creatorId` matching the parent channel; only the channel creator may transition `'pending'` -> `'approved' | 'rejected'` (terminal-state locked), never granting VIP membership from a client-side receipt creation alone.
10. **Presence & Avatar Safety**: `/users/{userId}` allows owners to update their profile (`name`, `bio`, `avatarUrl` up to `160000` bytes restricted to `https?://` or safe `data:image/(jpeg|jpg|png|webp);base64,`) or update their own presence (`isOnline`, `lastActiveAt == request.time`).
11. **Direct Chat Unread Counters & Read Receipts**: `/chats/{threadId}` tracks `unreadCountA` / `unreadCountB` and `lastSenderId`; recipients may only reset their own unread counter to `0` and mark received messages `read: true` on `/chats/{threadId}/messages/{messageId}` without altering sender/text/timestamps.
12. **Group & Channel Read Cursors**: `/users/{userId}/readStates/{roomId}` is strictly owner-scoped (`userId == request.auth.uid`), and `/groups/{groupId}/readReceipts/{userId}` verifies group membership on create/update and uses `visibleTo` on list queries.
13. **Chunked Photo & Short-Video Media Integrity**: `/media/{mediaId}` descriptors enforce `authorId == request.auth.uid`, `mediaType in ['image', 'video']`, strict MIME allowlist, `chunkCount` (`1..30`), `totalBytes` (`1..13500000`), `durationSec` (`0..60`), and immutable ownership; `/media/{mediaId}/chunks/{chunkId}` enforces parent `/media/{mediaId}` ownership (`authorId == request.auth.uid`), bounded `index < chunkCount`, and chunk payload `data.size() <= 660000`; `/posts/{postId}` with `mediaId` must reference an existing `/media/{mediaId}` owned by the post author and keep all `media*` fields immutable on update.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Post Create**: `POST /posts/p1` with `request.auth == null`.
2. **Unverified Email Write**: `POST /posts/p1` with `email_verified: false`.
3. **Author Spoofing**: User A creates `/posts/p1` with `authorId: "user_B"`.
4. **Shadow Field Injection**: User A creates `/users/userA` with extra `isAdmin: true` or `role: "admin"`.
5. **Client Timestamp Forgery**: User A creates `/posts/p1` with `createdAt` set to a past client timestamp instead of `request.time`.
6. **ID Poisoning**: User A writes `/posts/bad$id..with..junk` violating `^[a-zA-Z0-9_\-]+$`.
7. **PII Cross-User Read**: User A attempts `GET /users/userB/private/info`.
8. **Post Text Tampering by Non-Author**: User B attempts to update `text` on User A's `/posts/p1`.
9. **Desynchronized Like Counter**: User A increments `likesCount` on `/posts/p1` without creating `/posts/p1/likes/userA` in the same batch.
10. **Arbitrary Likes Jump**: User A updates `likesCount` from `0` to `999` on `/posts/p1`.
11. **Chat Snooping**: User C reads or lists `/chats/userA_userB/messages` when neither `participantA` nor `participantB` is User C.
12. **Notification Scraping**: User B lists `/notifications` with `recipientId == "userA"`.
13. **Non-Admin Ad Injection & Unverified Admin Spoof**: Non-admin user (or unverified token claiming admin email) writes `/sponsored_posts/ad1`.
14. **VIP Channel Broadcast Scraping & Expired Access**: Non-VIP or expired VIP user reads `/channels/{vipChannelId}/posts` with `visibility == 'vip'`.
15. **Self-Approved VIP Receipt Bypass**: Subscriber creates `/channels/{vipChannelId}/vipReceipts/r1` with `status: "approved"` or modifies `vipMembers/{userId}` directly.
16. **Cross-User Presence / Avatar Spoof**: User B updates `isOnline`, `avatarUrl`, or `bio` on `/users/userA`, or injects a `javascript:` / `data:text/html` URL into `avatarUrl`.
17. **Sender Read Receipt Forgery**: User A marks their own outgoing message in `/chats/{threadId}/messages/{msgId}` as `read: true` instead of recipient User B.
18. **Cross-User Unread Reset**: User A clears `unreadCountB` or writes `/users/userB/readStates/{roomId}`.
19. **Orphan / Cross-User Media Attachment**: User A creates `/posts/p1` referencing `/media/m_of_userB` owned by User B or a non-existent `mediaId`.
20. **Oversized or Unowned Media Chunk Injection**: User B writes `/media/m_of_userA/chunks/0` or injects a chunk with `index >= chunkCount` or `data.size() > 660000`.
21. **Post Media Mutation After Publish**: User A attempts to swap `mediaId` or `mediaPoster` on an already published `/posts/p1`.

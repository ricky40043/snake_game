# Smooth snake interpolation test notes

This branch is for testing the responsiveness and rendering changes that were committed on main.

## Included changes already on main

- Force Socket.io to use WebSocket only on both client and server.
- Lower default game tick from 120ms to 100ms.
- Add client-side duplicate direction guard.
- Add server-side buffered direction handling for rapid cornering input.
- Replace tick-only canvas drawing with requestAnimationFrame interpolation so snake movement renders smoothly while server remains authoritative.

## Test focus

1. Keyboard direction response.
2. Mobile D-pad response.
3. Rapid cornering, e.g. RIGHT → UP → LEFT.
4. Multi-player room smoothness.
5. Respawn preview / invincibility / boost visual effects.

## Important note

The code changes were committed to main before this PR branch was created, so this PR contains this test note as the visible diff. The gameplay code to test is already present in main at commit 5182a846d6d8960ba991249a47c2d25165911e4d.

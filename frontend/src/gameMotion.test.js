import test from 'node:test'
import assert from 'node:assert/strict'
import {
  inferSnakeDirection,
  interpolateSnake,
  isOppositeDirection,
  predictSnake,
} from './gameMotion.js'

const snake = {
  playerId: 'me',
  alive: true,
  direction: 'RIGHT',
  body: [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }],
}

test('predicts the local snake immediately without mutating the server snapshot', () => {
  const predicted = predictSnake(snake, 'UP')
  assert.deepEqual(predicted.body, [{ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }])
  assert.deepEqual(snake.body, [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }])
})

test('never predicts a 180 degree turn', () => {
  assert.equal(isOppositeDirection('RIGHT', 'LEFT'), true)
  assert.deepEqual(
    predictSnake(snake, 'LEFT').body,
    [{ x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 }],
  )
})

test('interpolates every body segment between server ticks', () => {
  const next = predictSnake(snake, 'RIGHT')
  const halfway = interpolateSnake(snake, next, 0.5)
  assert.deepEqual(halfway.body, [
    { x: 3.5, y: 3 },
    { x: 2.5, y: 3 },
    { x: 1.5, y: 3 },
  ])
})

test('can infer direction for snapshots from older servers', () => {
  assert.equal(inferSnakeDirection({ body: snake.body }), 'RIGHT')
})

test('snaps respawns instead of animating across the whole map', () => {
  const respawned = {
    ...snake,
    body: [{ x: 30, y: 30 }, { x: 29, y: 30 }, { x: 28, y: 30 }],
  }
  assert.deepEqual(interpolateSnake(snake, respawned, 0.5).body, respawned.body)
})

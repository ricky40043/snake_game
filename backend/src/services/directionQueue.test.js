const test = require('node:test')
const assert = require('node:assert/strict')

const {
  enqueueDirection,
  consumeDirection,
  resetDirectionQueue,
} = require('./directionQueue')

function makeSnake(direction = 'RIGHT') {
  return { alive: true, direction, nextDirection: direction, directionQueue: [] }
}

test('rapid corner inputs are applied one per game tick in order', () => {
  const snake = makeSnake('RIGHT')

  assert.equal(enqueueDirection(snake, 'DOWN', 1).accepted, true)
  assert.equal(enqueueDirection(snake, 'LEFT', 2).accepted, true)
  assert.equal(consumeDirection(snake).direction, 'DOWN')
  assert.equal(snake.direction, 'DOWN')
  assert.equal(snake.nextDirection, 'LEFT')
  assert.equal(consumeDirection(snake).direction, 'LEFT')
  assert.equal(snake.direction, 'LEFT')
})

test('reverse, duplicate, and overflowing inputs return an explicit reason', () => {
  const snake = makeSnake('RIGHT')

  assert.deepEqual(enqueueDirection(snake, 'LEFT'), { accepted: false, reason: 'opposite_direction' })
  assert.deepEqual(enqueueDirection(snake, 'RIGHT'), { accepted: false, reason: 'same_direction' })
  assert.equal(enqueueDirection(snake, 'DOWN').accepted, true)
  assert.equal(enqueueDirection(snake, 'LEFT').accepted, true)
  assert.deepEqual(enqueueDirection(snake, 'UP'), { accepted: false, reason: 'queue_full' })
})

test('reset clears stale turns after a wall bounce or respawn', () => {
  const snake = makeSnake('UP')
  enqueueDirection(snake, 'RIGHT', 7)
  resetDirectionQueue(snake, 'LEFT')

  assert.deepEqual(snake.directionQueue, [])
  assert.equal(snake.direction, 'LEFT')
  assert.equal(snake.nextDirection, 'LEFT')
  assert.equal(consumeDirection(snake), null)
})

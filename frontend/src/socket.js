import { io } from 'socket.io-client'

const URL = import.meta.env.DEV ? 'http://localhost:3001' : '/'

export const socket = io(URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
})

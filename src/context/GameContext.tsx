import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { get, onValue, ref, remove, set, update } from 'firebase/database'
import type { Chamber, Player, Room } from '@/types/game'
import { db, firebaseConfigured } from '@/lib/firebase'
import {
  advanceRound,
  buildInitialRoom,
  checkWinCondition,
  generateId,
  generateRoomCode,
  isRoundOver,
} from '@/lib/gameLogic'

// ─── Persistent identity ─────────────────────────────────────────────────────

function getOrCreatePlayerId(): string {
  const stored = localStorage.getItem('tds_player_id')
  if (stored) return stored
  const id = generateId()
  localStorage.setItem('tds_player_id', id)
  return id
}

function getStoredRoomId(): string | null {
  return localStorage.getItem('tds_room_id')
}

function setStoredRoomId(id: string | null) {
  if (id) localStorage.setItem('tds_room_id', id)
  else localStorage.removeItem('tds_room_id')
}

// ─── State ───────────────────────────────────────────────────────────────────

interface State {
  myPlayerId: string
  room: Room | null
  joinError: string | null
  isLoading: boolean
}

// Firebase omits null fields, so coerce missing optional values back to null/defaults.
function sanitizeRoom(raw: Partial<Room>): Room {
  const players: Room['players'] = {}
  for (const [id, p] of Object.entries(raw.players ?? {})) {
    players[id] = {
      id: p.id ?? id,
      name: p.name ?? 'Unknown',
      role: p.role,
      isKeyholder: p.isKeyholder ?? false,
      isHost: p.isHost ?? false,
      roleConfirmed: p.roleConfirmed ?? false,
      isDemo: p.isDemo ?? false,
    }
  }

  const chambers: Room['chambers'] = {}
  for (const [id, c] of Object.entries(raw.chambers ?? {})) {
    chambers[id] = {
      id: c.id ?? id,
      ownerId: c.ownerId ?? '',
      content: c.content ?? 'empty',
      isOpened: c.isOpened ?? false,
      openedInRound: c.openedInRound,
      openedByKeyholderId: c.openedByKeyholderId,
    }
  }

  return {
    id: raw.id ?? '',
    hostId: raw.hostId ?? '',
    status: raw.status ?? 'lobby',
    players,
    chambers,
    currentRound: raw.currentRound ?? 1,
    chambersOpenedThisRound: raw.chambersOpenedThisRound ?? 0,
    goldTotal: raw.goldTotal ?? 0,
    goldFound: raw.goldFound ?? 0,
    fireTotal: raw.fireTotal ?? 0,
    fireFound: raw.fireFound ?? 0,
    winner: raw.winner ?? null,
    winCondition: raw.winCondition ?? null,
  }
}

// ─── Context interface ───────────────────────────────────────────────────────

interface GameContextValue {
  state: State
  createRoom: (name: string) => void
  joinRoom: (code: string, name: string) => void
  addDemoPlayer: (name: string) => void
  startGame: () => void
  confirmRole: () => void
  openChamber: (chamberId: string) => void
  resetGame: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    myPlayerId: getOrCreatePlayerId(),
    room: null,
    joinError: null,
    isLoading: false,
  })

  const unsubRef = useRef<(() => void) | null>(null)

  // Attempt to rejoin stored room on page load (Firebase mode only)
  useEffect(() => {
    if (!firebaseConfigured || !db) return
    const storedId = getStoredRoomId()
    if (storedId) subscribeToRoom(storedId)
    return () => unsubRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function subscribeToRoom(roomId: string) {
    unsubRef.current?.()
    if (!db) return
    const unsub = onValue(ref(db, `rooms/${roomId}`), snap => {
      const raw = snap.val() as Partial<Room> | null
      setState(prev => ({
        ...prev,
        room: raw ? sanitizeRoom(raw) : null,
        isLoading: false,
      }))
    })
    unsubRef.current = unsub
    setStoredRoomId(roomId)
  }

  // ── createRoom ──────────────────────────────────────────────────────────────

  function createRoom(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return

    const roomId = generateRoomCode()
    const me: Player = {
      id: state.myPlayerId,
      name: trimmed,
      isKeyholder: false,
      isHost: true,
      roleConfirmed: false,
      isDemo: false,
    }
    const room: Room = {
      id: roomId,
      hostId: me.id,
      status: 'lobby',
      players: { [me.id]: me },
      chambers: {},
      currentRound: 1,
      chambersOpenedThisRound: 0,
      goldTotal: 0,
      goldFound: 0,
      fireTotal: 0,
      fireFound: 0,
      winner: null,
      winCondition: null,
    }

    if (firebaseConfigured && db) {
      setState(prev => ({ ...prev, isLoading: true }))
      void set(ref(db!, `rooms/${roomId}`), room).then(() => subscribeToRoom(roomId))
    } else {
      setState(prev => ({ ...prev, room }))
    }
  }

  // ── joinRoom ────────────────────────────────────────────────────────────────

  function joinRoom(code: string, name: string) {
    if (!firebaseConfigured || !db) {
      setState(prev => ({
        ...prev,
        joinError: 'Firebase is not configured — set up your .env.local to enable joining rooms.',
      }))
      return
    }

    const roomId = code.toUpperCase().trim()
    const trimmedName = name.trim()
    if (!roomId || !trimmedName) return

    setState(prev => ({ ...prev, isLoading: true, joinError: null }))

    void (async () => {
      try {
        const snap = await get(ref(db!, `rooms/${roomId}`))
        if (!snap.exists()) {
          setState(prev => ({ ...prev, isLoading: false, joinError: 'Room not found — check the code.' }))
          return
        }

        const existing = sanitizeRoom(snap.val() as Partial<Room>)

        if (existing.status !== 'lobby') {
          setState(prev => ({ ...prev, isLoading: false, joinError: 'This game has already started.' }))
          return
        }
        if (Object.keys(existing.players).length >= 10) {
          setState(prev => ({ ...prev, isLoading: false, joinError: 'Room is full (10 players max).' }))
          return
        }

        // Already in the room (page refresh) — just resubscribe
        if (existing.players[state.myPlayerId]) {
          subscribeToRoom(roomId)
          return
        }

        const me: Player = {
          id: state.myPlayerId,
          name: trimmedName,
          isKeyholder: false,
          isHost: false,
          roleConfirmed: false,
          isDemo: false,
        }
        await set(ref(db!, `rooms/${roomId}/players/${state.myPlayerId}`), me)
        subscribeToRoom(roomId)
      } catch {
        setState(prev => ({ ...prev, isLoading: false, joinError: 'Failed to join — please try again.' }))
      }
    })()
  }

  // ── addDemoPlayer ───────────────────────────────────────────────────────────

  function addDemoPlayer(name: string) {
    const room = state.room
    if (!room || Object.keys(room.players).length >= 10) return

    const id = generateId()
    const player: Player = {
      id,
      name: name.trim() || `Player ${Object.keys(room.players).length + 1}`,
      isKeyholder: false,
      isHost: false,
      roleConfirmed: false,
      isDemo: true,
    }

    if (firebaseConfigured && db) {
      void set(ref(db, `rooms/${room.id}/players/${id}`), player)
    } else {
      setState(prev =>
        prev.room
          ? { ...prev, room: { ...prev.room, players: { ...prev.room.players, [id]: player } } }
          : prev,
      )
    }
  }

  // ── startGame ───────────────────────────────────────────────────────────────

  function startGame() {
    const room = state.room
    if (!room || room.hostId !== state.myPlayerId) return
    const players = Object.values(room.players)
    if (players.length < 3) return

    const gameData = buildInitialRoom(room.id, players)
    const newRoom: Room = { ...room, ...gameData, status: 'role-reveal' }

    if (firebaseConfigured && db) {
      void set(ref(db, `rooms/${room.id}`), newRoom)
    } else {
      setState(prev => ({ ...prev, room: newRoom }))
    }
  }

  // ── confirmRole ─────────────────────────────────────────────────────────────

  function confirmRole() {
    const room = state.room
    if (!room) return

    // Build what the confirmed players map looks like
    const updatedPlayers = { ...room.players }
    updatedPlayers[state.myPlayerId] = { ...updatedPlayers[state.myPlayerId], roleConfirmed: true }
    Object.values(updatedPlayers).forEach(p => {
      if (p.isDemo) updatedPlayers[p.id] = { ...p, roleConfirmed: true }
    })
    const allConfirmed = Object.values(updatedPlayers).every(p => p.roleConfirmed)

    if (firebaseConfigured && db) {
      const updates: Record<string, unknown> = {}
      updates[`rooms/${room.id}/players/${state.myPlayerId}/roleConfirmed`] = true
      Object.values(room.players).forEach(p => {
        if (p.isDemo) updates[`rooms/${room.id}/players/${p.id}/roleConfirmed`] = true
      })
      if (allConfirmed) updates[`rooms/${room.id}/status`] = 'playing'
      void update(ref(db), updates)
    } else {
      setState(prev =>
        prev.room
          ? {
              ...prev,
              room: {
                ...prev.room,
                players: updatedPlayers,
                status: allConfirmed ? 'playing' : prev.room.status,
              },
            }
          : prev,
      )
    }
  }

  // ── openChamber ─────────────────────────────────────────────────────────────

  function openChamber(chamberId: string) {
    const room = state.room
    if (!room) return

    const chamber = room.chambers[chamberId]
    if (!chamber || chamber.isOpened) return

    const keyholder = Object.values(room.players).find(p => p.isKeyholder)
    if (!keyholder || keyholder.id !== state.myPlayerId) return
    if (chamber.ownerId === state.myPlayerId) return

    // Compute next state
    const goldFound = room.goldFound + (chamber.content === 'gold' ? 1 : 0)
    const fireFound = room.fireFound + (chamber.content === 'fire' ? 1 : 0)
    const chambersOpenedThisRound = room.chambersOpenedThisRound + 1

    const updatedPlayers = { ...room.players }
    Object.values(updatedPlayers).forEach(p => {
      updatedPlayers[p.id] = { ...p, isKeyholder: p.id === chamber.ownerId }
    })

    const updatedChamber: Chamber = {
      ...chamber,
      isOpened: true,
      openedInRound: room.currentRound,
      openedByKeyholderId: state.myPlayerId,
    }

    const updatedRoom: Room = {
      ...room,
      chambers: { ...room.chambers, [chamberId]: updatedChamber },
      players: updatedPlayers,
      goldFound,
      fireFound,
      chambersOpenedThisRound,
    }

    const winResult = checkWinCondition(updatedRoom)
    const finalRoom: Room = winResult
      ? { ...updatedRoom, status: 'ended', winner: winResult.winner, winCondition: winResult.condition }
      : isRoundOver(updatedRoom)
      ? advanceRound(updatedRoom)
      : updatedRoom

    if (firebaseConfigured && db) {
      const updates: Record<string, unknown> = {
        [`rooms/${room.id}/chambers/${chamberId}/isOpened`]:            true,
        [`rooms/${room.id}/chambers/${chamberId}/openedInRound`]:       room.currentRound,
        [`rooms/${room.id}/chambers/${chamberId}/openedByKeyholderId`]: state.myPlayerId,
        [`rooms/${room.id}/goldFound`]:                 goldFound,
        [`rooms/${room.id}/fireFound`]:                 fireFound,
        [`rooms/${room.id}/chambersOpenedThisRound`]:   finalRoom.chambersOpenedThisRound,
        [`rooms/${room.id}/currentRound`]:              finalRoom.currentRound,
        [`rooms/${room.id}/status`]:                    finalRoom.status,
      }
      Object.values(updatedPlayers).forEach(p => {
        updates[`rooms/${room.id}/players/${p.id}/isKeyholder`] = p.isKeyholder
      })
      if (finalRoom.winner) {
        updates[`rooms/${room.id}/winner`]        = finalRoom.winner
        updates[`rooms/${room.id}/winCondition`]  = finalRoom.winCondition
      }
      void update(ref(db), updates)
    } else {
      setState(prev => ({ ...prev, room: finalRoom }))
    }
  }

  // ── resetGame ───────────────────────────────────────────────────────────────

  function resetGame() {
    const room = state.room
    if (firebaseConfigured && db && room) {
      if (room.hostId === state.myPlayerId) {
        void remove(ref(db, `rooms/${room.id}`))
      }
      unsubRef.current?.()
      unsubRef.current = null
      setStoredRoomId(null)
    }
    setState(prev => ({ ...prev, room: null, joinError: null, isLoading: false }))
  }

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <GameContext.Provider
      value={{ state, createRoom, joinRoom, addDemoPlayer, startGame, confirmRole, openChamber, resetGame }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

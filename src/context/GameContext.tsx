import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { get, onValue, ref, remove, set, update } from 'firebase/database'
import type { Chamber, Declaration, Player, Room } from '@/types/game'
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

  const declarations: Room['declarations'] = {}
  for (const [id, d] of Object.entries(raw.declarations ?? {})) {
    declarations[id] = { gold: d.gold ?? 0, fire: d.fire ?? 0, empty: d.empty ?? 0 }
  }

  return {
    id: raw.id ?? '',
    hostId: raw.hostId ?? '',
    status: raw.status ?? 'lobby',
    players,
    chambers,
    declarations,
    declarationsRevealed: raw.declarationsRevealed ?? false,
    currentRound: raw.currentRound ?? 1,
    chambersOpenedThisRound: raw.chambersOpenedThisRound ?? 0,
    goldTotal: raw.goldTotal ?? 0,
    goldFound: raw.goldFound ?? 0,
    fireTotal: raw.fireTotal ?? 0,
    fireFound: raw.fireFound ?? 0,
    winner: raw.winner ?? null,
    winCondition: raw.winCondition ?? null,
    lastGoldOwnerId: raw.lastGoldOwnerId ?? null,
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
  setDeclaration: (d: Declaration) => void
  revealDeclarations: () => void
  resetToLobby: () => void
  leaveRoom: () => void
  continueRound: () => void
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
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearConnectTimeout() {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
  }

  function startConnectTimeout(message: string) {
    clearConnectTimeout()
    connectTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        if (!prev.isLoading) return prev
        return { ...prev, isLoading: false, joinError: message }
      })
    }, 10_000)
  }

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
      clearConnectTimeout()
      const raw = snap.val() as Partial<Room> | null
      setState(prev => ({
        ...prev,
        room: raw ? sanitizeRoom(raw) : null,
        isLoading: false,
        joinError: null,
      }))
    })
    unsubRef.current = unsub
    setStoredRoomId(roomId)
  }

  // ── Demo player automation ──────────────────────────────────────────────────
  // Only the host triggers actions for demo players.

  // 1. Auto-declare: when the declaration phase opens, demo players lock in
  //    their actual card counts after a short random delay.
  useEffect(() => {
    const room = state.room
    if (!room || room.status !== 'playing' || room.declarationsRevealed) return
    if (room.hostId !== state.myPlayerId) return
    const undeclared = Object.values(room.players).filter(p => p.isDemo && !room.declarations[p.id])
    if (undeclared.length === 0) return

    const timer = setTimeout(() => {
      const playerCount = Object.keys(room.players).length
      const newDeclaredCount = Object.keys(room.declarations).length + undeclared.length
      const allDeclared = newDeclaredCount >= playerCount

      if (firebaseConfigured && db) {
        const updates: Record<string, unknown> = {}
        undeclared.forEach(p => {
          const mine = Object.values(room.chambers).filter(c => c.ownerId === p.id && !c.isOpened)
          updates[`rooms/${room.id}/declarations/${p.id}`] = {
            gold:  mine.filter(c => c.content === 'gold').length,
            fire:  mine.filter(c => c.content === 'fire').length,
            empty: mine.filter(c => c.content === 'empty').length,
          }
        })
        if (allDeclared) updates[`rooms/${room.id}/declarationsRevealed`] = true
        void update(ref(db), updates)
      } else {
        setState(prev => {
          if (!prev.room) return prev
          const newDeclarations = { ...prev.room.declarations }
          undeclared.forEach(p => {
            const mine = Object.values(prev.room!.chambers).filter(c => c.ownerId === p.id && !c.isOpened)
            newDeclarations[p.id] = {
              gold:  mine.filter(c => c.content === 'gold').length,
              fire:  mine.filter(c => c.content === 'fire').length,
              empty: mine.filter(c => c.content === 'empty').length,
            }
          })
          const allDone = Object.keys(newDeclarations).length >= playerCount
          return {
            ...prev,
            room: { ...prev.room!, declarations: newDeclarations, declarationsRevealed: allDone || prev.room!.declarationsRevealed },
          }
        })
      }
    }, 800 + Math.random() * 1200)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.room?.status, state.room?.currentRound, state.room?.declarationsRevealed,
      // Rerun when the set of declared players changes (human locks in → check if demos still needed)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.keys(state.room?.declarations ?? {}).join(',')])

  // 2. Auto-open: when a demo player holds the key and declarations are revealed,
  //    open a random chamber from another player after a short delay.
  useEffect(() => {
    const room = state.room
    if (!room || room.status !== 'playing' || !room.declarationsRevealed) return
    if (room.hostId !== state.myPlayerId) return
    const demoKeyholder = Object.values(room.players).find(p => p.isDemo && p.isKeyholder)
    if (!demoKeyholder) return

    const openable = Object.values(room.chambers).filter(c => !c.isOpened && c.ownerId !== demoKeyholder.id)
    if (openable.length === 0) return

    const timer = setTimeout(() => {
      const target = openable[Math.floor(Math.random() * openable.length)]
      const goldFound = room.goldFound + (target.content === 'gold' ? 1 : 0)
      const fireFound = room.fireFound + (target.content === 'fire' ? 1 : 0)
      const chambersOpenedThisRound = room.chambersOpenedThisRound + 1

      const updatedPlayers = { ...room.players }
      Object.values(updatedPlayers).forEach(p => {
        updatedPlayers[p.id] = { ...p, isKeyholder: p.id === target.ownerId }
      })
      const updatedChamber: Chamber = {
        ...target, isOpened: true, openedInRound: room.currentRound, openedByKeyholderId: demoKeyholder.id,
      }
      const lastGoldOwnerId = target.content === 'gold' ? target.ownerId : room.lastGoldOwnerId
      const updatedRoom: Room = {
        ...room, chambers: { ...room.chambers, [target.id]: updatedChamber },
        players: updatedPlayers, goldFound, fireFound, chambersOpenedThisRound, lastGoldOwnerId,
      }
      const winResult = checkWinCondition(updatedRoom)
      const roundOver = isRoundOver(updatedRoom)
      const finalRoom: Room = winResult
        ? { ...updatedRoom, status: 'ended', winner: winResult.winner, winCondition: winResult.condition }
        : roundOver ? { ...updatedRoom, status: 'round-summary' } : updatedRoom

      if (firebaseConfigured && db) {
        const updates: Record<string, unknown> = {
          [`rooms/${room.id}/chambers/${target.id}/isOpened`]:            true,
          [`rooms/${room.id}/chambers/${target.id}/openedInRound`]:       room.currentRound,
          [`rooms/${room.id}/chambers/${target.id}/openedByKeyholderId`]: demoKeyholder.id,
          [`rooms/${room.id}/goldFound`]:               goldFound,
          [`rooms/${room.id}/fireFound`]:               fireFound,
          [`rooms/${room.id}/chambersOpenedThisRound`]: chambersOpenedThisRound,
          [`rooms/${room.id}/lastGoldOwnerId`]:         lastGoldOwnerId,
          [`rooms/${room.id}/status`]:                  finalRoom.status,
        }
        Object.values(updatedPlayers).forEach(p => {
          updates[`rooms/${room.id}/players/${p.id}/isKeyholder`] = p.isKeyholder
        })
        if (finalRoom.winner) {
          updates[`rooms/${room.id}/winner`]       = finalRoom.winner
          updates[`rooms/${room.id}/winCondition`] = finalRoom.winCondition
        }
        void update(ref(db), updates)
      } else {
        setState(prev => ({ ...prev, room: finalRoom }))
      }
    }, 1000 + Math.random() * 1500)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.room?.declarationsRevealed, state.room?.chambersOpenedThisRound, state.room?.currentRound])

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
      declarations: {},
      declarationsRevealed: false,
      currentRound: 1,
      chambersOpenedThisRound: 0,
      goldTotal: 0,
      goldFound: 0,
      fireTotal: 0,
      fireFound: 0,
      winner: null,
      winCondition: null,
      lastGoldOwnerId: null,
    }

    if (firebaseConfigured && db) {
      setState(prev => ({ ...prev, isLoading: true, joinError: null }))
      startConnectTimeout(
        'Could not reach Firebase — check that your Realtime Database has been created and the URL is correct.',
      )
      set(ref(db!, `rooms/${roomId}`), room)
        .then(() => subscribeToRoom(roomId))
        .catch((err: Error) => {
          clearConnectTimeout()
          setState(prev => ({
            ...prev,
            isLoading: false,
            joinError: `Failed to create room: ${err.message}`,
          }))
        })
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
    startConnectTimeout(
      'Could not reach Firebase — check that your Realtime Database has been created and the URL is correct.',
    )

    void (async () => {
      try {
        const snap = await get(ref(db!, `rooms/${roomId}`))
        clearConnectTimeout()
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
      } catch (err) {
        clearConnectTimeout()
        setState(prev => ({
          ...prev,
          isLoading: false,
          joinError: `Failed to join: ${(err as Error).message}`,
        }))
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
    if (!room.declarationsRevealed) return

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

    const lastGoldOwnerId = chamber.content === 'gold' ? chamber.ownerId : room.lastGoldOwnerId

    const updatedRoom: Room = {
      ...room,
      chambers: { ...room.chambers, [chamberId]: updatedChamber },
      players: updatedPlayers,
      goldFound,
      fireFound,
      chambersOpenedThisRound,
      lastGoldOwnerId,
    }

    const winResult = checkWinCondition(updatedRoom)
    const roundOver = isRoundOver(updatedRoom)
    const finalRoom: Room = winResult
      ? { ...updatedRoom, status: 'ended', winner: winResult.winner, winCondition: winResult.condition }
      : roundOver
      ? { ...updatedRoom, status: 'round-summary' }
      : updatedRoom

    if (firebaseConfigured && db) {
      const updates: Record<string, unknown> = {
        [`rooms/${room.id}/chambers/${chamberId}/isOpened`]:            true,
        [`rooms/${room.id}/chambers/${chamberId}/openedInRound`]:       room.currentRound,
        [`rooms/${room.id}/chambers/${chamberId}/openedByKeyholderId`]: state.myPlayerId,
        [`rooms/${room.id}/goldFound`]:                                 goldFound,
        [`rooms/${room.id}/fireFound`]:                                 fireFound,
        [`rooms/${room.id}/chambersOpenedThisRound`]:                   chambersOpenedThisRound,
        [`rooms/${room.id}/lastGoldOwnerId`]:                           lastGoldOwnerId,
        [`rooms/${room.id}/status`]:                                    finalRoom.status,
      }
      Object.values(updatedPlayers).forEach(p => {
        updates[`rooms/${room.id}/players/${p.id}/isKeyholder`] = p.isKeyholder
      })
      if (finalRoom.winner) {
        updates[`rooms/${room.id}/winner`]       = finalRoom.winner
        updates[`rooms/${room.id}/winCondition`] = finalRoom.winCondition
      }
      void update(ref(db), updates)
    } else {
      setState(prev => ({ ...prev, room: finalRoom }))
    }
  }

  // ── setDeclaration ──────────────────────────────────────────────────────────

  function setDeclaration(d: Declaration) {
    const room = state.room
    if (!room || room.status !== 'playing') return
    if (room.declarationsRevealed) return

    const playerCount = Object.keys(room.players).length
    const alreadyDeclared = !!room.declarations[state.myPlayerId]
    const newDeclaredCount = Object.keys(room.declarations).length + (alreadyDeclared ? 0 : 1)
    const allDeclared = newDeclaredCount >= playerCount

    if (firebaseConfigured && db) {
      const updates: Record<string, unknown> = {
        [`rooms/${room.id}/declarations/${state.myPlayerId}`]: d,
      }
      if (allDeclared) updates[`rooms/${room.id}/declarationsRevealed`] = true
      void update(ref(db), updates)
    } else {
      setState(prev => {
        if (!prev.room) return prev
        const newDeclarations = { ...prev.room.declarations, [state.myPlayerId]: d }
        const allDone = Object.keys(newDeclarations).length >= Object.keys(prev.room.players).length
        return {
          ...prev,
          room: {
            ...prev.room,
            declarations: newDeclarations,
            declarationsRevealed: allDone || prev.room.declarationsRevealed,
          },
        }
      })
    }
  }

  // ── revealDeclarations ──────────────────────────────────────────────────────

  function revealDeclarations() {
    const room = state.room
    if (!room || room.status !== 'playing' || room.declarationsRevealed) return

    if (firebaseConfigured && db) {
      void set(ref(db, `rooms/${room.id}/declarationsRevealed`), true)
    } else {
      setState(prev =>
        prev.room ? { ...prev, room: { ...prev.room, declarationsRevealed: true } } : prev,
      )
    }
  }

  // ── resetToLobby ────────────────────────────────────────────────────────────
  // Keeps the current player list, wipes all game state back to lobby.

  function resetToLobby() {
    const room = state.room
    if (!room) return

    if (firebaseConfigured && db) {
      const updates: Record<string, unknown> = {
        [`rooms/${room.id}/status`]:                   'lobby',
        [`rooms/${room.id}/chambers`]:                 null,
        [`rooms/${room.id}/declarations`]:             null,
        [`rooms/${room.id}/declarationsRevealed`]:     false,
        [`rooms/${room.id}/currentRound`]:             1,
        [`rooms/${room.id}/chambersOpenedThisRound`]:  0,
        [`rooms/${room.id}/goldTotal`]:                0,
        [`rooms/${room.id}/goldFound`]:                0,
        [`rooms/${room.id}/fireTotal`]:                0,
        [`rooms/${room.id}/fireFound`]:                0,
        [`rooms/${room.id}/winner`]:                   null,
        [`rooms/${room.id}/winCondition`]:             null,
        [`rooms/${room.id}/lastGoldOwnerId`]:          null,
      }
      Object.values(room.players).forEach(p => {
        updates[`rooms/${room.id}/players/${p.id}/role`]          = null
        updates[`rooms/${room.id}/players/${p.id}/isKeyholder`]   = false
        updates[`rooms/${room.id}/players/${p.id}/roleConfirmed`] = false
      })
      void update(ref(db), updates)
    } else {
      const clearedPlayers: Room['players'] = {}
      Object.values(room.players).forEach(p => {
        const { role: _r, ...rest } = p
        clearedPlayers[p.id] = { ...rest, isKeyholder: false, roleConfirmed: false }
      })
      setState(prev => prev.room ? {
        ...prev,
        room: {
          ...prev.room,
          status: 'lobby',
          players: clearedPlayers,
          chambers: {},
          declarations: {},
          declarationsRevealed: false,
          currentRound: 1,
          chambersOpenedThisRound: 0,
          goldTotal: 0,
          goldFound: 0,
          fireTotal: 0,
          fireFound: 0,
          winner: null,
          winCondition: null,
          lastGoldOwnerId: null,
        },
      } : prev)
    }
  }

  // ── continueRound ───────────────────────────────────────────────────────────
  // Called from the round-summary screen to advance to the next round.

  function continueRound() {
    const room = state.room
    if (!room || room.status !== 'round-summary') return

    // Guardians win if no gold was found in the round that just ended.
    const openedThisRound = Object.values(room.chambers).filter(
      c => c.isOpened && c.openedInRound === room.currentRound,
    )
    const goldFoundThisRound = openedThisRound.filter(c => c.content === 'gold').length
    if (goldFoundThisRound === 0) {
      if (firebaseConfigured && db) {
        void update(ref(db), {
          [`rooms/${room.id}/status`]:       'ended',
          [`rooms/${room.id}/winner`]:       'guardians',
          [`rooms/${room.id}/winCondition`]: 'no-gold-round',
        })
      } else {
        setState(prev =>
          prev.room
            ? { ...prev, room: { ...prev.room, status: 'ended', winner: 'guardians', winCondition: 'no-gold-round' } }
            : prev,
        )
      }
      return
    }

    const nextRoom = advanceRound(room)

    // The keyholder for the next round is the owner of the last gold revealed this round
    const nextKeyholderPlayerId = room.lastGoldOwnerId ?? Object.values(room.players).find(p => p.isKeyholder)?.id
    const adjustedPlayers = { ...nextRoom.players }
    Object.values(adjustedPlayers).forEach(p => {
      adjustedPlayers[p.id] = { ...p, isKeyholder: p.id === nextKeyholderPlayerId }
    })
    const adjustedRoom: Room = { ...nextRoom, players: adjustedPlayers, lastGoldOwnerId: null }

    if (firebaseConfigured && db) {
      const updates: Record<string, unknown> = {
        [`rooms/${room.id}/status`]:                  adjustedRoom.status,
        [`rooms/${room.id}/currentRound`]:            adjustedRoom.currentRound,
        [`rooms/${room.id}/chambersOpenedThisRound`]: 0,
        [`rooms/${room.id}/declarations`]:            null,
        [`rooms/${room.id}/declarationsRevealed`]:    false,
        [`rooms/${room.id}/lastGoldOwnerId`]:         null,
      }
      Object.values(adjustedPlayers).forEach(p => {
        updates[`rooms/${room.id}/players/${p.id}/isKeyholder`] = p.isKeyholder
      })
      if (adjustedRoom.status === 'ended') {
        updates[`rooms/${room.id}/winner`]       = adjustedRoom.winner
        updates[`rooms/${room.id}/winCondition`] = adjustedRoom.winCondition
      } else {
        Object.values(adjustedRoom.chambers).forEach(c => {
          if (!c.isOpened) {
            updates[`rooms/${room.id}/chambers/${c.id}/ownerId`] = c.ownerId
          }
        })
      }
      void update(ref(db), updates)
    } else {
      setState(prev => ({ ...prev, room: adjustedRoom }))
    }
  }

  // ── leaveRoom ────────────────────────────────────────────────────────────────
  // Non-host players leave; their player entry is removed from the room.

  function leaveRoom() {
    const room = state.room
    clearConnectTimeout()
    if (firebaseConfigured && db && room) {
      void remove(ref(db, `rooms/${room.id}/players/${state.myPlayerId}`))
      unsubRef.current?.()
      unsubRef.current = null
      setStoredRoomId(null)
    }
    setState(prev => ({ ...prev, room: null, joinError: null, isLoading: false }))
  }

  // ── resetGame ───────────────────────────────────────────────────────────────

  function resetGame() {
    const room = state.room
    clearConnectTimeout()
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
      value={{ state, createRoom, joinRoom, addDemoPlayer, startGame, confirmRole, openChamber, setDeclaration, revealDeclarations, resetToLobby, leaveRoom, continueRound, resetGame }}
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

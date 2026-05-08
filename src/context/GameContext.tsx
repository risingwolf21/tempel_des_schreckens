import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AppState, Chamber, Player, Room } from '@/types/game'
import {
  advanceRound,
  buildInitialRoom,
  checkWinCondition,
  generateId,
  generateRoomCode,
  isRoundOver,
} from '@/lib/gameLogic'

// ─── State & Actions ────────────────────────────────────────────────────────

type Action =
  | { type: 'CREATE_ROOM'; name: string }
  | { type: 'ADD_DEMO_PLAYER'; name: string }
  | { type: 'START_GAME' }
  | { type: 'CONFIRM_ROLE' }
  | { type: 'OPEN_CHAMBER'; chamberId: string }
  | { type: 'RESET_GAME' }

function getOrCreatePlayerId(): string {
  const stored = localStorage.getItem('tds_player_id')
  if (stored) return stored
  const id = generateId()
  localStorage.setItem('tds_player_id', id)
  return id
}

const MY_PLAYER_ID = getOrCreatePlayerId()

const INITIAL_STATE: AppState = {
  myPlayerId: MY_PLAYER_ID,
  room: null,
}

// ─── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CREATE_ROOM': {
      const roomId = generateRoomCode()
      const me: Player = {
        id: state.myPlayerId,
        name: action.name,
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
      return { ...state, room }
    }

    case 'ADD_DEMO_PLAYER': {
      if (!state.room) return state
      const id = generateId()
      const player: Player = {
        id,
        name: action.name,
        isKeyholder: false,
        isHost: false,
        roleConfirmed: false,
        isDemo: true,
      }
      return {
        ...state,
        room: {
          ...state.room,
          players: { ...state.room.players, [id]: player },
        },
      }
    }

    case 'START_GAME': {
      if (!state.room) return state
      const players = Object.values(state.room.players)
      if (players.length < 3) return state

      const gameData = buildInitialRoom(state.room.id, players)
      const room: Room = {
        ...state.room,
        ...gameData,
        status: 'role-reveal',
      }
      return { ...state, room }
    }

    case 'CONFIRM_ROLE': {
      if (!state.room) return state
      const updatedPlayers = {
        ...state.room.players,
        [state.myPlayerId]: {
          ...state.room.players[state.myPlayerId],
          roleConfirmed: true,
        },
      }

      // Also auto-confirm all demo players
      Object.values(updatedPlayers).forEach(p => {
        if (p.isDemo) updatedPlayers[p.id] = { ...p, roleConfirmed: true }
      })

      const allConfirmed = Object.values(updatedPlayers).every(p => p.roleConfirmed)
      return {
        ...state,
        room: {
          ...state.room,
          players: updatedPlayers,
          status: allConfirmed ? 'playing' : 'role-reveal',
        },
      }
    }

    case 'OPEN_CHAMBER': {
      if (!state.room) return state
      const chamber = state.room.chambers[action.chamberId]
      if (!chamber || chamber.isOpened) return state

      // Find current keyholder
      const keyholder = Object.values(state.room.players).find(p => p.isKeyholder)
      if (!keyholder || keyholder.id !== state.myPlayerId) return state

      // Keyholder can't open their own chambers
      if (chamber.ownerId === state.myPlayerId) return state

      const updatedChamber: Chamber = {
        ...chamber,
        isOpened: true,
        openedInRound: state.room.currentRound,
        openedByKeyholderId: state.myPlayerId,
      }

      const goldFound =
        state.room.goldFound + (chamber.content === 'gold' ? 1 : 0)
      const fireFound =
        state.room.fireFound + (chamber.content === 'fire' ? 1 : 0)
      const chambersOpenedThisRound = state.room.chambersOpenedThisRound + 1

      // Pass key to the owner of the opened chamber
      const updatedPlayers = { ...state.room.players }
      Object.values(updatedPlayers).forEach(p => {
        updatedPlayers[p.id] = { ...p, isKeyholder: p.id === chamber.ownerId }
      })

      const updatedRoom: Room = {
        ...state.room,
        chambers: { ...state.room.chambers, [action.chamberId]: updatedChamber },
        players: updatedPlayers,
        goldFound,
        fireFound,
        chambersOpenedThisRound,
      }

      // Check win conditions
      const winResult = checkWinCondition(updatedRoom)
      if (winResult) {
        return {
          ...state,
          room: {
            ...updatedRoom,
            status: 'ended',
            winner: winResult.winner,
            winCondition: winResult.condition,
          },
        }
      }

      // Check if round is over
      if (isRoundOver(updatedRoom)) {
        const advancedRoom = advanceRound(updatedRoom)
        return { ...state, room: advancedRoom }
      }

      return { ...state, room: updatedRoom }
    }

    case 'RESET_GAME': {
      return { ...state, room: null }
    }

    default:
      return state
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

interface GameContextValue {
  state: AppState
  createRoom: (name: string) => void
  addDemoPlayer: (name: string) => void
  startGame: () => void
  confirmRole: () => void
  openChamber: (chamberId: string) => void
  resetGame: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  return (
    <GameContext.Provider
      value={{
        state,
        createRoom: name => dispatch({ type: 'CREATE_ROOM', name }),
        addDemoPlayer: name => dispatch({ type: 'ADD_DEMO_PLAYER', name }),
        startGame: () => dispatch({ type: 'START_GAME' }),
        confirmRole: () => dispatch({ type: 'CONFIRM_ROLE' }),
        openChamber: id => dispatch({ type: 'OPEN_CHAMBER', chamberId: id }),
        resetGame: () => dispatch({ type: 'RESET_GAME' }),
      }}
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

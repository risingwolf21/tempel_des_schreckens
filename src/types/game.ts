export type Role = 'adventurer' | 'guardian'
export type ChamberContent = 'gold' | 'fire' | 'empty'
export type GameStatus = 'lobby' | 'role-reveal' | 'playing' | 'round-summary' | 'ended'
export type WinCondition = 'all-gold' | 'all-fire' | 'time-up' | 'no-gold-round'
export type Team = 'adventurers' | 'guardians'

export interface Player {
  id: string
  name: string
  role?: Role
  isKeyholder: boolean
  isHost: boolean
  roleConfirmed: boolean
  isDemo: boolean
}

export interface Chamber {
  id: string
  ownerId: string
  content: ChamberContent
  isOpened: boolean
  openedInRound?: number
  openedByKeyholderId?: string
}

export interface Declaration {
  gold: number
  fire: number
  empty: number
}

export interface Room {
  id: string
  hostId: string
  status: GameStatus
  players: Record<string, Player>
  chambers: Record<string, Chamber>
  declarations: Record<string, Declaration>
  declarationsRevealed: boolean
  currentRound: number
  chambersOpenedThisRound: number
  goldTotal: number
  goldFound: number
  fireTotal: number
  fireFound: number
  winner: Team | null
  winCondition: WinCondition | null
  lastGoldOwnerId: string | null
}

export interface AppState {
  myPlayerId: string
  room: Room | null
}

export interface PlayerDistribution {
  adventurers: number
  guardians: number
  gold: number
  fire: number
  empty: number
  total: number
}

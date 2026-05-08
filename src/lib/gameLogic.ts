import type {
  Chamber,
  ChamberContent,
  Player,
  PlayerDistribution,
  Role,
  Room,
  Team,
  WinCondition,
} from '@/types/game'

const DISTRIBUTIONS: Record<number, PlayerDistribution> = {
  3:  { adventurers: 2, guardians: 1, gold: 3,  fire: 1, empty: 8,  total: 12 },
  4:  { adventurers: 3, guardians: 1, gold: 4,  fire: 1, empty: 11, total: 16 },
  5:  { adventurers: 4, guardians: 1, gold: 5,  fire: 1, empty: 14, total: 20 },
  6:  { adventurers: 4, guardians: 2, gold: 6,  fire: 2, empty: 16, total: 24 },
  7:  { adventurers: 5, guardians: 2, gold: 7,  fire: 2, empty: 19, total: 28 },
  8:  { adventurers: 6, guardians: 2, gold: 8,  fire: 2, empty: 22, total: 32 },
  9:  { adventurers: 6, guardians: 3, gold: 9,  fire: 3, empty: 24, total: 36 },
  10: { adventurers: 7, guardians: 3, gold: 10, fire: 3, empty: 27, total: 40 },
}

export function getDistribution(playerCount: number): PlayerDistribution {
  return DISTRIBUTIONS[playerCount] ?? DISTRIBUTIONS[10]
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function generateId(): string {
  return crypto.randomUUID()
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildInitialRoom(
  roomId: string,
  players: Player[],
): Omit<Room, 'status'> & { chambers: Record<string, Chamber> } {
  const dist = getDistribution(players.length)

  // Assign roles
  const rolePool: Role[] = [
    ...Array(dist.adventurers).fill('adventurer'),
    ...Array(dist.guardians).fill('guardian'),
  ]
  const shuffledRoles = shuffle(rolePool)
  const updatedPlayers: Record<string, Player> = {}
  players.forEach((p, i) => {
    updatedPlayers[p.id] = { ...p, role: shuffledRoles[i] }
  })

  // Build chamber card pool
  const contentPool: ChamberContent[] = [
    ...Array(dist.gold).fill('gold'),
    ...Array(dist.fire).fill('fire'),
    ...Array(dist.empty).fill('empty'),
  ]
  const shuffledContent = shuffle(contentPool)

  // Distribute chambers evenly across players (4 per player = 4 rounds × 1 per round)
  const playerIds = players.map(p => p.id)
  const cardsPerPlayer = 4 // one per round
  const chambers: Record<string, Chamber> = {}

  shuffledContent.forEach((content, idx) => {
    const ownerId = playerIds[idx % players.length]
    // Each player gets exactly cardsPerPlayer cards
    // idx order: p0,p1,p2,...,p0,p1,p2,... so each player gets contiguous cards distributed round-robin
    const chamberIdx = Math.floor(idx / players.length)
    const id = `${ownerId}-${chamberIdx}`
    chambers[id] = {
      id,
      ownerId,
      content,
      isOpened: false,
    }
  })

  // Random first keyholder
  const firstKeyholderIndex = Math.floor(Math.random() * players.length)
  Object.values(updatedPlayers).forEach((p, i) => {
    updatedPlayers[p.id] = { ...p, isKeyholder: i === firstKeyholderIndex }
  })

  return {
    id: roomId,
    hostId: players[0].id,
    players: updatedPlayers,
    chambers,
    declarations: {},
    currentRound: 1,
    chambersOpenedThisRound: 0,
    goldTotal: dist.gold,
    goldFound: 0,
    fireTotal: dist.fire,
    fireFound: 0,
    winner: null,
    winCondition: null,
  }
}

export function checkWinCondition(room: Room): { winner: Team; condition: WinCondition } | null {
  if (room.goldFound >= room.goldTotal) {
    return { winner: 'adventurers', condition: 'all-gold' }
  }
  if (room.fireFound >= room.fireTotal) {
    return { winner: 'guardians', condition: 'all-fire' }
  }
  const playerCount = Object.keys(room.players).length
  if (room.currentRound > 4 && room.chambersOpenedThisRound >= playerCount) {
    return { winner: 'guardians', condition: 'time-up' }
  }
  return null
}

export function getPlayerChambers(room: Room, playerId: string): Chamber[] {
  return Object.values(room.chambers).filter(c => c.ownerId === playerId)
}

export function getMyDistributionSummary(room: Room, playerId: string) {
  const myChambers = getPlayerChambers(room, playerId)
  const unopened = myChambers.filter(c => !c.isOpened)
  const gold = unopened.filter(c => c.content === 'gold').length
  const fire = unopened.filter(c => c.content === 'fire').length
  const empty = unopened.filter(c => c.content === 'empty').length
  return { gold, fire, empty, total: unopened.length }
}

export function isRoundOver(room: Room): boolean {
  const playerCount = Object.keys(room.players).length
  return room.chambersOpenedThisRound >= playerCount
}

export function advanceRound(room: Room): Room {
  const nextRound = room.currentRound + 1
  if (nextRound > 4) {
    return {
      ...room,
      status: 'ended',
      winner: 'guardians',
      winCondition: 'time-up',
    }
  }
  return {
    ...room,
    currentRound: nextRound,
    chambersOpenedThisRound: 0,
    declarations: {},
  }
}

export function cardsPerPlayerThisRound(round: number): number {
  return 5 - round // round 1=4, round 2=3, round 3=2, round 4=1
}

export function getPlayerOpenedChamberCount(room: Room, playerId: string): number {
  return Object.values(room.chambers).filter(
    c => c.ownerId === playerId && c.isOpened,
  ).length
}

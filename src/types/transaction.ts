export type TransactionType = "add" | "drop" | "waiver" | "trade" | "commissioner";

export interface TransactionPlayer {
  playerId: string;
  name: string;
  nflTeam?: string;
}

export interface Transaction {
  transactionId: string;
  timestamp: string;
  type: TransactionType;
  teamId: string;
  playersAdded: TransactionPlayer[];
  playersDropped: TransactionPlayer[];
  relatedTeamId?: string | null;
  faabAmount?: number | null;
  note?: string | null;
}

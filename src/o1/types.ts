export interface O1Transaction { to: string; data: string; value: string; from?: string; chain_id?: number; }
export interface O1Step { id?: string; type?: string; transaction?: O1Transaction; tx?: O1Transaction; simulation?: { status?: string }; depends_on?: string[]; }
export interface O1Plan { chain_id?: number; wallet?: string; creator?: string; caller?: string; expires_at: string | number; steps: O1Step[]; issues?: Array<{ severity?: string; code?: string }>; review?: Record<string, unknown>; }
export interface O1Quote { quote_id: string; expires_at: string | number; issues?: Array<{ severity?: string; code?: string }>; review?: Record<string, unknown>; steps?: O1Step[]; }

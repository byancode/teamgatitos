/**
 * Tipos TypeScript para el archivo "backup-completo.json"
 * Generado a partir de la estructura real del JSON.
 */

/** Regalo individual (equipos y regalos disponibles) */
export interface Regalo {
  id: number;
  name: string;
  diamonds: number;
  /** Imagen opcional del regalo */
  image?: string;
}

/** Equipo de la batalla (equipo1 / equipo2) */
export interface Equipo {
  nombre: string;
  sub: string;
  color: string;
  regalos: Regalo[];
}

/** Estilos de la batalla versus */
export interface BattleStyle {
  fontFamily: string;
  textStroke: number;
  shadowOpacity: number;
  shadowDistance: number;
  colorL1: string;
  /** Tamaño en píxeles del texto L1 */
  sizeL1: number;
  colorL2: string;
  /** Tamaño en píxeles del texto L2 */
  sizeL2: number;
  colorTimer: string;
  /** Tamaño en píxeles del temporizador */
  sizeTimer: number;
}

/** Jugador en rankings de racha (recordDiario / recordHistorico) */
export interface PlayerRacha {
  avatar: string;
  displayName: string;
  /** Victorias acumuladas */
  wins: number;
  /** Monedas/diamantes acumulados */
  monedas: number;
}

/** Jugador en rankings de top likes / top VIP (recordHistorico) */
export interface PlayerTop {
  avatar: string;
  displayName: string;
  wins: number;
}

/** Jugador en racha versus (salvadas / reinicios) */
export interface PlayerVersus {
  avatar: string;
  displayName: string;
  count: number;
}

/** Objeto de registros indexado por nombre de usuario */
export type RecordMap<T> = Record<string, T>;

/** Configuración de racha general */
export interface Racha {
  /** Ronda actual (puede estar vacío) */
  topRound: RecordMap<PlayerRacha>;
  /** Récord del día, indexado por nombre de usuario */
  recordDiario: RecordMap<PlayerRacha>;
  /** Récord histórico, indexado por nombre de usuario */
  recordHistorico: RecordMap<PlayerRacha>;
  showPhoto: boolean;
  showCoins: boolean;
}

/** Configuración de racha versus */
export interface RachaVersus {
  /** Usuarios que hicieron "salvar", indexado por nombre de usuario */
  salvadas: RecordMap<PlayerVersus>;
  /** Usuarios que hicieron "reiniciar", indexado por nombre de usuario */
  reinicios: RecordMap<PlayerVersus>;
  showName: boolean;
  showCount: boolean;
  showCoins: boolean;
}

/** Configuración de bolita/globos */
export interface Bolita {
  allowFree: boolean;
  multiplicador: number;
  quiereMeGlobos: number;
  followGlobos: number;
  /** Cooldown en segundos para follow */
  followCooldown: number;
  /** Palabra de chat para globos (separadas por coma) */
  chatWord: string;
  chatGlobos: number;
  /** Cooldown en segundos para palabra de chat */
  chatCooldown: number;
  likesMeta: number;
  likesGlobos: number;
}

/** Estilo de meta de likes */
export interface MetaLikesStyle {
  fontFamily: string;
  color: string;
  shadowColor: string;
  fontSize: number;
}

/** Configuración de meta de likes */
export interface MetaLikes {
  active: boolean;
  firstGoal: number;
  prefixText: string;
  step: number;
  actionText: string;
  currentGoal: number;
  style: MetaLikesStyle;
}

/** Configuración de top likes */
export interface TopLikes {
  currentRound: RecordMap<PlayerTop>;
  recordHistorico: RecordMap<PlayerTop>;
  mirrorMode: boolean;
}

/** Configuración de top VIP */
export interface TopVIP {
  currentRound: RecordMap<PlayerTop>;
  recordHistorico: RecordMap<PlayerTop>;
  /** Límite de usuarios visibles */
  displayLimit: number;
  mirrorMode: boolean;
}

/** Estructura principal del backup */
export interface Backup {
  /** Equipo 1 de la batalla */
  equipo1: Equipo;
  /** Equipo 2 de la batalla */
  equipo2: Equipo;
  enableCountdown: boolean;
  showTopText: boolean;
  showDonatorCoins: boolean;
  showEmoticons: boolean;
  roundGifts: boolean;
  showTopDonators: boolean;
  /** Segundos de la cuenta regresiva */
  countdownSeconds: number;
  battleStyle: BattleStyle;
  /** Historial de usuarios recientes */
  historial: string[];
  username: string;
  /** Catálogo de regalos disponibles */
  regalosDisponibles: Regalo[];
  racha: Racha;
  rachaVersus: RachaVersus;
  bolita: Bolita;
  metaLikes: MetaLikes;
  topLikes: TopLikes;
  topVIP: TopVIP;
}
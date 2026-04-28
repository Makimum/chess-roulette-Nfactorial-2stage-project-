// Frontend-only учебный контент. Все FEN — заранее посчитанные литералы,
// никакого рантайм-движка для генерации позиций не требуется.

export type LearningCategory = "terms" | "openings";

export type BoardHighlight = {
  square: string;
  type: "from" | "to" | "target" | "danger" | "safe";
};

export type LearningStep = {
  title: string;
  description: string;
  fen: string;
  /** UCI-нотация хода, например "e2e4" — для подсветки last-move на доске. */
  move?: string;
  highlights?: BoardHighlight[];
};

export type LearningLesson = {
  id: string;
  category: LearningCategory;
  titleRu: string;
  titleEn?: string;
  subtitle?: string;
  /** Эмодзи или короткая иконка-строка (lucide name). Сейчас используется как эмодзи. */
  icon?: string;
  steps: LearningStep[];
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// =====================
// Термины (по 1 шагу)
// =====================
const TERMS: LearningLesson[] = [
  {
    id: "check",
    category: "terms",
    titleRu: "Шах",
    titleEn: "Check",
    subtitle: "Угроза королю",
    icon: "♚",
    steps: [
      {
        title: "Король под атакой",
        description:
          "Шах — нападение фигуры на короля. Здесь белая ладья e1 атакует чёрного короля e8 по открытой линии. Чёрные обязаны защититься: уйти королём, закрыться фигурой или взять ладью.",
        fen: "4k3/8/8/8/8/8/8/4R1K1 b - - 0 1",
        highlights: [
          { square: "e1", type: "from" },
          { square: "e8", type: "danger" },
        ],
      },
    ],
  },
  {
    id: "checkmate",
    category: "terms",
    titleRu: "Мат",
    titleEn: "Checkmate",
    subtitle: "Конец партии",
    icon: "♛",
    steps: [
      {
        title: "Детский мат",
        description:
          "Мат — это шах, от которого нельзя защититься. Классический «детский мат»: белый ферзь на f7 при поддержке слона на c4. У чёрного короля нет ни одного безопасного поля.",
        fen: "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
        highlights: [
          { square: "f7", type: "from" },
          { square: "e8", type: "danger" },
          { square: "c4", type: "safe" },
        ],
      },
    ],
  },
  {
    id: "stalemate",
    category: "terms",
    titleRu: "Пат",
    titleEn: "Stalemate",
    subtitle: "Ничья без шаха",
    icon: "½",
    steps: [
      {
        title: "Нет ходов, но и шаха нет",
        description:
          "Пат — ситуация, когда у игрока нет ни одного легального хода, но его король при этом не под шахом. Партия заканчивается вничью.",
        fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
        highlights: [
          { square: "h8", type: "danger" },
          { square: "f7", type: "from" },
        ],
      },
    ],
  },
  {
    id: "castling",
    category: "terms",
    titleRu: "Рокировка",
    titleEn: "Castling",
    subtitle: "Король и ладья — одним ходом",
    icon: "♜",
    steps: [
      {
        title: "Короткая рокировка белых",
        description:
          "Рокировка — единственный ход, в котором двигаются сразу две фигуры. Король перемещается на два поля к ладье, а ладья перепрыгивает через него. Здесь показана позиция после короткой рокировки белых.",
        fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4",
        move: "e1g1",
        highlights: [
          { square: "g1", type: "to" },
          { square: "f1", type: "to" },
        ],
      },
    ],
  },
  {
    id: "fork",
    category: "terms",
    titleRu: "Вилка",
    titleEn: "Fork",
    subtitle: "Двойной удар",
    icon: "♞",
    steps: [
      {
        title: "Конь нападает сразу на двоих",
        description:
          "Вилка — одновременное нападение одной фигурой на две (или больше) цели. Конь — мастер вилок: он бьёт сразу короля и ферзя, и одну фигуру неизбежно теряет противник.",
        fen: "r3k2r/ppp2ppp/8/3N4/8/8/PPP2PPP/R3K2R w - - 0 1",
        highlights: [
          { square: "d5", type: "from" },
          { square: "e7", type: "target" },
          { square: "c7", type: "target" },
          { square: "f6", type: "target" },
        ],
      },
    ],
  },
  {
    id: "pin",
    category: "terms",
    titleRu: "Связка",
    titleEn: "Pin",
    subtitle: "Фигура не может уйти",
    icon: "♝",
    steps: [
      {
        title: "Слон сковывает коня",
        description:
          "Связка — атака на фигуру, за которой по той же линии стоит более ценная фигура. Здесь белый слон на b5 связывает чёрного коня c6: если конь уйдёт, белые заберут ферзя.",
        fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
        highlights: [
          { square: "b5", type: "from" },
          { square: "c6", type: "danger" },
          { square: "d8", type: "target" },
        ],
      },
    ],
  },
  {
    id: "gambit",
    category: "terms",
    titleRu: "Гамбит",
    titleEn: "Gambit",
    subtitle: "Жертва ради инициативы",
    icon: "♟",
    steps: [
      {
        title: "Королевский гамбит",
        description:
          "Гамбит — добровольная жертва пешки (реже фигуры) в дебюте ради быстрого развития и атаки. Классический пример — Королевский гамбит: 1.e4 e5 2.f4.",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3 0 2",
        move: "f2f4",
        highlights: [
          { square: "f4", type: "to" },
          { square: "f2", type: "from" },
        ],
      },
    ],
  },
  {
    id: "zugzwang",
    category: "terms",
    titleRu: "Цугцванг",
    titleEn: "Zugzwang",
    subtitle: "Любой ход — во вред",
    icon: "⏳",
    steps: [
      {
        title: "Когда ход — наказание",
        description:
          "Цугцванг — позиция, в которой игроку невыгодно делать любой ход, но пропустить его нельзя. Часто встречается в эндшпиле: чёрные обязаны ходить королём и пускают белого короля вперёд.",
        fen: "8/8/8/3k4/8/3K4/3P4/8 b - - 0 1",
        highlights: [
          { square: "d5", type: "danger" },
          { square: "d3", type: "from" },
        ],
      },
    ],
  },
];

// =====================
// Дебюты (несколько шагов)
// =====================
const OPENINGS: LearningLesson[] = [
  {
    id: "sicilian",
    category: "openings",
    titleRu: "Сицилианская защита",
    titleEn: "Sicilian Defence",
    subtitle: "Самый популярный ответ на 1.e4",
    icon: "🛡️",
    steps: [
      {
        title: "1. e4",
        description: "Белые занимают центр пешкой e4 и открывают диагонали для слона и ферзя.",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        move: "e2e4",
      },
      {
        title: "1... c5",
        description:
          "Сицилианская защита! Чёрные не идут на симметрию, а сразу контратакуют центр с фланга, создавая асимметричную игру.",
        fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
        move: "c7c5",
      },
      {
        title: "2. Nf3",
        description: "Белые развивают коня и готовят d2-d4, чтобы вскрыть центр.",
        fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        move: "g1f3",
      },
      {
        title: "2... d6",
        description:
          "Чёрные укрепляют поле e5 и готовят развитие коня g8 на f6. Это вход в Найдорфа и другие основные системы.",
        fen: "rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
        move: "d7d6",
      },
    ],
  },
  {
    id: "ruy-lopez",
    category: "openings",
    titleRu: "Испанская партия",
    titleEn: "Ruy López",
    subtitle: "Старейший открытый дебют",
    icon: "👑",
    steps: [
      {
        title: "1. e4 e5",
        description: "Классический симметричный ответ — оба игрока борются за центр.",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        move: "e7e5",
      },
      {
        title: "2. Nf3",
        description: "Нападение на пешку e5 и развитие.",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        move: "g1f3",
      },
      {
        title: "2... Nc6",
        description: "Чёрные защищают пешку, развивая коня в активную позицию.",
        fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        move: "b8c6",
      },
      {
        title: "3. Bb5",
        description:
          "Главный ход Испанки! Слон давит на коня c6 — защитника центральной пешки.",
        fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
        move: "f1b5",
      },
      {
        title: "3... a6",
        description:
          "Морфи-защита: чёрные ставят вопрос слону. Белые обычно отступают на a4, сохраняя давление.",
        fen: "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
        move: "a7a6",
      },
    ],
  },
  {
    id: "queens-gambit",
    category: "openings",
    titleRu: "Ферзёвый гамбит",
    titleEn: "Queen's Gambit",
    subtitle: "Закрытый центр и медленная игра",
    icon: "♕",
    steps: [
      {
        title: "1. d4 d5",
        description: "Оба игрока ставят пешки в центр и борются за поле e4 / e5.",
        fen: "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d6 0 2",
        move: "d7d5",
      },
      {
        title: "2. c4",
        description:
          "Ферзёвый гамбит: белые предлагают пешку c4. Принять её непросто — удержать материал чёрным сложно.",
        fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2",
        move: "c2c4",
      },
      {
        title: "2... e6",
        description:
          "Отказанный ферзёвый гамбит: чёрные укрепляют центр и готовят спокойное развитие.",
        fen: "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
        move: "e7e6",
      },
    ],
  },
];

export const LEARNING_LESSONS: LearningLesson[] = [...TERMS, ...OPENINGS];

export function getLessonsByCategory(category: LearningCategory): LearningLesson[] {
  return LEARNING_LESSONS.filter((l) => l.category === category);
}

export function getLessonById(id: string | null | undefined): LearningLesson | null {
  if (!id) return null;
  return LEARNING_LESSONS.find((l) => l.id === id) ?? null;
}

export const LEARNING_START_FEN = START_FEN;

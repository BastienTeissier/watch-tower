// The 18 Species. Frames, eye cells and colour rules are a hand port of
// the claude-ble-buddy firmware's species headers.

/** 'shell' takes the state colour, 'body' the fixed body tint, anything else is a literal colour. */
export type Paint = (row: number, ch: string) => string

export type Species = {
  frames: readonly (readonly string[])[]
  eye: readonly [row: number, col: number]
  paint: Paint
}

export const FRAME_W = 12
export const FRAME_H = 5

const BILL = '#ff8c00'
const SLIME = '#6ec8ff'
// Black on the LCD; grey here so the spiral stays visible on dark terminals.
const SPIRAL = '#555555'

export const SPECIES = {
  snail: {
    frames: [
      [
        "            ",
        " .    .--.  ",
        "  \\  ( @ )  ",
        "   \\_`--'   ",
        "  ~~~~~~~   ",
      ],
      [
        "            ",
        " .    .--.  ",
        "  |  ( @ )  ",
        "   \\_`--'   ",
        "  ~~~~~~~   ",
      ],
      [
        "            ",
        " .    .--.  ",
        "  \\  ( @  ) ",
        "   \\_`--'   ",
        "   ~~~~~~   ",
      ],
    ],
    eye: [1, 1],
    paint: (_, ch) => (ch === '~' ? SLIME : ch === '@' ? SPIRAL : '\\|_'.includes(ch) ? 'body' : 'shell'),
  },
  duck: {
    frames: [
      [
        "     __     ",
        "   _(  )>   ",
        "  /     \\   ",
        "  \\_____/   ",
        "    ^ ^     ",
      ],
      [
        "     __     ",
        "   _(  )>   ",
        "  /-----\\   ",
        "  \\_____/   ",
        "    ^ ^     ",
      ],
      [
        "     __     ",
        "   _(  )>   ",
        "  /     \\   ",
        "  \\_____/   ",
        "     ^^     ",
      ],
    ],
    eye: [1, 5],
    paint: (_, ch) => ('>^'.includes(ch) ? BILL : ch === '_' ? 'body' : 'shell'),
  },
  goose: {
    frames: [
      [
        "    _       ",
        "   ( )>     ",
        "    |       ",
        "   /   \\    ",
        "   ^^ ^^    ",
      ],
      [
        "    _       ",
        "   ( )>     ",
        "     |      ",
        "   /   \\    ",
        "   ^^ ^^    ",
      ],
      [
        "    _       ",
        "   ( )>     ",
        "    |       ",
        "   /   \\    ",
        "    ^^^^    ",
      ],
    ],
    eye: [1, 4],
    paint: (_, ch) => ('>^'.includes(ch) ? BILL : '_|'.includes(ch) ? 'body' : 'shell'),
  },
  blob: {
    frames: [
      [
        "    .--.    ",
        "   (    )   ",
        "   (    )   ",
        "   (    )   ",
        "    '--'    ",
      ],
      [
        "    .--.    ",
        "   (    )   ",
        "  (      )  ",
        "   (    )   ",
        "    '--'    ",
      ],
      [
        "    .--.    ",
        "   (    )   ",
        "   (    )   ",
        "   (    )   ",
        "    '~~'    ",
      ],
    ],
    eye: [1, 5],
    paint: () => 'shell',
  },
  cat: {
    frames: [
      [
        "   /\\/\\     ",
        "   (..)     ",
        "   /    \\   ",
        "   \\____/   ",
        "    ~~~~    ",
      ],
      [
        "   /\\/\\     ",
        "   (..)     ",
        "   /    \\   ",
        "   \\____/   ",
        "    ~~~ ~   ",
      ],
      [
        "   /\\/\\     ",
        "   (..)     ",
        "   /    \\   ",
        "   \\____/   ",
        "   ~ ~~~~   ",
      ],
    ],
    eye: [1, 4],
    paint: (_, ch) => (ch === '~' ? 'body' : 'shell'),
  },
  dragon: {
    frames: [
      [
        "   /\\ /\\    ",
        "   (oo)>    ",
        "   <==>     ",
        "   (==)     ",
        "    \\/      ",
      ],
      [
        "   /\\ /\\    ",
        "   (oo)>    ",
        "   <-->     ",
        "   (==)     ",
        "    \\/      ",
      ],
      [
        "   /\\ /\\    ",
        "   (oo)>    ",
        "   <==>     ",
        "   (==)     ",
        "    /\\      ",
      ],
    ],
    eye: [1, 4],
    paint: (_, ch) => (ch === '>' ? 'body' : 'shell'),
  },
  octopus: {
    frames: [
      [
        "   .---.    ",
        "  ( o o )   ",
        "   \\---/    ",
        "   /|||\\    ",
        "   |||||    ",
      ],
      [
        "   .---.    ",
        "  ( o o )   ",
        "   \\---/    ",
        "   /|||\\    ",
        "   /||||    ",
      ],
      [
        "   .---.    ",
        "  ( o o )   ",
        "   \\---/    ",
        "   /|||\\    ",
        "    ||||/   ",
      ],
    ],
    eye: [1, 4],
    paint: () => 'shell',
  },
  owl: {
    frames: [
      [
        "    .-.     ",
        "   (o o)    ",
        "   \\___/    ",
        "   |||||    ",
        "   ^^^^^    ",
      ],
      [
        "    .-.     ",
        "   (o o)    ",
        "   \\___/    ",
        "   ||/||    ",
        "   ^^^^^    ",
      ],
      [
        "    .-.     ",
        "   (o o)    ",
        "   \\___/    ",
        "   ||\\||    ",
        "   ^^^^^    ",
      ],
    ],
    eye: [1, 4],
    paint: () => 'shell',
  },
  penguin: {
    frames: [
      [
        "    .-.     ",
        "   (o.o)    ",
        "   |   |    ",
        "   |___|    ",
        "   /   \\    ",
      ],
      [
        "    .-.     ",
        "   (o.o)    ",
        "   |   |    ",
        "   |___|    ",
        "  /     \\   ",
      ],
      [
        "    .-.     ",
        "   (o.o)    ",
        "   |   |    ",
        "   |___|    ",
        "   /   \\    ",
      ],
    ],
    eye: [1, 4],
    paint: (_, ch) => ('|_'.includes(ch) ? 'body' : 'shell'),
  },
  turtle: {
    frames: [
      [
        "     ___    ",
        "    /===\\   ",
        "   |=====|  ",
        "    \\___/   ",
        "    ^   ^   ",
      ],
      [
        "     ___    ",
        "    /===\\   ",
        "   |=====|  ",
        "    \\___/   ",
        "   ^     ^  ",
      ],
      [
        "     ___    ",
        "    /===\\   ",
        "   |=====|  ",
        "    \\___/   ",
        "     ^ ^    ",
      ],
    ],
    eye: [2, 6],
    paint: (_, ch) => (ch === '=' ? 'shell' : 'body'),
  },
  ghost: {
    frames: [
      [
        "    ___     ",
        "   /    \\   ",
        "   |    |   ",
        "   |    |   ",
        "   /~~~~\\   ",
      ],
      [
        "    ___     ",
        "   /    \\   ",
        "   |    |   ",
        "   |    |   ",
        "   \\~~~~/   ",
      ],
      [
        "    ___     ",
        "   /    \\   ",
        "   |    |   ",
        "   |    |   ",
        "   /~~~~\\   ",
      ],
    ],
    eye: [1, 5],
    paint: () => 'shell',
  },
  axolotl: {
    frames: [
      [
        "   ~~~~~    ",
        "   (oo)     ",
        "  (    )--- ",
        "   |    |   ",
        "   ^^  ^^   ",
      ],
      [
        "   ~~ ~~    ",
        "   (oo)     ",
        "  (    )--- ",
        "   |    |   ",
        "   ^^  ^^   ",
      ],
      [
        "   ~~~~~    ",
        "   (oo)     ",
        "  (    )--- ",
        "   |    |   ",
        "    ^^^^    ",
      ],
    ],
    eye: [1, 4],
    paint: (_, ch) => ('-|^'.includes(ch) ? 'body' : 'shell'),
  },
  capybara: {
    frames: [
      [
        "     __     ",
        "    (..)>   ",
        "   /    \\   ",
        "  |      |  ",
        "   ||  ||   ",
      ],
      [
        "     __     ",
        "    (..)>   ",
        "   /    \\   ",
        "  |      |  ",
        "   || ||    ",
      ],
      [
        "     __     ",
        "    (..)>   ",
        "   /    \\   ",
        "  |      |  ",
        "    || ||   ",
      ],
    ],
    eye: [1, 5],
    paint: (_, ch) => ('|>_'.includes(ch) ? 'body' : 'shell'),
  },
  cactus: {
    frames: [
      [
        "     |      ",
        "   |-+-|    ",
        "   | o |    ",
        "   |___|    ",
        "   '---'    ",
      ],
      [
        "     |      ",
        "   \\-+-/    ",
        "   | o |    ",
        "   |___|    ",
        "   '---'    ",
      ],
      [
        "     |      ",
        "   |-+-|    ",
        "   | o |    ",
        "   |___|    ",
        "   '---'    ",
      ],
    ],
    eye: [2, 5],
    paint: row => (row === 4 ? 'body' : 'shell'),
  },
  robot: {
    frames: [
      [
        "   .====.   ",
        "   |    |   ",
        "   |o..o|   ",
        "   |    |   ",
        "    |  |    ",
      ],
      [
        "   .====.   ",
        "   |    |   ",
        "   |. oo|   ",
        "   |    |   ",
        "    |  |    ",
      ],
      [
        "   .====.   ",
        "   |    |   ",
        "   |oo .|   ",
        "   |    |   ",
        "    |  |    ",
      ],
    ],
    eye: [1, 5],
    paint: (_, ch) => ('=o'.includes(ch) ? 'shell' : 'body'),
  },
  rabbit: {
    frames: [
      [
        "   ||  ||   ",
        "   ||  ||   ",
        "   (oo)     ",
        "  (    )    ",
        "   ^^^^^    ",
      ],
      [
        "            ",
        "  --    --  ",
        "   (oo)     ",
        "  (    )    ",
        "   ^^^^^    ",
      ],
      [
        "   ||  ||   ",
        "   ||  ||   ",
        "   (oo)     ",
        "  (    )    ",
        "  ^^   ^^   ",
      ],
    ],
    eye: [2, 4],
    paint: (_, ch) => ('|^'.includes(ch) ? 'body' : 'shell'),
  },
  mushroom: {
    frames: [
      [
        "    .-.     ",
        "   (oOo)    ",
        "   |   |    ",
        "   |   |    ",
        "   '---'    ",
      ],
      [
        "    .-.     ",
        "   (oOo)    ",
        "   |. .|    ",
        "   |   |    ",
        "   '---'    ",
      ],
      [
        "    .-.     ",
        "   (oOo)    ",
        "   |   |    ",
        "   | . |    ",
        "   '---'    ",
      ],
    ],
    eye: [1, 4],
    paint: row => (row < 2 ? 'shell' : 'body'),
  },
  chonk: {
    frames: [
      [
        "   .----.   ",
        "  /  oo  \\  ",
        "  |  ..  |  ",
        "  |      |  ",
        "   '----'   ",
      ],
      [
        "   .----.   ",
        "  /  oo  \\  ",
        "  |  ..  |  ",
        "  |      |  ",
        "   '~~~~'   ",
      ],
      [
        "   .----.   ",
        "  /  oo  \\  ",
        "  |  ..  |  ",
        "  |      |  ",
        "   '----'   ",
      ],
    ],
    eye: [1, 5],
    paint: (_, ch) => (ch === '|' ? 'body' : 'shell'),
  },
} satisfies Record<string, Species>

/** The Species named `name`, or the default (snail) for an unknown name. */
export function speciesFor(name: string): Species {
  return (SPECIES as Record<string, Species>)[name] ?? SPECIES.snail
}

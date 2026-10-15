// Pane pieces, drawn with the surface's own elements: register.tsx resolves
// them from `$` and passes them in, so nothing here reaches the engine.
import type { ElementTable } from 'claude-code'

import type { Press, Row, Span } from './rows'
import { FRAME_H, FRAME_W } from './species'
import type { Species } from './species'
import { BODY_COLOR, EYE_COLOR, eyeGlyph } from './style'
import type { Style } from './style'

type Ui = Pick<ElementTable, 'Box' | 'Text' | 'Button'>

type Run = { text: string; color: string; isShell: boolean }

/** The key of the button a pressable row starts with. */
export const pressKey = (rowKey: string) => `press:${rowKey}`

const spanText = (Text: Ui['Text'], span: Span, at: number) => (
  <Text key={String(at)} color={span.color} dimColor={span.isDim} bold={span.isBold}>
    {span.text}
  </Text>
)

/**
 * One Row: the label truncates, the time on the right stays visible. A row
 * with `press` draws its first span as a plain button that calls `onPress`;
 * its `action` is a plain button at the end that calls `onAction`.
 */
export function rowLine({ Box, Button, Text }: Ui, row: Row, onPress?: (press: Press) => void, onAction?: (key: string) => void) {
  const { press } = row
  const [first, ...rest] = row.spans
  const isButton = press !== undefined && onPress !== undefined && first !== undefined

  return (
    <Box key={row.key}>
      <Box flexGrow={1}>
        {isButton && <Text>{'  '.repeat(row.indent)}</Text>}
        {isButton && <Button key={pressKey(row.key)} plain label={first.text} onPress={() => onPress(press)} />}
        <Text wrap="truncate-end">
          {!isButton && '  '.repeat(row.indent)}
          {(isButton ? rest : row.spans).map((span, at) => spanText(Text, span, at))}
        </Text>
      </Box>
      {row.right !== undefined && <Text dimColor>{` ${row.right}`}</Text>}
      {row.action !== undefined && onAction !== undefined && (
        <Button key={row.action.key} plain label={` ${row.action.label}`} onPress={() => onAction(row.action?.key ?? '')} />
      )}
    </Box>
  )
}

/** Sections of rows, with `rule` under each one that holds a row, but the last. */
export function sectionLines(ui: Ui, sections: Row[][], rule: string, onPress?: (press: Press) => void) {
  const { Text } = ui

  return sections.flatMap((rows, at) => [
    ...rows.map(row => rowLine(ui, row, onPress)),
    ...(rows.length > 0 && at < sections.length - 1 ? [<Text key={`rule:${at}`} dimColor>{rule}</Text>] : []),
  ])
}

/** One frame row as runs of same-coloured cells; spaces join the run before them. */
function rowRuns(species: Species, style: Style, frame: number, row: number): Run[] {
  const text = species.frames[frame % species.frames.length]?.[row] ?? ''
  const runs: Run[] = []

  for (let col = 0; col < FRAME_W; col += 1) {
    const isEye = row === species.eye[0] && col === species.eye[1]
    const ch = isEye ? eyeGlyph(style, frame) : (text[col] ?? ' ')
    const paint = isEye ? EYE_COLOR : species.paint(row, ch)
    const isShell = paint === 'shell'
    const color = isShell ? style.shell : paint === 'body' ? BODY_COLOR : paint
    const last = runs[runs.length - 1]

    if (last !== undefined && (ch === ' ' || (last.color === color && last.isShell === isShell))) {
      last.text += ch
    } else {
      runs.push({ text: ch, color, isShell })
    }
  }

  return runs
}

export type Companion = {
  species: Species
  style: Style
  frame: number
  message: string
  onTap?: (() => void) | undefined
  onShift: (by: 1 | -1) => void
}

/**
 * The pane's head: the companion's state, sprite and `◀ ▶` (calling `onShift`)
 * on the left, `rows` on its
 * right, then its message and `Tap` while it alerts (`onTap` set); `rows` alone
 * without a companion. `rule` closes it; a row's button calls `onAction`.
 */
export function headerLines(
  ui: Ui,
  { companion, rows, rule, onAction }: { companion: Companion | null; rows: Row[]; rule: string; onAction: (key: string) => void },
) {
  const { Box, Button, Text } = ui
  const lines = rows.map(row => rowLine(ui, row, undefined, onAction))
  if (companion === null) {
    return (
      <Box flexDirection="column">
        {lines}
        {lines.length > 0 && <Text dimColor>{rule}</Text>}
      </Box>
    )
  }

  const { species, style, frame, message, onTap, onShift } = companion
  const isDimmedPulse = style.isPulsing && frame % 2 === 1

  return (
    <Box flexDirection="column">
      <Box>
        <Box flexDirection="column" width={FRAME_W} flexShrink={0} marginRight={2}>
          <Text bold color={style.shell}>
            {style.name}
          </Text>
          {Array.from({ length: FRAME_H }, (_, row) => (
            <Box>
              {rowRuns(species, style, frame, row).map(run => (
                <Text color={run.color} bold dimColor={run.isShell && isDimmedPulse}>
                  {run.text}
                </Text>
              ))}
            </Box>
          ))}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {lines}
        </Box>
      </Box>
      {/* Outside the sprite's fixed width, so a wider desktop button is not clipped. */}
      <Box flexShrink={0}>
        <Button key="species-prev" plain label="◀" onPress={() => onShift(-1)} />
        <Text> </Text>
        <Button key="species-next" plain label="▶" onPress={() => onShift(1)} />
      </Box>
      <Text wrap="wrap">{message === '' ? ' ' : message}</Text>
      {onTap !== undefined && <Button key="tap" label="Tap" hotkey="t" onPress={onTap} />}
      <Text dimColor>{rule}</Text>
    </Box>
  )
}

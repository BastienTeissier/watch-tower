// Pane pieces, drawn with the surface's own elements: register.tsx resolves
// them from `$` and passes them in, so nothing here reaches the engine.
import type { ElementTable } from 'claude-code'

import type { Gauge } from '../types'
import type { Press, Row, Span } from './rows'
import { FRAME_H, FRAME_W } from './species'
import type { Species } from './species'
import { BODY_COLOR, EYE_COLOR, countdown, eyeGlyph, gaugeBar, gaugeColor } from './style'
import type { Style } from './style'

type Ui = Pick<ElementTable, 'Box' | 'Text' | 'Button'>

type Run = { text: string; color: string; isShell: boolean }

/** The key of the button a pressable row starts with. */
export const pressKey = (rowKey: string) => `press:${rowKey}`

const spanText = (Text: Ui['Text'], span: Span, at: number) => (
  <Text key={String(at)} color={span.color} dimColor={span.isDim}>
    {span.text}
  </Text>
)

/**
 * One Row: the label truncates, the time on the right stays visible. A row
 * with `press` draws its first span as a plain button that calls `onPress`.
 */
export function rowLine({ Box, Button, Text }: Ui, row: Row, onPress?: (press: Press) => void) {
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
    </Box>
  )
}

/** One Quota gauge, dimmed when its sample is stale; nothing when unknown. */
export function gaugeLine({ Box, Text }: Ui, label: string, gauge: Gauge | null, now: number, isStale: boolean) {
  return (
    gauge !== null && (
      <Box>
        <Text dimColor>{label} </Text>
        <Text color={gaugeColor(gauge.pct)} dimColor={isStale}>
          {gaugeBar(gauge.pct)}
        </Text>
        <Text dimColor={isStale}> {gauge.pct}%</Text>
        {gauge.resetsAt !== null && <Text dimColor> in {countdown(Math.floor((gauge.resetsAt - now) / 1000))}</Text>}
      </Box>
    )
  )
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

/** The companion, last in the pane: its state, sprite and message, and `Tap` while it alerts (`onTap` set). */
export function companionLines(
  { Box, Button, Text }: Ui,
  { species, style, frame, message, rule, onTap }: { species: Species; style: Style; frame: number; message: string; rule: string; onTap?: () => void },
) {
  const isDimmedPulse = style.isPulsing && frame % 2 === 1

  return (
    <Box flexDirection="column">
      <Text dimColor>{rule}</Text>
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
      <Text wrap="wrap">{message === '' ? ' ' : message}</Text>
      {onTap !== undefined && <Button key="tap" label="Tap" hotkey="t" onPress={onTap} />}
    </Box>
  )
}

// Pane pieces, drawn with the surface's own elements: register.tsx resolves
// them from `$` and passes them in, so nothing here reaches the engine.
import type { ElementTable } from 'claude-code'

import type { Gauge } from '../types'
import type { Press, Row, Span } from './rows'
import { countdown, gaugeBar, gaugeColor } from './style'

type Ui = Pick<ElementTable, 'Box' | 'Text' | 'Button'>

const spanText = (Text: Ui['Text'], span: Span, at: number) => (
  <Text key={at} color={span.color} dimColor={span.isDim}>
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
        {isButton && <Button key={`press:${row.key}`} plain label={first.text} onPress={() => onPress(press)} />}
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

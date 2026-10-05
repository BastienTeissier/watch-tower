// Pane pieces, drawn with the surface's own elements: register.tsx resolves
// them from `$` and passes them in, so nothing here reaches the engine.
import type { ElementTable } from 'claude-code'

import type { Gauge } from '../types'
import type { Row } from './rows'
import { countdown, gaugeBar, gaugeColor } from './style'

type Ui = Pick<ElementTable, 'Box' | 'Text'>

/** One Row: the label truncates, the time on the right stays visible. */
export function rowLine({ Box, Text }: Ui, row: Row) {
  return (
    <Box key={row.key}>
      <Box flexGrow={1}>
        <Text wrap="truncate-end">
          {'  '.repeat(row.indent)}
          {row.spans.map((span, at) => (
            <Text key={at} color={span.color} dimColor={span.isDim}>
              {span.text}
            </Text>
          ))}
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

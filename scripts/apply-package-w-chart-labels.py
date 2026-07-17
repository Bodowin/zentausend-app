from pathlib import Path
import re


path = Path('src/components/GameChart.tsx')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one GameChart match, found {count}: {old[:100]!r}')
    text = text.replace(old, new, 1)


if "import { spreadChartLabels } from '../lib/chartLabelLayout'" not in text:
    replace_once(
        "import { playerColor } from '../lib/colors'\n",
        "import { playerColor } from '../lib/colors'\nimport { spreadChartLabels } from '../lib/chartLabelLayout'\n",
    )

if 'const endLabels = new Map(' not in text:
    replace_once(
        "const y = (v: number) => PAD.t + ih - (v / yMax) * ih\n\n  const fmtShort",
        "const y = (v: number) => PAD.t + ih - (v / yMax) * ih\n  const endLabels = new Map(\n    directLabels\n      ? spreadChartLabels(\n          series.map((entry) => ({\n            id: entry.name,\n            y: y(entry.pts[entry.pts.length - 1]),\n          })),\n          PAD.t + 6,\n          PAD.t + ih - 6,\n          12,\n        ).map((entry) => [entry.id, entry.labelY] as const)\n      : [],\n  )\n\n  const fmtShort",
    )

if 'const labelY = endLabels.get(s.name)' not in text:
    replace_once(
        "const lastV = s.pts[s.pts.length - 1]\n              return (",
        "const lastV = s.pts[s.pts.length - 1]\n              const lineY = y(lastV)\n              const labelY = endLabels.get(s.name) ?? lineY\n              return (",
    )

if 'paintOrder="stroke"' not in text:
    pattern = re.compile(
        r'''\{directLabels\s*&&\s*\(\s*'''
        r'''<text\s+x=\{x\(steps\)\s*\+\s*7\}\s+y=\{y\(lastV\)\s*\+\s*3\}\s+fontSize=\{9\}\s+fontWeight=\{700\}\s+fill="#aab3c7">\s*'''
        r'''\{s\.name\.length\s*>\s*6\s*\?\s*`\$\{s\.name\.slice\(0,\s*6\)\}…`\s*:\s*s\.name\}\s*'''
        r'''</text>\s*\)\}''',
        re.DOTALL,
    )
    replacement = '''{directLabels && (
                     <>
                       {Math.abs(labelY - lineY) > 1 && (
                         <line
                           x1={x(steps) + 3}
                           x2={x(steps) + 7}
                           y1={lineY}
                           y2={labelY}
                           stroke={c}
                           strokeWidth={1}
                           opacity={0.65}
                         />
                       )}
                       <text
                         x={x(steps) + 8}
                         y={labelY + 3}
                         fontSize={9}
                         fontWeight={700}
                         fill="#c4ccdc"
                         stroke="#0e1320"
                         strokeWidth={3}
                         paintOrder="stroke"
                       >
                         {s.name.length > 6 ? `${s.name.slice(0, 6)}…` : s.name}
                       </text>
                     </>
                   )}'''
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f'Expected one direct-label SVG block, found {count}')

path.write_text(text)

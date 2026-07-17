from pathlib import Path
import re

path = Path('src/components/GameChart.tsx')
text = path.read_text()
if 'paintOrder="stroke"' in text:
    raise SystemExit(0)

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
next_text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'Expected one direct-label SVG block, found {count}')
path.write_text(next_text)

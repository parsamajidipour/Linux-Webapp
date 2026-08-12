import { useCallback, useEffect, useState } from 'react'
import { Delete } from 'lucide-react'

function format(n: number): string {
  if (!isFinite(n)) return 'Error'
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6)
  const s = String(n)
  return s.length > 12 ? String(parseFloat(n.toPrecision(10))) : s
}

function Btn({
  label,
  onClick,
  variant = 'num',
  span = false,
}: {
  label: React.ReactNode
  onClick: () => void
  variant?: 'num' | 'op' | 'fn' | 'eq'
  span?: boolean
}) {
  const base = 'cal-btn h-14 rounded-xl text-[19px] font-medium flex items-center justify-center select-none'
  const styles = {
    num: 'bg-[#454540] hover:bg-[#52524c] text-white',
    fn: 'bg-[#383834] hover:bg-[#444440] text-neutral-300 text-[16px]',
    op: 'text-white text-[22px]',
    eq: 'text-white text-[22px]',
  }
  const style = variant === 'op' || variant === 'eq' ? { background: 'var(--ubuntu-accent)' } : undefined
  return (
    <button
      className={`${base} ${styles[variant]} ${span ? 'col-span-2' : ''}`}
      style={style}
      onMouseEnter={(e) => {
        if (variant === 'op' || variant === 'eq') e.currentTarget.style.background = 'var(--ubuntu-accent-hover)'
      }}
      onMouseLeave={(e) => {
        if (variant === 'op' || variant === 'eq') e.currentTarget.style.background = 'var(--ubuntu-accent)'
      }}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function CalculatorApp() {
  const [display, setDisplay] = useState('0')
  const [expr, setExpr] = useState('')
  const [acc, setAcc] = useState<number | null>(null)
  const [op, setOp] = useState<string | null>(null)
  const [fresh, setFresh] = useState(true)

  const inputDigit = useCallback(
    (d: string) => {
      if (fresh) {
        setDisplay(d === '.' ? '0.' : d)
        setFresh(false)
      } else {
        if (d === '.' && display.includes('.')) return
        if (display.replace(/[-.]/g, '').length >= 12) return
        setDisplay(display === '0' && d !== '.' ? d : display + d)
      }
    },
    [display, fresh],
  )

  const applyOp = useCallback(
    (a: number, b: number, o: string): number => {
      switch (o) {
        case '+':
          return a + b
        case '−':
          return a - b
        case '×':
          return a * b
        case '÷':
          return b === 0 ? NaN : a / b
        default:
          return b
      }
    },
    [],
  )

  const pressOp = useCallback(
    (o: string) => {
      const cur = parseFloat(display)
      if (acc !== null && op && !fresh) {
        const result = applyOp(acc, cur, op)
        setAcc(result)
        setExpr(`${format(result)} ${o}`)
        setDisplay(format(result))
      } else {
        setAcc(cur)
        setExpr(`${format(cur)} ${o}`)
      }
      setOp(o)
      setFresh(true)
    },
    [acc, op, display, fresh, applyOp],
  )

  const equals = useCallback(() => {
    if (op === null || acc === null) return
    const cur = parseFloat(display)
    const result = applyOp(acc, cur, op)
    setExpr(`${format(acc)} ${op} ${format(cur)} =`)
    setDisplay(format(result))
    setAcc(null)
    setOp(null)
    setFresh(true)
  }, [acc, op, display, applyOp])

  const clearAll = useCallback(() => {
    setDisplay('0')
    setExpr('')
    setAcc(null)
    setOp(null)
    setFresh(true)
  }, [])

  const backspace = useCallback(() => {
    if (fresh) return
    setDisplay((d) => (d.length <= 1 || (d.length === 2 && d.startsWith('-')) ? '0' : d.slice(0, -1)))
  }, [fresh])

  const negate = useCallback(() => {
    setDisplay((d) => (d === '0' ? d : d.startsWith('-') ? d.slice(1) : '-' + d))
  }, [])

  const percent = useCallback(() => {
    setDisplay((d) => format(parseFloat(d) / 100))
    setFresh(true)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9.]$/.test(e.key)) inputDigit(e.key)
      else if (e.key === '+') pressOp('+')
      else if (e.key === '-') pressOp('−')
      else if (e.key === '*') pressOp('×')
      else if (e.key === '/') {
        e.preventDefault()
        pressOp('÷')
      } else if (e.key === 'Enter' || e.key === '=') equals()
      else if (e.key === 'Backspace') backspace()
      else if (e.key === 'Escape') clearAll()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [inputDigit, pressOp, equals, backspace, clearAll])

  return (
    <div className="flex flex-col h-full bg-[#2c2c28] p-3 gap-2">
      {/* Display */}
      <div className="px-3 pt-2 pb-3 text-right">
        <div className="text-[14px] text-neutral-400 h-5 truncate terminal-font">{expr || '\u00a0'}</div>
        <div className="text-[40px] leading-tight font-light text-white truncate terminal-font">{display}</div>
      </div>
      {/* Keypad */}
      <div className="grid grid-cols-4 gap-2 flex-1">
        <Btn label="AC" variant="fn" onClick={clearAll} />
        <Btn label={<Delete size={19} />} variant="fn" onClick={backspace} />
        <Btn label="%" variant="fn" onClick={percent} />
        <Btn label="÷" variant="op" onClick={() => pressOp('÷')} />
        <Btn label="7" onClick={() => inputDigit('7')} />
        <Btn label="8" onClick={() => inputDigit('8')} />
        <Btn label="9" onClick={() => inputDigit('9')} />
        <Btn label="×" variant="op" onClick={() => pressOp('×')} />
        <Btn label="4" onClick={() => inputDigit('4')} />
        <Btn label="5" onClick={() => inputDigit('5')} />
        <Btn label="6" onClick={() => inputDigit('6')} />
        <Btn label="−" variant="op" onClick={() => pressOp('−')} />
        <Btn label="1" onClick={() => inputDigit('1')} />
        <Btn label="2" onClick={() => inputDigit('2')} />
        <Btn label="3" onClick={() => inputDigit('3')} />
        <Btn label="+" variant="op" onClick={() => pressOp('+')} />
        <Btn label="±" variant="fn" onClick={negate} />
        <Btn label="0" onClick={() => inputDigit('0')} />
        <Btn label="." onClick={() => inputDigit('.')} />
        <Btn label="=" variant="eq" onClick={equals} />
      </div>
    </div>
  )
}

import { describe, expect, it } from 'vitest'
import { compareWithBenchmark, priceAt, MSCI_WORLD } from './benchmark'
import { parseFlexDate, parseLocaleNumber, parseTradesCsv } from './ibkr'
import type { Snapshot, Transaction } from './types'

describe('parseLocaleNumber', () => {
  it('liest US- und DE-Formate', () => {
    expect(parseLocaleNumber('1,234.56')).toBeCloseTo(1234.56)
    expect(parseLocaleNumber('1.234,56')).toBeCloseTo(1234.56)
    expect(parseLocaleNumber('185,5')).toBeCloseTo(185.5)
    expect(parseLocaleNumber('-2.5')).toBeCloseTo(-2.5)
  })
})

describe('parseFlexDate', () => {
  it('liest ISO, kompakt und deutsch', () => {
    expect(parseFlexDate('2026-01-15, 09:30:00')).toBe('2026-01-15')
    expect(parseFlexDate('20260115')).toBe('2026-01-15')
    expect(parseFlexDate('15.01.2026')).toBe('2026-01-15')
  })
})

describe('parseTradesCsv', () => {
  it('parst ein IBKR Activity Statement (Trades-Sektion)', () => {
    const csv = [
      'Statement,Header,Field Name,Field Value',
      'Statement,Data,BrokerName,Interactive Brokers',
      'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Exchange,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code',
      'Trades,Data,Order,Stocks,USD,AAPL,"2026-01-15, 09:30:00",NASDAQ,10,185.5,186,-1855,-1,1856,0,5,O',
      'Trades,Data,Order,Stocks,USD,MSFT,"2026-02-01, 10:00:00",NASDAQ,-5,430,431,2150,-1.2,-2100,48.8,-5,C',
      'Trades,SubTotal,,Stocks,USD,,,,5,,,295,-2.2,,,',
    ].join('\n')
    const result = parseTradesCsv(csv)
    expect(result.source).toBe('ibkr-activity')
    expect(result.trades).toHaveLength(2)
    expect(result.trades[0]).toMatchObject({
      symbol: 'AAPL', date: '2026-01-15', shares: 10, price: 185.5,
      currency: 'USD', fees: 1, type: 'buy',
    })
    expect(result.trades[1].type).toBe('sell')
    expect(result.trades[1].shares).toBe(5)
  })

  it('parst eine Flex Query mit Buy/Sell-Spalte', () => {
    const csv = [
      'CurrencyPrimary,Symbol,TradeDate,Quantity,TradePrice,IBCommission,Buy/Sell',
      'USD,NVDA,20260310,12,105.5,-1,BUY',
      'EUR,SAP,20260311,4,260,-1.25,SELL',
    ].join('\n')
    const result = parseTradesCsv(csv)
    expect(result.source).toBe('ibkr-flex')
    expect(result.trades).toHaveLength(2)
    expect(result.trades[0].type).toBe('buy')
    expect(result.trades[1]).toMatchObject({ symbol: 'SAP', type: 'sell', currency: 'EUR' })
  })

  it('parst generisches deutsches CSV mit Semikolon', () => {
    const csv = [
      'Datum;Ticker;Typ;Stück;Kurs;Gebühren;Währung',
      '15.03.2026;ALV;Kauf;8;350,50;1,00;EUR',
      '16.03.2026;NOVO;Verkauf;10;60,25;1,00;EUR',
    ].join('\n')
    const result = parseTradesCsv(csv)
    expect(result.source).toBe('generisch')
    expect(result.trades[0]).toMatchObject({
      symbol: 'ALV', date: '2026-03-15', shares: 8, price: 350.5, type: 'buy',
    })
    expect(result.trades[1].type).toBe('sell')
  })

  it('liefert leeres Ergebnis bei unbrauchbarem Text', () => {
    const result = parseTradesCsv('hallo welt\nnur text')
    expect(result.trades).toHaveLength(0)
    expect(result.source).toBeNull()
  })
})

describe('benchmark', () => {
  it('priceAt klemmt an den Rändern und interpoliert monatlich', () => {
    expect(priceAt(MSCI_WORLD.series, '2010-01-01')).toBe(MSCI_WORLD.series[0].price)
    expect(priceAt(MSCI_WORLD.series, '2030-01-01')).toBe(
      MSCI_WORLD.series[MSCI_WORLD.series.length - 1].price,
    )
    expect(priceAt(MSCI_WORLD.series, '2025-01-15')).toBeCloseTo(96, 0)
  })

  it('spiegelt Käufe in Benchmark-Anteile', () => {
    const txs: Transaction[] = [
      { id: '1', instrumentId: 'X', type: 'buy', date: '2025-01-10', shares: 10, price: 100, fees: 0 },
    ]
    const snaps: Snapshot[] = [{ date: '2025-06-28', invested: 1000, totalValue: 1100 }]
    const cmp = compareWithBenchmark(txs, snaps, {
      date: '2026-01-02',
      invested: 1000,
      value: 1150,
    })!
    expect(cmp).not.toBeNull()
    // 1.000 € / 96 ≈ 10,4 Anteile; bei ~106 im Jan 26 ≈ 1.104 €
    const lastBench = cmp.benchmark[cmp.benchmark.length - 1]
    expect(lastBench).toBeGreaterThan(1050)
    expect(lastBench).toBeLessThan(1160)
    expect(cmp.depotReturnPct).toBeCloseTo(15, 5)
    expect(cmp.alphaPct).toBeCloseTo(cmp.depotReturnPct - cmp.benchReturnPct, 5)
  })

  it('null ohne Transaktionen', () => {
    expect(compareWithBenchmark([], [], { date: '2026-01-01', invested: 0, value: 0 })).toBeNull()
  })
})

// Research-Prompt-Bibliothek: 10 institutionelle Analyse-Frameworks
// (Screener, DCF, Risiko, Earnings, …), automatisch mit den eigenen
// Portfolio-Daten und dem Anlegerprofil befüllt. Zum Kopieren & Einfügen
// in Claude o. ä. gedacht.

import { fmtEur, fmtPct } from './format'
import type { CockpitState, Instrument, PortfolioSummary } from './types'

export interface PromptContext {
  portfolioText: string
  profileText: string
  ticker: string
  tickerName: string
  sector: string
  monthlyBudget: number
}

export interface ResearchPrompt {
  id: string
  title: string
  subtitle: string
  icon: string
  /** welche Auswahl der Prompt zusätzlich braucht */
  needs: 'none' | 'ticker' | 'sector'
  build: (ctx: PromptContext) => string
}

export function buildContext(
  state: CockpitState,
  summary: PortfolioSummary,
  selected: Instrument | null,
): PromptContext {
  const lines = summary.positions.map((p) => {
    const kind = p.instrument.assetClass === 'etf' ? 'ETF' : 'Aktie'
    return `- ${p.instrument.name} (${p.instrument.ticker}, ${kind}): ${fmtEur(p.value)} · ${fmtPct(p.weight * 100, 1)} Depotanteil · Einstand ${fmtEur(p.invested)} (${fmtPct(p.gainPct, 1, true)})`
  })
  const plans = state.plans
    .filter((pl) => pl.active)
    .map((pl) => {
      const inst = state.instruments.find((i) => i.id === pl.instrumentId)
      return `- Sparplan: ${fmtEur(pl.monthlyAmount)}/Monat in ${inst?.name ?? pl.instrumentId}`
    })
  const portfolioText = [
    `Depotwert gesamt: ${fmtEur(summary.value)} (Einstand ${fmtEur(summary.invested)}, ${fmtPct(summary.gainPct, 1, true)})`,
    `Cash-Reserve außerhalb des Depots: ${fmtEur(state.settings.cashReserve)}`,
    ...lines,
    ...plans,
  ].join('\n')

  const profileText = `Risikoprofil: ${state.settings.riskProfile} · Anlagehorizont: ${state.settings.horizonYears} Jahre · monatlich verfügbar: ${fmtEur(state.settings.monthlyBudget)} · Basiswährung EUR · steuerpflichtiges Depot in Deutschland (Abgeltungsteuer, Teilfreistellung bei Aktien-ETFs beachten)`

  return {
    portfolioText,
    profileText,
    ticker: selected?.ticker ?? '[TICKER]',
    tickerName: selected?.name ?? '[UNTERNEHMEN]',
    sector: selected?.sector ?? '[SEKTOR]',
    monthlyBudget: state.settings.monthlyBudget,
  }
}

const DISCLAIMER =
  'Wichtig: Kennzeichne Schätzungen klar als Schätzungen, nenne Datenstand/Unsicherheiten und schließe mit dem Hinweis, dass dies keine Anlageberatung ist.'

export const RESEARCH_PROMPTS: ResearchPrompt[] = [
  {
    id: 'screener',
    title: 'Aktien-Screening',
    subtitle: 'Goldman-Sachs-Stil · Top-Picks nach meinen Kriterien',
    icon: '🔍',
    needs: 'none',
    build: (c) => `Du bist Senior-Aktienanalyst:in bei Goldman Sachs mit 20 Jahren Erfahrung im Screening für vermögende Kund:innen.

Ich brauche ein vollständiges Aktien-Screening für meine Anlageziele.

Analysiere und liefere:
- Top 10 Aktien, die zu meinen Kriterien passen, mit Ticker
- KGV-Analyse im Vergleich zum Sektor-Durchschnitt
- Umsatzwachstums-Trend der letzten 5 Jahre
- Verschuldungs-Check (Debt/Equity) je Titel
- Dividendenrendite und Nachhaltigkeits-Score der Ausschüttung
- Burggraben-Rating (schwach / mittel / stark)
- Bull- und Bear-Case-Kursziel auf 12 Monate
- Risiko-Rating 1–10 mit klarer Begründung
- Einstiegszonen und Stop-Loss-Vorschläge

Format: professioneller Research-Report mit Übersichtstabelle am Anfang.

Mein Anlegerprofil: ${c.profileText}

Mein aktuelles Depot (bitte Überschneidungen berücksichtigen):
${c.portfolioText}

${DISCLAIMER}`,
  },
  {
    id: 'dcf',
    title: 'DCF-Bewertung',
    subtitle: 'Morgan-Stanley-Stil · Fair Value einer Aktie',
    icon: '🧮',
    needs: 'ticker',
    build: (c) => `Du bist VP im Investment Banking bei Morgan Stanley und baust Bewertungsmodelle für Fortune-500-Deals.

Ich brauche eine vollständige Discounted-Cashflow-Analyse für eine Aktie.

Erstelle:
- 5-Jahres-Umsatzprojektion mit begründeten Wachstumsannahmen
- Operative Margen-Schätzung auf Basis der Historie
- Free-Cashflow-Berechnung Jahr für Jahr
- WACC-Herleitung (Kapitalkosten)
- Terminal Value nach Exit-Multiple UND Gordon-Growth
- Sensitivitätstabelle: Fair Value bei verschiedenen Diskontsätzen
- Vergleich DCF-Wert vs. aktueller Kurs
- Klares Urteil: unterbewertet, fair bewertet oder überbewertet
- Die 3 Annahmen, die das Modell am ehesten brechen

Format: Bewertungs-Memo mit Tabellen und nachvollziehbarer Rechnung.

Die zu bewertende Aktie: ${c.tickerName} (${c.ticker})

${DISCLAIMER}`,
  },
  {
    id: 'risk',
    title: 'Portfolio-Risikoanalyse',
    subtitle: 'Bridgewater-Stil · Stress-Test des Depots',
    icon: '🛡️',
    needs: 'none',
    build: (c) => `Du bist Senior-Risikoanalyst:in bei Bridgewater Associates, geschult nach Ray Dalios Prinzipien radikaler Transparenz.

Ich brauche eine vollständige Risiko-Bewertung meines aktuellen Portfolios.

Bewerte:
- Korrelationsanalyse zwischen meinen Positionen
- Sektor-Konzentrationsrisiko mit prozentualer Aufschlüsselung
- Geografische Gewichtung und Währungsrisiken (EUR-Basis!)
- Zins-Sensitivität je Position
- Rezessions-Stresstest mit geschätztem Drawdown
- Liquiditätsrisiko je Position
- Einzelwert-Risiko und Empfehlung zur Positionsgröße
- Tail-Risk-Szenarien mit Wahrscheinlichkeiten
- Hedging-Ideen für meine Top-3-Risiken
- Rebalancing-Vorschlag mit konkreten Ziel-Allokationen in %

Format: Risiko-Report mit Heatmap-Übersichtstabelle.

Mein Profil: ${c.profileText}

Mein Portfolio:
${c.portfolioText}

${DISCLAIMER}`,
  },
  {
    id: 'earnings',
    title: 'Earnings-Vorschau',
    subtitle: 'JPMorgan-Stil · Quartalszahlen einordnen',
    icon: '📅',
    needs: 'ticker',
    build: (c) => `Du bist Senior-Equity-Research-Analyst:in bei JPMorgan und schreibst Earnings-Previews für institutionelle Investoren.

Ich brauche eine vollständige Earnings-Analyse vor den nächsten Quartalszahlen.

Liefere:
- Beat/Miss-Historie der letzten 4 Quartale vs. Erwartungen
- Konsens-Schätzungen für Umsatz und EPS im kommenden Quartal
- Die Kennzahlen, auf die die Wall Street bei genau diesem Unternehmen schaut
- Umsatz-Aufschlüsselung und Trend je Segment
- Zusammenfassung der Management-Guidance vom letzten Call
- Vom Optionsmarkt eingepreiste Bewegung am Earnings-Tag
- Kursreaktion nach den letzten 4 Earnings
- Bull-Case-Szenario mit Kurs-Impact
- Bear-Case-Szenario mit Abwärtsrisiko
- Deine Einordnung: vorher kaufen, vorher verkaufen oder abwarten – mit Begründung

Format: Pre-Earnings-Brief mit Entscheidungs-Zusammenfassung ganz oben.

Das Unternehmen: ${c.tickerName} (${c.ticker})

${DISCLAIMER}`,
  },
  {
    id: 'allocation',
    title: 'Portfolio-Konstruktion',
    subtitle: 'BlackRock-Stil · Ziel-Allokation & Sparplan',
    icon: '🏗️',
    needs: 'none',
    build: (c) => `Du bist Senior-Portfoliostratege bei BlackRock und verwaltest Multi-Asset-Portfolios über 500 Mio. USD.

Ich brauche ein maßgeschneidertes Zielportfolio für meine Situation – aufbauend auf meinem bestehenden Depot.

Erstelle:
- Exakte Ziel-Allokation in % über Aktien-ETFs, Einzelaktien, Anleihen, Cash
- Konkrete (in Deutschland handelbare, UCITS-)ETF-Empfehlungen je Baustein mit Ticker
- Core- vs. Satellite-Positionen klar gekennzeichnet
- Erwartete Rendite-Spanne p. a. auf Basis historischer Daten
- Erwarteter maximaler Drawdown in einem schlechten Jahr
- Rebalancing-Regeln (Zeitpunkt + Schwellen)
- Steuer-Hinweise für ein deutsches Depot (Abgeltungsteuer, Teilfreistellung, Freistellungsauftrag)
- Sparplan-Aufteilung für meine ${fmtEur(c.monthlyBudget)} pro Monat
- Benchmark, an der ich mich messen sollte
- Einseitiges Investment-Policy-Statement zum Abheften

Format: Investment-Policy-Dokument mit Allokations-Übersicht.

Mein Profil: ${c.profileText}

Mein aktuelles Depot:
${c.portfolioText}

${DISCLAIMER}`,
  },
  {
    id: 'technical',
    title: 'Technische Analyse',
    subtitle: 'Citadel-Stil · Chart, Levels & Trade-Plan',
    icon: '📈',
    needs: 'ticker',
    build: (c) => `Du bist Senior-Quant-Trader:in bei Citadel und kombinierst technische Analyse mit statistischen Modellen für Ein- und Ausstiege.

Ich brauche eine vollständige technische Analyse einer Aktie.

Analysiere:
- Trendrichtung auf Tages-, Wochen- und Monats-Chart
- Wichtige Unterstützungen und Widerstände mit konkreten Kursmarken
- 50/100/200-Tage-Linien und Crossover-Signale
- RSI, MACD und Bollinger-Bänder in verständlicher Sprache
- Volumen-Trend und was er über Käufer-/Verkäuferstärke sagt
- Chartmuster (SKS, Cup & Handle, Flaggen …)
- Fibonacci-Retracements als mögliche Bounce-Zonen
- Idealer Einstieg, Stop-Loss und Kursziel
- Chance-Risiko-Verhältnis des aktuellen Setups
- Einstufung: Strong Buy / Buy / Neutral / Sell / Strong Sell

Format: TA-Report-Card mit klarem Trade-Plan als Zusammenfassung.

Die Aktie: ${c.tickerName} (${c.ticker}) – Position im Depot siehe unten, falls vorhanden.

${c.portfolioText}

${DISCLAIMER}`,
  },
  {
    id: 'dividends',
    title: 'Dividenden-Strategie',
    subtitle: 'Endowment-Stil · passives Einkommen aufbauen',
    icon: '💶',
    needs: 'none',
    build: (c) => `Du bist Chief Investment Strategist eines 50-Mrd.-Endowment-Fonds, spezialisiert auf Einkommens-Strategien mit Aktien.

Ich brauche ein Dividenden-Portfolio, das zuverlässig passives Einkommen erzeugt.

Baue:
- 15–20 Dividenden-Picks mit Ticker und aktueller Rendite (auch europäische Titel!)
- Dividenden-Sicherheits-Score je Titel (1–10)
- Jahre ununterbrochener Dividendensteigerung
- Payout-Ratio-Analyse: Welche Ausschüttung ist gefährdet?
- Monatliche Einkommens-Projektion für mein Budget
- Sektor-Streuung gegen Klumpenrisiken
- Geschätztes Dividendenwachstum der nächsten 5 Jahre
- Wiederanlage-Projektion (Zinseszins über 10 Jahre)
- Steuer-Hinweise für Deutschland (Quellensteuer USA/Schweiz/Frankreich!)
- Ranking von konservativ bis offensiv

Format: Dividenden-Blaupause mit Einkommens-Projektionstabelle.

Mein Profil: ${c.profileText}

Mein bestehendes Depot:
${c.portfolioText}

${DISCLAIMER}`,
  },
  {
    id: 'moat',
    title: 'Wettbewerbs-Analyse',
    subtitle: 'Bain-Stil · bester Titel eines Sektors',
    icon: '⚔️',
    needs: 'sector',
    build: (c) => `Du bist Senior Partner bei Bain & Company und erstellst eine Wettbewerbs-Analyse für einen großen Investmentfonds.

Ich brauche einen vollständigen Branchen-Report, um die beste Aktie eines Sektors zu finden.

Liefere:
- Top 5–7 Wettbewerber des Sektors mit Marktkapitalisierung
- Umsatz- und Margen-Vergleich als Tabelle
- Burggraben-Analyse je Unternehmen (Marke, Kosten, Netzwerk, Wechselkosten)
- Marktanteils-Trends der letzten 3 Jahre
- Management-Qualität anhand der Kapitalallokations-Historie
- Innovations-Pipeline und F&E-Vergleich
- Größte Bedrohungen (Regulierung, Disruption, Makro)
- SWOT für die Top-2-Unternehmen
- Dein einzelner bester Pick mit klarer Begründung
- Katalysatoren, die den Gewinner in 12 Monaten bewegen können

Format: Strategie-Deck-Zusammenfassung mit Vergleichstabellen.

Der Sektor: ${c.sector}

${DISCLAIMER}`,
  },
  {
    id: 'patterns',
    title: 'Muster & Anomalien',
    subtitle: 'RenTec-Stil · statistische Auffälligkeiten',
    icon: '🧬',
    needs: 'ticker',
    build: (c) => `Du bist Quant-Researcher:in bei Renaissance Technologies und suchst datengetrieben nach statistischen Vorteilen.

Ich möchte versteckte Muster und Anomalien im Verhalten einer Aktie verstehen.

Untersuche:
- Saisonale Muster: historisch beste und schlechteste Monate
- Wochentags-Effekte, falls vorhanden
- Verhalten rund um Makro-Events (Fed-Sitzungen, CPI)
- Insider-Käufe/-Verkäufe aus den letzten Filings
- Institutionelle Eigentümer-Trends: kaufen oder verkaufen die großen Fonds?
- Short Interest und Squeeze-Potenzial
- Auffällige Optionsmarkt-Aktivität
- Kursverhalten um Earnings (Pre-Run, Gap-Verhalten)
- Sektor-Rotations-Signale, die diesen Titel betreffen
- Fazit: Welcher quantifizierbare Edge existiert – und wie belastbar ist er?

Format: Quant-Memo mit Datentabellen; markiere klar, was belegte Statistik und was Anekdote ist.

Die Aktie: ${c.tickerName} (${c.ticker})

${DISCLAIMER}`,
  },
  {
    id: 'macro',
    title: 'Makro-Briefing',
    subtitle: 'McKinsey-Stil · Konjunktur & mein Depot',
    icon: '🌍',
    needs: 'none',
    build: (c) => `Du bist Senior Partner am McKinsey Global Institute und berätst Staatsfonds, wie Makro-Trends Aktienmärkte beeinflussen.

Ich brauche eine Makro-Analyse mit direktem Bezug auf mein Depot (EUR-Perspektive!).

Analysiere:
- Aktuelles Zinsumfeld (EZB & Fed) und Wirkung auf Growth vs. Value
- Inflationstrend und welche Sektoren profitieren/leiden
- BIP-Ausblick und Bedeutung für Unternehmensgewinne
- Dollar-Stärke/-Schwäche und Effekt auf meine USA-lastigen Positionen
- Arbeitsmarkt & Konsum: Implikationen
- Geldpolitik-Ausblick 6–12 Monate
- Globale Risiken (Geopolitik, Handel, Lieferketten)
- Sektor-Rotations-Empfehlung im aktuellen Zyklus
- Konkrete Anpassungen, die ich jetzt prüfen sollte
- Zeitachse: Wann schlagen diese Faktoren voraussichtlich durch?

Format: Executive-Briefing mit klarem Aktionsplan.

Mein Portfolio:
${c.portfolioText}

Meine größte Sorge: [HIER DEINE GRÖSSTE SORGE EINTRAGEN]

${DISCLAIMER}`,
  },
]

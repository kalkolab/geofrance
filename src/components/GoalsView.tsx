import { useState } from 'react'
import { formatDate, useT } from '../i18n'
import type { GoalItem, GoalProgress } from '../lib/goals'
import type { RefData } from '../lib/ref'
import { goalTitle } from './goalTitle'

interface Props {
  geo: RefData
  goals: GoalProgress[]
  onShow(goal: GoalProgress): void
}

export function GoalsView({ geo, goals, onShow }: Props) {
  const t = useT()
  const reached = goals.filter((g) => g.reached).length
  const france = goals.filter((g) => g.group === 'france')
  // Regions closest to done first, finished ones last.
  const regions = goals
    .filter((g) => g.group === 'region')
    .sort((a, b) => Number(a.reached) - Number(b.reached) || b.done / b.total - a.done / a.total)

  return (
    <div className="page">
      <p className="muted">{t('goalsSummary', { done: reached, count: goals.length })}</p>
      <section>
        <h2>{t('goalsFrance')}</h2>
        <ul className="goals">
          {france.map((g) => (
            <GoalRow key={g.id} geo={geo} goal={g} onShow={onShow} />
          ))}
        </ul>
      </section>
      <section>
        <h2>{t('goalsRegions')}</h2>
        <ul className="goals">
          {regions.map((g) => (
            <GoalRow key={g.id} geo={geo} goal={g} onShow={onShow} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function GoalRow({ geo, goal, onShow }: { geo: RefData; goal: GoalProgress; onShow(goal: GoalProgress): void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <li className={goal.reached ? 'goal reached' : 'goal'}>
      <button className="goal-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="goal-title">
          {goal.reached && <span className="badge" aria-hidden>✓</span>}
          {goalTitle(goal.title)}
        </span>
        <span className="muted">
          {goal.done}/{goal.total}
        </span>
      </button>
      <div className="bar">
        <div style={{ width: `${(100 * goal.done) / goal.total}%` }} />
      </div>
      {goal.reached && (
        <p className="muted">{goal.reachedOn ? t('goalReachedOn', { date: formatDate(goal.reachedOn) }) : t('goalReached')}</p>
      )}
      {open && !goal.reached && (
        <div className="goal-missing">
          <p className="muted">{t('goalRemaining')}</p>
          <p>{goal.missing.map((i) => itemName(geo, i)).join(' · ')}</p>
          <button onClick={() => onShow(goal)}>{t('showOnMap')}</button>
        </div>
      )}
    </li>
  )
}

export function itemName(geo: RefData, item: GoalItem) {
  if (item.kind === 'region') return geo.region.get(item.code)?.name ?? item.code
  if (item.kind === 'departement') return `${geo.departement.get(item.code)?.name ?? ''} (${item.code})`
  const c = geo.commune.get(item.code)
  return c ? `${c.name} (${c.departement})` : item.code
}

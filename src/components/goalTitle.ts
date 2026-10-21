import { t } from '../i18n'
import type { GoalTitle } from '../lib/goals'

export const goalTitle = (title: GoalTitle) => t(title.key, title)

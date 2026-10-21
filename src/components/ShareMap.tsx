import { useEffect, useState } from 'react'
import { loadCommunes, loadDepartements, loadRegions } from '../data'
import { formatDate, formatNumber, t as translate, useT } from '../i18n'
import type { FeatureCollection } from '../lib/geo'
import { drawShareImage, IMAGE_HEIGHT, IMAGE_WIDTH } from '../lib/shareImage'
import type { Stats } from '../lib/stats'
import { COLORS, type Level } from './FranceMap'

interface Props {
  stats: Stats
  visited: Set<string>
  level: Level
  goals: { reached: number; total: number }
  onClose(): void
}

const FILE_NAME = 'geofrance.png'

// A picture of your map with your totals, to send to someone or keep.
export function ShareMap({ stats, visited, level, goals, onClose }: Props) {
  const t = useT()
  const [image, setImage] = useState<{ blob: Blob; url: string }>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    let url: string | undefined
    makeImage(stats, visited, level, goals).then(
      (blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      },
      (e: Error) => !cancelled && setError(e.message),
    )
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [stats, visited, level, goals.reached, goals.total])

  const file = image && new File([image.blob], FILE_NAME, { type: 'image/png' })
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function share() {
    try {
      await navigator.share({ files: [file!], title: 'GeoFrance', text: t('shareText') })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    }
  }

  function save() {
    const link = document.createElement('a')
    link.href = image!.url
    link.download = FILE_NAME
    link.click()
  }

  return (
    <div className="panel share">
      <h2>{t('shareTitle')}</h2>
      {image ? (
        <img src={image.url} alt={t('shareImageAlt')} width={IMAGE_WIDTH} height={IMAGE_HEIGHT} />
      ) : (
        !error && <p className="muted">{t('shareMaking')}</p>
      )}
      {error && <p className="muted">{t('shareFailed', { error })}</p>}
      <div className="actions">
        <button onClick={onClose}>{t('close')}</button>
        <button className={canShare ? '' : 'primary'} disabled={!image} onClick={save}>
          {t('shareSave')}
        </button>
        {canShare && (
          <button className="primary" onClick={share}>
            {t('shareSend')}
          </button>
        )}
      </div>
    </div>
  )
}

async function makeImage(stats: Stats, visited: Set<string>, level: Level, goals: { reached: number; total: number }) {
  const deps = [...stats.communesByDepartement.keys()]
  const [regions, departements, files] = await Promise.all([
    loadRegions(),
    loadDepartements(),
    level === 'departements' ? Promise.all(deps.map(loadCommunes)) : Promise.resolve([]),
  ])
  const communes: FeatureCollection = {
    type: 'FeatureCollection',
    features: files.flatMap((fc) => fc.features.filter((f) => visited.has(f.properties.code))),
  }
  const canvas = document.createElement('canvas')
  canvas.width = IMAGE_WIDTH
  canvas.height = IMAGE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  drawShareImage(ctx, {
    level,
    regions: regions as unknown as FeatureCollection,
    departements: departements as unknown as FeatureCollection,
    communes,
    visitedDepartements: new Set(deps),
    regionShare: stats.departementShareByRegion,
    colors: COLORS,
    title: translate('shareHeading'),
    subtitle: formatDate(new Date().toISOString().slice(0, 10)),
    totals: [
      { value: formatNumber(stats.communes.visited), label: translate('shareOfCommunes', { count: stats.communes.total }) },
      { value: formatNumber(stats.departements.visited), label: translate('shareOfDepartements', { count: stats.departements.total }) },
      { value: formatNumber(stats.regions.visited), label: translate('shareOfRegions', { count: stats.regions.total }) },
    ],
    goals: translate('goalsSummary', { done: goals.reached, count: goals.total }),
    footer: location.host + import.meta.env.BASE_URL.replace(/\/$/, ''),
  })
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not make the picture'))), 'image/png'),
  )
}

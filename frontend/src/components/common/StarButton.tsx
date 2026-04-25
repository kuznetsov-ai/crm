import { useFavoritesStore } from '../../stores/favoritesStore'
import type { FavoriteEntityType } from '../../api/favorites'

interface Props {
  entityType: FavoriteEntityType
  entityId: number
  size?: number
  className?: string
}

export default function StarButton({ entityType, entityId, size = 18, className = '' }: Props) {
  const isFavorite = useFavoritesStore((s) => s.isFavorite(entityType, entityId))
  const toggle = useFavoritesStore((s) => s.toggle)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(entityType, entityId)
      }}
      className={`shrink-0 inline-flex items-center justify-center transition-colors ${
        isFavorite
          ? 'text-[#f59e0b] hover:text-[#d97706]'
          : 'text-[var(--text-secondary)] hover:text-[#f59e0b]'
      } ${className}`}
      title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      aria-pressed={isFavorite}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
  )
}

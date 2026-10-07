export function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function TagChips({
  tags,
  activeTag,
  onTagClick
}: {
  tags: string | null;
  activeTag?: string;
  onTagClick?: (tag: string) => void;
}) {
  const list = parseTags(tags);
  if (list.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {list.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onTagClick?.(tag)}
          disabled={!onTagClick}
          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
            activeTag === tag
              ? "bg-accent text-white"
              : "bg-surface-secondary text-secondary hover:bg-accent-soft hover:text-accent"
          } ${onTagClick ? "cursor-pointer" : "cursor-default"}`}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}

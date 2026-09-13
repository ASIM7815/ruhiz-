'use client';

interface CategoryFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function CategoryFilters({ activeFilter, onFilterChange }: CategoryFiltersProps) {
  const filters = [
    { id: 'for-you', label: 'For You' },
    { id: 'following', label: 'Following' },
    { id: 'mental-health', label: 'Mental Health' },
    { id: 'life', label: 'Life' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'studying', label: 'Studying' },
    { id: 'career', label: 'Career' },
    { id: 'more', label: 'More' },
  ];

  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          className={`px-5 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
            activeFilter === filter.id
              ? 'bg-[#145C43] text-white'
              : 'bg-white text-[#718078] border border-[#E3EAE6] hover:border-[#145C43]'
          }`}
        >
          {filter.label}
          {filter.id === 'more' && (
            <svg className="inline-block w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

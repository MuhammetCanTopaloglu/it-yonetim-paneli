export default function Logo() {
  return (
    <div className="w-7 h-7 shrink-0 rounded-md bg-accent flex items-center justify-center">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="3" cy="3" r="2" fill="white" />
        <circle cx="13" cy="3" r="2" fill="white" />
        <circle cx="8" cy="13" r="2" fill="white" />
        <path d="M3 5L8 11M13 5L8 11" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
  );
}



## Remove "risk calculator" from workspace sidebar

One-line change in `src/components/AppNavSidebar.tsx`: remove the `{ icon: Calculator, label: "risk calculator", href: null }` entry from the `workspaceItems` array (line ~30), and remove the unused `Calculator` import.


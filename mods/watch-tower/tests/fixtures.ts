/** A trimmed `docs/features/<feature>/plan.md` as create-plan writes them. */
export const PLAN_MD = `# MSV plan

## 4. Reference Implementations

- [ ] not a task: outside the To Do List

## 5. To Do List

Commit rule: 1 task = 1 type, ≤ 3 files.

### Phase 0 — App skeleton
- [ ] **Register the \`hse\` app** — \`chore(hse): add hse app skeleton\`
  - Files: \`hse/__init__.py\`, \`hse/apps.py\`, \`core/settings.py\`
- [ ] **Wire URLs** — \`chore(hse): wire urls\`
  - Files: \`hse/urls.py\` (empty \`urlpatterns\`, \`app_name="hse"\`), \`core/urls.py\`
- [ ] **Verify**: \`make migrate\`; admin shows the referentials.

### Phase 1 — UF1 list & detail
- [x] **Filter form** — \`feat(hse): add msv list filter form\`
  - File: \`hse/forms/msv_filters.py\`
- [ ] **List templates** — \`feat(hse): add msv list templates\`
  - Files: \`templates/hse/msv/\`, \`styles/*.css\`

## 6. Notes
- [ ] not a task either
`

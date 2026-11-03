# Murphy's Laws About Technology

Technology gives Murphy's Law more places to hide. Failure can start in code, configuration, dependencies, hardware, networks, permissions, or documentation.

## Common technology patterns

- The environment that works locally is not the environment that deploys.
- The bug disappears while someone is watching.
- The migration succeeds until the rollback plan is needed.

## Named laws every engineer meets

- **Hofstadter's Law.** It always takes longer than you expect, even when you take into account Hofstadter's Law. It is the standard reply to an optimistic estimate.
- **The ninety-ninety rule.** The first 90 percent of the code takes the first 90 percent of the time, and the remaining 10 percent takes the other 90 percent. It is credited to Tom Cargill at Bell Labs.
- **Brooks's Law.** Adding people to a late software project makes it later, because new people need onboarding and add communication overhead.
- **Conway's Law.** Organizations design systems that mirror their own communication structure. Melvin Conway described it in 1968.

## Why technology fails in these ways

Complex systems fail at their seams. Each component can be correct on its own while the interaction between two of them is not. Configuration drift, hidden dependencies, and untested recovery paths all live in the gaps between teams and tools.

That is also why the failures feel personal. The part you tested worked. The part you did not test, or did not know about, is the part that broke.

## Designing for the inevitable

Good technology systems assume failure. They make mistakes visible, reversible, and recoverable. Murphy's Law is not pessimism here; it is an operating principle.

- Test the restore, not just the backup.
- Make deployments reversible and rehearse the rollback.
- Alert on the symptoms users feel, not only on the causes you predicted.
- Write down the assumption behind each estimate so it can be questioned.

The same thinking applies to planning. The [project management guide](/murphys-law-project-management) shows how to budget for the unexpected, and the [Sod's Law Calculator](/calculator/sods-law) lets you test how urgency, complexity, and skill change the odds that a task goes wrong.

## Keep exploring

- [Technology examples](/examples/tech)
- [Murphy's Technology Laws](/category/murphys-technology-laws)
- [Sod's Law Calculator](/calculator/sods-law)

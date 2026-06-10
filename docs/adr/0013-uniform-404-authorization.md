# Authorization is uniform 404 scoping; decline the 403 gate

Authorization in Sufra is uniform scoping: a miss is **always 404**, and there is **no 403 anywhere**. Ownership scoping (`WHERE userId = CurrentUser.id`) and the role gate (`CurrentUser.role === host` for the Host-only admin surface) **both yield 404 on a miss** — role is simply another scoping predicate. A non-owner and a non-host receive the identical "doesn't exist for you" 404; no existence leak, no Forbidden.

## Why

In Sufra **visibility == capability**. There is no state where a Member can see a resource but may not act on it — if a resource isn't yours (or isn't host-scoped when you aren't the Host), you don't even have the right to know it exists. With no see-but-can't-act case, 403 carries no information the app wants to disclose, and it would split authorization into two shapes. Treating the role check as one more scoping predicate collapses everything to a single model: load through `CurrentUser`, miss → 404.

The fawwaz-coding-style leaves 403 as a known gap ("only becomes real once membership/roles exist"). Sufra *has* roles (`host` / `member` on the Identity — see ADR 0010) but **deliberately declines** the 403 gate. That decision is a contribution to push back to the skill, not a deviation to apologize for.

## Mechanism

A `<Resource>Scoped` middleware (e.g. `MealScoped`) loads the record through `CurrentUser` and 404s on a miss — load-is-authorizing, so there is no separate ownership check to forget. A `HostOnly` gate checks `role` and 404s on a miss, the same way. Admin resources (`/admin/members`, `/admin/cost`, `/settings`) are host-scoped and **instance-wide**: the Host acts across all Members, so the scope is "is host," not "is owner."

Layer placement follows ADR 0009's `worker/` map: both gates live in `middleware/` as `authentication` + `<Resource>Scoped`, and scoped controllers declare only `HttpApiError.NotFound` in their contract — the absence of `Forbidden` in the surface is itself the enforcement.

## Considered alternatives

- **403 for the Host-only admin surface.** Rejected — there is no see-but-can't-act case to justify it; 404 leaks nothing and unifies the model with ownership scoping. A 403 would tell a non-host that the admin resource exists, and would force the contract to carry two error shapes for one authorization concept.

## Consequences

- One authorization shape across the whole app: scope (ownership or role) → 404 on miss.
- Scoped endpoints declare only `HttpApiError.NotFound`; the admin surface 404s for non-hosts exactly as a non-owned meal 404s for a non-owner.
- No existence leak on any resource; "Forbidden" never appears on the wire.
- Skill-sharpening note to feed back upstream: **role is a scope; a miss is 404; no 403.**

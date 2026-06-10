#!/usr/bin/env sh
# Sync the shared coding-style conventions skill into .claude/skills/fawwaz-coding-style.
#
# The skill is its OWN git repo (https://github.com/Fawwaz-2009/fawwaz-coding-style), gitignored
# here — never vendored. It floats to LATEST (no per-project pin), and is sharpened FROM any project:
# edit .claude/skills/fawwaz-coding-style, commit, push, and every project picks it up on its next sync.
#
# On your own machine this SYMLINKS your global clone (~/.claude/skills/fawwaz-coding-style), so an edit
# in any project is shared across them instantly. On a fresh machine / collaborator / CI it CLONES the
# latest. Wired to `postinstall`, so a fresh `pnpm install` brings the conventions in automatically.
set -e

DIR=".claude/skills/fawwaz-coding-style"
GLOBAL="$HOME/.claude/skills/fawwaz-coding-style"
REPO="https://github.com/Fawwaz-2009/fawwaz-coding-style.git"

if [ -e "$DIR" ] || [ -L "$DIR" ]; then
  # Already set up: fast-forward a real clone to latest (a symlink resolves to the global clone).
  [ -d "$DIR/.git" ] && git -C "$DIR" pull --ff-only >/dev/null 2>&1 || true
  exit 0
fi

mkdir -p .claude/skills
if [ -d "$GLOBAL/.git" ]; then
  ln -s "$GLOBAL" "$DIR" && echo "conventions: linked $DIR -> global clone"
else
  git clone "$REPO" "$DIR" && echo "conventions: cloned latest into $DIR"
fi
